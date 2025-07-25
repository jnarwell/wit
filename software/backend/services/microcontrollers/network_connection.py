# software/backend/services/microcontrollers/network_connection.py
import asyncio
import aiohttp
import socket
from typing import Dict, Any, Optional
import logging
import json
from datetime import datetime

from software.backend.models.microcontroller import ConnectionType
from .base_connection import BaseConnection

logger = logging.getLogger(__name__)


class NetworkConnection(BaseConnection):
    """Network-based connection for microcontrollers (TCP/UDP/HTTP)"""
    
    def __init__(self, connection_string: str, params: Dict[str, Any], connection_type: ConnectionType):
        super().__init__(connection_string, params)
        self.connection_type = connection_type
        self.session = None
        self.socket = None
        self._reader_task = None
        
        # Parse connection string (format: "ip:port" or just "ip")
        parts = connection_string.split(':')
        self.host = parts[0]
        self.port = int(parts[1]) if len(parts) > 1 else params.get("port", 80)
        
    async def connect(self) -> bool:
        """Connect to the device over network"""
        try:
            if self.connection_type == ConnectionType.NETWORK_HTTP:
                # Create HTTP session
                timeout = aiohttp.ClientTimeout(total=self.params.get("timeout", 5.0))
                self.session = aiohttp.ClientSession(timeout=timeout)
                
                # Test connection
                url = f"http://{self.host}:{self.port}/status"
                async with self.session.get(url) as response:
                    if response.status == 200:
                        self.is_connected = True
                        logger.info(f"Connected to HTTP device at {self.host}:{self.port}")
                        return True
                        
            elif self.connection_type == ConnectionType.NETWORK_TCP:
                # Create TCP socket
                self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self.socket.setblocking(False)
                
                # Connect
                await asyncio.get_event_loop().sock_connect(self.socket, (self.host, self.port))
                
                # Start reader task
                self._reader_task = asyncio.create_task(self._tcp_read_loop())
                
                self.is_connected = True
                logger.info(f"Connected to TCP device at {self.host}:{self.port}")
                return True
                
            elif self.connection_type == ConnectionType.NETWORK_UDP:
                # Create UDP socket
                self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                self.socket.setblocking(False)
                
                self.is_connected = True
                logger.info(f"Created UDP socket for device at {self.host}:{self.port}")
                return True
                
            return False
            
        except Exception as e:
            logger.error(f"Failed to connect to network device {self.host}:{self.port}: {e}")
            return False
    
    async def disconnect(self):
        """Disconnect from the network device"""
        self.is_connected = False
        
        if self._reader_task:
            self._reader_task.cancel()
            try:
                await self._reader_task
            except asyncio.CancelledError:
                pass
        
        if self.session:
            await self.session.close()
            
        if self.socket:
            self.socket.close()
            
        logger.info(f"Disconnected from network device {self.host}:{self.port}")
    
    async def send_command(self, command: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Send a command and wait for response"""
        if not self.is_connected:
            raise ConnectionError("Not connected to device")
        
        message = {
            "cmd": command,
            "params": params or {},
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if self.connection_type == ConnectionType.NETWORK_HTTP:
            return await self._send_http_command(message)
        elif self.connection_type == ConnectionType.NETWORK_TCP:
            return await self._send_tcp_command(message)
        elif self.connection_type == ConnectionType.NETWORK_UDP:
            return await self._send_udp_command(message)
    
    async def write_data(self, data: bytes):
        """Write raw data to the device"""
        if self.connection_type in [ConnectionType.NETWORK_TCP, ConnectionType.NETWORK_UDP]:
            if not self.socket:
                raise ConnectionError("Socket not connected")
                
            if self.connection_type == ConnectionType.NETWORK_TCP:
                await asyncio.get_event_loop().sock_sendall(self.socket, data)
            else:  # UDP
                await asyncio.get_event_loop().sock_sendto(
                    self.socket, data, (self.host, self.port)
                )
        else:
            raise NotImplementedError("Raw write not supported for HTTP connections")
    
    async def read_data(self) -> Optional[Dict[str, Any]]:
        """Read data from the queue (non-blocking)"""
        try:
            return self._read_queue.get_nowait()
        except asyncio.QueueEmpty:
            return None
    
    async def _send_http_command(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Send command via HTTP"""
        url = f"http://{self.host}:{self.port}/command"
        
        try:
            async with self.session.post(url, json=message) as response:
                if response.status == 200:
                    data = await response.json()
                    return data
                else:
                    return {
                        "error": f"HTTP error {response.status}",
                        "success": False
                    }
        except Exception as e:
            return {"error": str(e), "success": False}
    
    async def _send_tcp_command(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Send command via TCP"""
        # Send command
        data = json.dumps(message).encode() + b'\n'
        await self.write_data(data)
        
        # Wait for response
        try:
            response = await asyncio.wait_for(self._wait_for_response(message["cmd"]), timeout=5.0)
            return response
        except asyncio.TimeoutError:
            return {"error": "Command timeout", "success": False}
    
    async def _send_udp_command(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Send command via UDP"""
        # Send command
        data = json.dumps(message).encode()
        await self.write_data(data)
        
        # Wait for response (UDP is connectionless, so we just wait for any response)
        try:
            response_data = await asyncio.wait_for(
                asyncio.get_event_loop().sock_recv(self.socket, 1024),
                timeout=5.0
            )
            return self._parse_message(response_data) or {"error": "Invalid response"}
        except asyncio.TimeoutError:
            return {"error": "Command timeout", "success": False}
    
    async def _tcp_read_loop(self):
        """Continuously read from TCP socket"""
        buffer = b""
        
        while self.is_connected and self.socket:
            try:
                # Read data
                data = await asyncio.get_event_loop().sock_recv(self.socket, 1024)
                if not data:
                    # Connection closed
                    break
                    
                buffer += data
                
                # Process complete lines
                while b'\n' in buffer:
                    line, buffer = buffer.split(b'\n', 1)
                    if line:
                        parsed = self._parse_message(line)
                        if parsed:
                            await self._read_queue.put(parsed)
                            
            except Exception as e:
                logger.error(f"Error in TCP read loop: {e}")
                await asyncio.sleep(0.1)
    
    async def _wait_for_response(self, command: str) -> Dict[str, Any]:
        """Wait for a response to a specific command"""
        while True:
            data = await self.read_data()
            if data:
                if data.get("response_to") == command or data.get("cmd") == command:
                    return data
                await self._read_queue.put(data)
            await asyncio.sleep(0.01)