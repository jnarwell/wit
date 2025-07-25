# software/backend/services/microcontrollers/base_connection.py
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import asyncio


class BaseConnection(ABC):
    """Base class for all microcontroller connections"""
    
    def __init__(self, connection_string: str, params: Dict[str, Any]):
        self.connection_string = connection_string
        self.params = params
        self.is_connected = False
        self._read_queue = asyncio.Queue()
        
    @abstractmethod
    async def connect(self) -> bool:
        """Establish connection to the microcontroller"""
        pass
    
    @abstractmethod
    async def disconnect(self):
        """Close the connection"""
        pass
    
    @abstractmethod
    async def send_command(self, command: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Send a command and wait for response"""
        pass
    
    @abstractmethod
    async def write_data(self, data: bytes):
        """Write raw data to the device"""
        pass
    
    @abstractmethod
    async def read_data(self) -> Optional[Dict[str, Any]]:
        """Read data from the device (non-blocking)"""
        pass
    
    def _parse_message(self, data: bytes) -> Optional[Dict[str, Any]]:
        """Parse incoming message from device"""
        try:
            # Try to decode as JSON first
            import json
            message = data.decode('utf-8').strip()
            if message.startswith('{') and message.endswith('}'):
                return json.loads(message)
            
            # Otherwise, return as plain text
            return {"type": "text", "message": message}
            
        except Exception:
            # Return as raw bytes if parsing fails
            return {"type": "raw", "data": data.hex()}