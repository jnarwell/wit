"""
Sensors API - WebSocket server for ESP32 and other sensor integrations
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
import json
import logging
import asyncio
from datetime import datetime
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/sensors", tags=["sensors"])

# In-memory storage for connected sensors (in production, use Redis or similar)
connected_sensors: Dict[str, WebSocket] = {}
sensor_data_store: Dict[str, List[Dict]] = {}  # Store last N readings per sensor
sensor_metadata: Dict[str, Dict] = {}  # Store sensor configuration/metadata

class SensorData(BaseModel):
    """Sensor data model"""
    sensor_id: str
    timestamp: float
    data: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None

class SensorConfig(BaseModel):
    """Sensor configuration model"""
    sensor_id: str
    name: str
    type: str
    channels: List[str]
    sampling_rate: Optional[int] = 1000  # Hz
    enabled: bool = True

class WebSocketManager:
    """Manages WebSocket connections for sensors"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.sensor_subscribers: Dict[str, List[WebSocket]] = {}  # UI clients subscribed to sensor data
        
    async def connect(self, websocket: WebSocket, client_id: str):
        """Accept and store WebSocket connection"""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} connected")
        
    def disconnect(self, client_id: str):
        """Remove WebSocket connection"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"Client {client_id} disconnected")
            
    async def send_personal_message(self, message: str, client_id: str):
        """Send message to specific client"""
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_text(message)
            
    async def broadcast(self, message: str):
        """Broadcast message to all connected clients"""
        disconnected = []
        for client_id, connection in self.active_connections.items():
            try:
                await connection.send_text(message)
            except:
                disconnected.append(client_id)
                
        # Clean up disconnected clients
        for client_id in disconnected:
            self.disconnect(client_id)
            
    async def broadcast_sensor_data(self, sensor_id: str, data: dict):
        """Broadcast sensor data to subscribed UI clients"""
        if sensor_id in self.sensor_subscribers:
            message = json.dumps({
                "type": "sensor_data",
                "sensor_id": sensor_id,
                "data": data,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            disconnected = []
            for websocket in self.sensor_subscribers[sensor_id]:
                try:
                    await websocket.send_text(message)
                except:
                    disconnected.append(websocket)
                    
            # Clean up disconnected subscribers
            for ws in disconnected:
                self.sensor_subscribers[sensor_id].remove(ws)

manager = WebSocketManager()

@router.websocket("/ws/{client_type}")
async def websocket_endpoint(websocket: WebSocket, client_type: str):
    """
    WebSocket endpoint for both ESP32 sensors and UI clients
    client_type: 'sensor' for ESP32/Arduino devices, 'ui' for web interface
    """
    client_id = str(uuid.uuid4())
    await manager.connect(websocket, client_id)
    
    try:
        while True:
            # Receive message
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if client_type == "sensor":
                await handle_sensor_message(client_id, message)
            elif client_type == "ui":
                await handle_ui_message(websocket, client_id, message)
            else:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": f"Unknown client type: {client_type}"
                }))
                
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        # If it was a sensor, mark it as disconnected
        if client_id in connected_sensors:
            sensor_id = next((sid for sid, ws_id in connected_sensors.items() if ws_id == client_id), None)
            if sensor_id:
                del connected_sensors[sensor_id]
                logger.info(f"Sensor {sensor_id} disconnected")
                
async def handle_sensor_message(client_id: str, message: dict):
    """Handle messages from ESP32/sensor devices"""
    msg_type = message.get("type")
    
    if msg_type == "auth":
        # Sensor authentication
        sensor_id = message.get("device_id")
        token = message.get("token")
        
        # TODO: Validate token
        if sensor_id:
            connected_sensors[sensor_id] = client_id
            
            # Initialize storage for this sensor
            if sensor_id not in sensor_data_store:
                sensor_data_store[sensor_id] = []
                
            await manager.send_personal_message(
                json.dumps({
                    "type": "auth_success",
                    "message": "Authentication successful"
                }),
                client_id
            )
            logger.info(f"Sensor {sensor_id} authenticated")
        else:
            await manager.send_personal_message(
                json.dumps({
                    "type": "auth_error",
                    "message": "Missing device_id"
                }),
                client_id
            )
            
    elif msg_type == "sensor_data":
        # Store sensor data
        sensor_id = message.get("device_id")
        if sensor_id and sensor_id in connected_sensors:
            data_point = {
                "timestamp": message.get("timestamp", datetime.utcnow().timestamp()),
                "data": message.get("data", {}),
                "metadata": message.get("metadata", {})
            }
            
            # Store data (keep last 1000 readings)
            sensor_data_store[sensor_id].append(data_point)
            if len(sensor_data_store[sensor_id]) > 1000:
                sensor_data_store[sensor_id] = sensor_data_store[sensor_id][-1000:]
                
            # Broadcast to UI clients
            await manager.broadcast_sensor_data(sensor_id, data_point)
            
    elif msg_type == "status":
        # Sensor status update
        sensor_id = message.get("device_id")
        if sensor_id:
            if sensor_id not in sensor_metadata:
                sensor_metadata[sensor_id] = {}
            sensor_metadata[sensor_id]["status"] = message.get("status")
            sensor_metadata[sensor_id]["last_seen"] = datetime.utcnow().isoformat()
            
async def handle_ui_message(websocket: WebSocket, client_id: str, message: dict):
    """Handle messages from UI clients"""
    msg_type = message.get("type")
    
    if msg_type == "subscribe":
        # Subscribe to sensor data
        sensor_ids = message.get("sensor_ids", [])
        for sensor_id in sensor_ids:
            if sensor_id not in manager.sensor_subscribers:
                manager.sensor_subscribers[sensor_id] = []
            if websocket not in manager.sensor_subscribers[sensor_id]:
                manager.sensor_subscribers[sensor_id].append(websocket)
                
        await websocket.send_text(json.dumps({
            "type": "subscribed",
            "sensor_ids": sensor_ids
        }))
        
    elif msg_type == "unsubscribe":
        # Unsubscribe from sensor data
        sensor_ids = message.get("sensor_ids", [])
        for sensor_id in sensor_ids:
            if sensor_id in manager.sensor_subscribers and websocket in manager.sensor_subscribers[sensor_id]:
                manager.sensor_subscribers[sensor_id].remove(websocket)
                
    elif msg_type == "command":
        # Send command to sensor
        sensor_id = message.get("sensor_id")
        command = message.get("command")
        
        if sensor_id in connected_sensors:
            client_id = connected_sensors[sensor_id]
            await manager.send_personal_message(
                json.dumps({
                    "type": "command",
                    "command": command,
                    "params": message.get("params", {})
                }),
                client_id
            )
        else:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": f"Sensor {sensor_id} not connected"
            }))

# REST endpoints for sensor management

@router.get("/connected")
async def get_connected_sensors():
    """Get list of currently connected sensors"""
    sensors = []
    for sensor_id in connected_sensors.keys():
        sensor_info = {
            "id": sensor_id,
            "connected": True,
            "metadata": sensor_metadata.get(sensor_id, {})
        }
        sensors.append(sensor_info)
    return {"sensors": sensors}

@router.get("/data/{sensor_id}")
async def get_sensor_data(sensor_id: str, limit: int = 100):
    """Get recent data from a specific sensor"""
    if sensor_id not in sensor_data_store:
        raise HTTPException(status_code=404, detail="Sensor not found")
        
    data = sensor_data_store[sensor_id][-limit:]
    return {
        "sensor_id": sensor_id,
        "count": len(data),
        "data": data
    }

@router.post("/command/{sensor_id}")
async def send_sensor_command(sensor_id: str, command: dict):
    """Send command to a specific sensor"""
    if sensor_id not in connected_sensors:
        raise HTTPException(status_code=404, detail="Sensor not connected")
        
    client_id = connected_sensors[sensor_id]
    await manager.send_personal_message(
        json.dumps({
            "type": "command",
            **command
        }),
        client_id
    )
    
    return {"status": "command_sent", "sensor_id": sensor_id}

@router.delete("/data/{sensor_id}")
async def clear_sensor_data(sensor_id: str):
    """Clear stored data for a specific sensor"""
    if sensor_id in sensor_data_store:
        sensor_data_store[sensor_id] = []
        return {"status": "data_cleared", "sensor_id": sensor_id}
    else:
        raise HTTPException(status_code=404, detail="Sensor not found")

# MQTT Support (for devices that prefer MQTT over WebSocket)
# This would integrate with the existing MQTT service if needed
@router.post("/mqtt/publish")
async def publish_mqtt_data(topic: str, payload: dict):
    """Publish sensor data via MQTT (bridge for MQTT devices)"""
    # TODO: Integrate with mqtt_service_v2.py
    return {"status": "published", "topic": topic}