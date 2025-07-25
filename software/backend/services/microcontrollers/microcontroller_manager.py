# software/backend/services/microcontrollers/microcontroller_manager.py
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime
import json
import logging
from fastapi import WebSocket

from software.backend.schemas.microcontroller import (
    MicrocontrollerCommandResponse, SerialPortInfo
)
from .connection_factory import ConnectionFactory
from .base_connection import BaseConnection

logger = logging.getLogger(__name__)


class MicrocontrollerManager:
    """Manages all microcontroller connections and communications"""
    
    def __init__(self):
        self.connections: Dict[str, BaseConnection] = {}
        self.websocket_subscribers: Dict[str, List[WebSocket]] = {}
        self.connection_factory = ConnectionFactory()
        
    async def list_serial_ports(self) -> List[SerialPortInfo]:
        """List available serial ports"""
        try:
            import serial.tools.list_ports
            ports = []
            for port in serial.tools.list_ports.comports():
                ports.append(SerialPortInfo(
                    port=port.device,
                    description=port.description,
                    hardware_id=port.hwid,
                    manufacturer=port.manufacturer,
                    product=port.product,
                    serial_number=port.serial_number
                ))
            return ports
        except ImportError:
            logger.warning("pyserial not installed, cannot list serial ports")
            return []
    
    async def connect(self, microcontroller_id: str) -> bool:
        """Connect to a microcontroller"""
        try:
            # Get microcontroller from database
            from software.backend.services.database_services import get_session_sync
            from software.backend.models.microcontroller import Microcontroller
            
            with get_session_sync() as db:
                microcontroller = db.query(Microcontroller).filter_by(id=microcontroller_id).first()
                if not microcontroller:
                    logger.error(f"Microcontroller {microcontroller_id} not found")
                    return False
                
                # Create connection
                connection = await self.connection_factory.create_connection(
                    microcontroller.type,
                    microcontroller.connection_type,
                    microcontroller.connection_string,
                    microcontroller.connection_params or {}
                )
                
                # Connect
                if await connection.connect():
                    self.connections[microcontroller_id] = connection
                    
                    # Update status in database
                    microcontroller.status = "connected"
                    microcontroller.last_seen = datetime.utcnow()
                    db.commit()
                    
                    # Notify subscribers
                    await self._notify_subscribers(microcontroller_id, {
                        "type": "status_change",
                        "status": "connected",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                    
                    # Start monitoring task
                    asyncio.create_task(self._monitor_connection(microcontroller_id))
                    
                    return True
                else:
                    logger.error(f"Failed to connect to microcontroller {microcontroller_id}")
                    return False
                    
        except Exception as e:
            logger.error(f"Error connecting to microcontroller {microcontroller_id}: {e}")
            return False
    
    async def disconnect(self, microcontroller_id: str):
        """Disconnect from a microcontroller"""
        if microcontroller_id in self.connections:
            connection = self.connections[microcontroller_id]
            await connection.disconnect()
            del self.connections[microcontroller_id]
            
            # Update status in database
            from software.backend.services.database_services import get_session_sync
            from software.backend.models.microcontroller import Microcontroller
            
            with get_session_sync() as db:
                microcontroller = db.query(Microcontroller).filter_by(id=microcontroller_id).first()
                if microcontroller:
                    microcontroller.status = "disconnected"
                    db.commit()
            
            # Notify subscribers
            await self._notify_subscribers(microcontroller_id, {
                "type": "status_change",
                "status": "disconnected",
                "timestamp": datetime.utcnow().isoformat()
            })
    
    async def send_command(
        self, 
        microcontroller_id: str, 
        command: str, 
        params: Optional[Dict[str, Any]] = None
    ) -> MicrocontrollerCommandResponse:
        """Send a command to a microcontroller"""
        if microcontroller_id not in self.connections:
            return MicrocontrollerCommandResponse(
                success=False,
                error="Microcontroller not connected"
            )
        
        try:
            connection = self.connections[microcontroller_id]
            response = await connection.send_command(command, params)
            
            # Log command
            from software.backend.services.database_services import get_session_sync
            from software.backend.models.microcontroller import DeviceLog
            
            with get_session_sync() as db:
                log_entry = DeviceLog(
                    microcontroller_id=microcontroller_id,
                    level="info",
                    message=f"Command: {command}",
                    data={"params": params, "response": response}
                )
                db.add(log_entry)
                db.commit()
            
            return MicrocontrollerCommandResponse(
                success=True,
                response=response.get("message"),
                data=response.get("data")
            )
            
        except Exception as e:
            logger.error(f"Error sending command to {microcontroller_id}: {e}")
            return MicrocontrollerCommandResponse(
                success=False,
                error=str(e)
            )
    
    async def subscribe_websocket(self, microcontroller_id: str, websocket: WebSocket):
        """Subscribe a websocket to microcontroller events"""
        if microcontroller_id not in self.websocket_subscribers:
            self.websocket_subscribers[microcontroller_id] = []
        self.websocket_subscribers[microcontroller_id].append(websocket)
    
    async def unsubscribe_websocket(self, microcontroller_id: str, websocket: WebSocket):
        """Unsubscribe a websocket from microcontroller events"""
        if microcontroller_id in self.websocket_subscribers:
            if websocket in self.websocket_subscribers[microcontroller_id]:
                self.websocket_subscribers[microcontroller_id].remove(websocket)
    
    async def _notify_subscribers(self, microcontroller_id: str, data: Dict[str, Any]):
        """Notify all websocket subscribers of an event"""
        if microcontroller_id in self.websocket_subscribers:
            disconnected = []
            for websocket in self.websocket_subscribers[microcontroller_id]:
                try:
                    await websocket.send_json(data)
                except Exception:
                    disconnected.append(websocket)
            
            # Remove disconnected websockets
            for ws in disconnected:
                self.websocket_subscribers[microcontroller_id].remove(ws)
    
    async def _monitor_connection(self, microcontroller_id: str):
        """Monitor a microcontroller connection and handle data"""
        connection = self.connections.get(microcontroller_id)
        if not connection:
            return
        
        try:
            while microcontroller_id in self.connections:
                # Check for incoming data
                data = await connection.read_data()
                if data:
                    await self._handle_incoming_data(microcontroller_id, data)
                
                # Small delay to prevent busy waiting
                await asyncio.sleep(0.1)
                
        except Exception as e:
            logger.error(f"Error monitoring connection {microcontroller_id}: {e}")
            await self.disconnect(microcontroller_id)
    
    async def _handle_incoming_data(self, microcontroller_id: str, data: Dict[str, Any]):
        """Handle incoming data from a microcontroller"""
        try:
            data_type = data.get("type")
            
            if data_type == "sensor_reading":
                # Store sensor reading
                from software.backend.services.database_services import get_session_sync
                from software.backend.models.microcontroller import SensorReading
                
                with get_session_sync() as db:
                    reading = SensorReading(
                        microcontroller_id=microcontroller_id,
                        sensor_type=data.get("sensor_type"),
                        sensor_id=data.get("sensor_id"),
                        value=data.get("value"),
                        unit=data.get("unit")
                    )
                    db.add(reading)
                    db.commit()
                
                # Notify subscribers
                await self._notify_subscribers(microcontroller_id, {
                    "type": "sensor_reading",
                    "data": data,
                    "timestamp": datetime.utcnow().isoformat()
                })
                
            elif data_type == "log":
                # Store log entry
                from software.backend.services.database_services import get_session_sync
                from software.backend.models.microcontroller import DeviceLog
                
                with get_session_sync() as db:
                    log_entry = DeviceLog(
                        microcontroller_id=microcontroller_id,
                        level=data.get("level", "info"),
                        message=data.get("message", ""),
                        data=data.get("data")
                    )
                    db.add(log_entry)
                    db.commit()
                
                # Notify subscribers
                await self._notify_subscribers(microcontroller_id, {
                    "type": "log",
                    "data": data,
                    "timestamp": datetime.utcnow().isoformat()
                })
                
            else:
                # Generic data, just notify subscribers
                await self._notify_subscribers(microcontroller_id, {
                    "type": "data",
                    "data": data,
                    "timestamp": datetime.utcnow().isoformat()
                })
                
        except Exception as e:
            logger.error(f"Error handling incoming data from {microcontroller_id}: {e}")