"""
DAQ (Data Acquisition) API
Supports multiple industrial protocols for cross-platform DAQ integration
"""

from fastapi import APIRouter, WebSocket, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import Dict, List, Optional, Any
import asyncio
import json
import struct
from datetime import datetime
from enum import Enum
import logging

# Protocol imports (to be installed: pip install pymodbus opcua scapy)
try:
    from pymodbus.client import ModbusTcpClient
    from pymodbus.constants import Endian
    from pymodbus.payload import BinaryPayloadDecoder
    MODBUS_AVAILABLE = True
except ImportError:
    MODBUS_AVAILABLE = False

try:
    from asyncua import Client as OPCUAClient
    OPCUA_AVAILABLE = True
except ImportError:
    OPCUA_AVAILABLE = False

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/daq", tags=["daq"])

class DAQProtocol(str, Enum):
    MODBUS_TCP = "modbus_tcp"
    OPCUA = "opcua"
    ETHERNET_IP = "ethernet_ip"
    RAW_TCP = "raw_tcp"
    HTTP_REST = "http_rest"

class DAQDevice:
    def __init__(self, device_id: str, config: dict):
        self.device_id = device_id
        self.config = config
        self.protocol = config.get("protocol")
        self.host = config.get("host")
        self.port = config.get("port")
        self.connected = False
        self.client = None
        self.last_data = {}
        self.channels = config.get("channels", [])
        
    async def connect(self):
        """Connect to DAQ device based on protocol"""
        try:
            if self.protocol == DAQProtocol.MODBUS_TCP:
                await self._connect_modbus()
            elif self.protocol == DAQProtocol.OPCUA:
                await self._connect_opcua()
            elif self.protocol == DAQProtocol.RAW_TCP:
                await self._connect_raw_tcp()
            elif self.protocol == DAQProtocol.HTTP_REST:
                # HTTP doesn't need persistent connection
                self.connected = True
            else:
                raise ValueError(f"Unsupported protocol: {self.protocol}")
                
        except Exception as e:
            logger.error(f"Failed to connect to DAQ {self.device_id}: {e}")
            raise
            
    async def _connect_modbus(self):
        """Connect via Modbus TCP"""
        if not MODBUS_AVAILABLE:
            raise ImportError("pymodbus not installed. Run: pip install pymodbus")
            
        self.client = ModbusTcpClient(self.host, port=self.port or 502)
        if self.client.connect():
            self.connected = True
            logger.info(f"Connected to Modbus device at {self.host}:{self.port}")
        else:
            raise ConnectionError(f"Failed to connect to Modbus device at {self.host}:{self.port}")
            
    async def _connect_opcua(self):
        """Connect via OPC UA"""
        if not OPCUA_AVAILABLE:
            raise ImportError("asyncua not installed. Run: pip install asyncua")
            
        url = f"opc.tcp://{self.host}:{self.port or 4840}"
        self.client = OPCUAClient(url)
        await self.client.connect()
        self.connected = True
        logger.info(f"Connected to OPC UA server at {url}")
        
    async def _connect_raw_tcp(self):
        """Connect via raw TCP socket"""
        reader, writer = await asyncio.open_connection(self.host, self.port or 9999)
        self.client = {"reader": reader, "writer": writer}
        self.connected = True
        logger.info(f"Connected to TCP device at {self.host}:{self.port}")
        
    async def read_data(self) -> Dict[str, Any]:
        """Read data from all configured channels"""
        if not self.connected:
            await self.connect()
            
        data = {"timestamp": datetime.utcnow().isoformat(), "channels": {}}
        
        try:
            if self.protocol == DAQProtocol.MODBUS_TCP:
                data["channels"] = await self._read_modbus()
            elif self.protocol == DAQProtocol.OPCUA:
                data["channels"] = await self._read_opcua()
            elif self.protocol == DAQProtocol.RAW_TCP:
                data["channels"] = await self._read_raw_tcp()
            elif self.protocol == DAQProtocol.HTTP_REST:
                data["channels"] = await self._read_http()
                
            self.last_data = data
            return data
            
        except Exception as e:
            logger.error(f"Error reading from DAQ {self.device_id}: {e}")
            self.connected = False
            raise
            
    async def _read_modbus(self) -> Dict[str, float]:
        """Read Modbus registers"""
        values = {}
        
        for channel in self.channels:
            try:
                # Read based on register type
                register_type = channel.get("register_type", "holding")
                address = channel.get("address")
                count = channel.get("count", 1)
                
                if register_type == "holding":
                    result = self.client.read_holding_registers(address, count)
                elif register_type == "input":
                    result = self.client.read_input_registers(address, count)
                else:
                    continue
                    
                if not result.isError():
                    # Decode based on data type
                    data_type = channel.get("data_type", "int16")
                    if data_type == "float32":
                        decoder = BinaryPayloadDecoder.fromRegisters(
                            result.registers, 
                            byteorder=Endian.Big
                        )
                        value = decoder.decode_32bit_float()
                    elif data_type == "int32":
                        value = (result.registers[0] << 16) + result.registers[1]
                    else:  # int16
                        value = result.registers[0]
                        
                    # Apply scaling if configured
                    scale = channel.get("scale", 1.0)
                    offset = channel.get("offset", 0.0)
                    values[channel["name"]] = (value * scale) + offset
                    
            except Exception as e:
                logger.error(f"Error reading Modbus channel {channel.get('name')}: {e}")
                
        return values
        
    async def _read_opcua(self) -> Dict[str, float]:
        """Read OPC UA nodes"""
        values = {}
        
        for channel in self.channels:
            try:
                node_id = channel.get("node_id")
                node = self.client.get_node(node_id)
                value = await node.read_value()
                
                # Apply scaling if configured
                scale = channel.get("scale", 1.0)
                offset = channel.get("offset", 0.0)
                values[channel["name"]] = (float(value) * scale) + offset
                
            except Exception as e:
                logger.error(f"Error reading OPC UA channel {channel.get('name')}: {e}")
                
        return values
        
    async def _read_raw_tcp(self) -> Dict[str, float]:
        """Read from raw TCP stream"""
        values = {}
        reader = self.client["reader"]
        writer = self.client["writer"]
        
        # Send read command if configured
        read_command = self.config.get("read_command", b"READ\n")
        writer.write(read_command)
        await writer.drain()
        
        # Read response
        response = await reader.read(1024)
        
        # Parse based on configured format
        format_type = self.config.get("format", "csv")
        if format_type == "csv":
            # Parse CSV response
            data_str = response.decode().strip()
            values_list = data_str.split(",")
            for i, channel in enumerate(self.channels):
                if i < len(values_list):
                    try:
                        value = float(values_list[i])
                        scale = channel.get("scale", 1.0)
                        offset = channel.get("offset", 0.0)
                        values[channel["name"]] = (value * scale) + offset
                    except ValueError:
                        pass
                        
        elif format_type == "binary":
            # Parse binary response
            offset = 0
            for channel in self.channels:
                data_type = channel.get("data_type", "float32")
                if data_type == "float32":
                    if offset + 4 <= len(response):
                        value = struct.unpack(">f", response[offset:offset+4])[0]
                        values[channel["name"]] = value
                        offset += 4
                        
        return values
        
    async def _read_http(self) -> Dict[str, float]:
        """Read via HTTP REST API"""
        import aiohttp
        
        values = {}
        endpoint = self.config.get("endpoint", "/data")
        url = f"http://{self.host}:{self.port or 80}{endpoint}"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Map response to channels
                    for channel in self.channels:
                        json_path = channel.get("json_path", channel["name"])
                        value = self._extract_json_value(data, json_path)
                        if value is not None:
                            scale = channel.get("scale", 1.0)
                            offset = channel.get("offset", 0.0)
                            values[channel["name"]] = (float(value) * scale) + offset
                            
        return values
        
    def _extract_json_value(self, data: dict, path: str) -> Optional[float]:
        """Extract value from JSON using dot notation path"""
        parts = path.split(".")
        current = data
        
        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return None
                
        try:
            return float(current)
        except (ValueError, TypeError):
            return None
            
    async def disconnect(self):
        """Disconnect from DAQ device"""
        try:
            if self.protocol == DAQProtocol.MODBUS_TCP and self.client:
                self.client.close()
            elif self.protocol == DAQProtocol.OPCUA and self.client:
                await self.client.disconnect()
            elif self.protocol == DAQProtocol.RAW_TCP and self.client:
                writer = self.client["writer"]
                writer.close()
                await writer.wait_closed()
                
            self.connected = False
            logger.info(f"Disconnected from DAQ {self.device_id}")
            
        except Exception as e:
            logger.error(f"Error disconnecting from DAQ {self.device_id}: {e}")

# Global DAQ manager
class DAQManager:
    def __init__(self):
        self.devices: Dict[str, DAQDevice] = {}
        self.websocket_clients: List[WebSocket] = []
        self.polling_tasks: Dict[str, asyncio.Task] = {}
        
    async def add_device(self, device_id: str, config: dict) -> DAQDevice:
        """Add a new DAQ device"""
        if device_id in self.devices:
            raise ValueError(f"Device {device_id} already exists")
            
        device = DAQDevice(device_id, config)
        await device.connect()
        self.devices[device_id] = device
        
        # Start polling if configured
        poll_interval = config.get("poll_interval", 1.0)  # seconds
        if poll_interval > 0:
            self.polling_tasks[device_id] = asyncio.create_task(
                self._poll_device(device_id, poll_interval)
            )
            
        return device
        
    async def remove_device(self, device_id: str):
        """Remove a DAQ device"""
        if device_id in self.polling_tasks:
            self.polling_tasks[device_id].cancel()
            del self.polling_tasks[device_id]
            
        if device_id in self.devices:
            await self.devices[device_id].disconnect()
            del self.devices[device_id]
            
    async def _poll_device(self, device_id: str, interval: float):
        """Poll device for data at specified interval"""
        while device_id in self.devices:
            try:
                device = self.devices[device_id]
                data = await device.read_data()
                
                # Broadcast to WebSocket clients
                message = {
                    "type": "daq_data",
                    "device_id": device_id,
                    "data": data
                }
                
                for ws in self.websocket_clients:
                    try:
                        await ws.send_json(message)
                    except:
                        pass
                        
                await asyncio.sleep(interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error polling DAQ {device_id}: {e}")
                await asyncio.sleep(interval * 2)  # Back off on error

daq_manager = DAQManager()

# API Endpoints
@router.get("/protocols")
async def get_supported_protocols():
    """Get list of supported DAQ protocols"""
    protocols = [
        {
            "id": DAQProtocol.MODBUS_TCP,
            "name": "Modbus TCP",
            "description": "Industrial protocol for PLCs and sensors",
            "available": MODBUS_AVAILABLE,
            "default_port": 502
        },
        {
            "id": DAQProtocol.OPCUA,
            "name": "OPC UA",
            "description": "Unified Architecture for industrial automation",
            "available": OPCUA_AVAILABLE,
            "default_port": 4840
        },
        {
            "id": DAQProtocol.RAW_TCP,
            "name": "Raw TCP",
            "description": "Custom TCP protocol (CSV, binary, etc)",
            "available": True,
            "default_port": 9999
        },
        {
            "id": DAQProtocol.HTTP_REST,
            "name": "HTTP REST",
            "description": "RESTful API over HTTP",
            "available": True,
            "default_port": 80
        }
    ]
    
    return JSONResponse(content={"protocols": protocols})

@router.post("/devices")
async def add_daq_device(config: dict):
    """Add a new DAQ device"""
    device_id = config.get("id", f"daq_{datetime.utcnow().timestamp()}")
    
    try:
        device = await daq_manager.add_device(device_id, config)
        return JSONResponse(content={
            "device_id": device_id,
            "status": "connected" if device.connected else "error"
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/devices/{device_id}")
async def remove_daq_device(device_id: str):
    """Remove a DAQ device"""
    await daq_manager.remove_device(device_id)
    return JSONResponse(content={"status": "removed"})

@router.get("/devices")
async def list_daq_devices():
    """List all configured DAQ devices"""
    devices = []
    for device_id, device in daq_manager.devices.items():
        devices.append({
            "id": device_id,
            "protocol": device.protocol,
            "host": device.host,
            "port": device.port,
            "connected": device.connected,
            "channels": len(device.channels),
            "last_data": device.last_data
        })
    
    return JSONResponse(content={"devices": devices})

@router.get("/devices/{device_id}/data")
async def read_daq_data(device_id: str):
    """Read current data from a DAQ device"""
    if device_id not in daq_manager.devices:
        raise HTTPException(status_code=404, detail="Device not found")
        
    try:
        data = await daq_manager.devices[device_id].read_data()
        return JSONResponse(content=data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/ws")
async def daq_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time DAQ data"""
    await websocket.accept()
    daq_manager.websocket_clients.append(websocket)
    
    try:
        # Send initial device list
        devices = []
        for device_id, device in daq_manager.devices.items():
            devices.append({
                "id": device_id,
                "protocol": device.protocol,
                "connected": device.connected
            })
            
        await websocket.send_json({
            "type": "device_list",
            "devices": devices
        })
        
        # Keep connection alive
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        daq_manager.websocket_clients.remove(websocket)