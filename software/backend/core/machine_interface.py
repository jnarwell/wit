# software/backend/core/machine_interface.py
"""
W.I.T. Machine Interface
Base classes for all machine implementations

Inspired by OctoEverywhere's IPlatformCommandHandler pattern
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime
import asyncio
import logging

from .machine_types import MachineType, MachineCapability, PrinterState, ConnectionProtocol

class MachineCommandResponse:
    """Standard response for all machine commands"""
    
    @staticmethod
    def success(data: Optional[Dict[str, Any]] = None) -> 'MachineCommandResponse':
        return MachineCommandResponse(True, data=data)
    
    @staticmethod
    def error(message: str, code: Optional[str] = None) -> 'MachineCommandResponse':
        return MachineCommandResponse(False, error_message=message, error_code=code)
    
    def __init__(self, success: bool, data: Optional[Dict[str, Any]] = None, 
                 error_message: Optional[str] = None, error_code: Optional[str] = None):
        self.success = success
        self.data = data or {}
        self.error_message = error_message
        self.error_code = error_code


class IMachineConnection(ABC):
    """Base interface for all machine connections"""
    
    @abstractmethod
    async def connect(self) -> bool:
        """Establish connection to machine"""
        pass
    
    @abstractmethod
    async def disconnect(self) -> bool:
        """Close connection to machine"""
        pass
    
    @abstractmethod
    async def is_connected(self) -> bool:
        """Check if currently connected"""
        pass
    
    @abstractmethod
    async def send_command(self, command: str, params: Optional[Dict[str, Any]] = None) -> MachineCommandResponse:
        """Send a raw command to the machine"""
        pass


class IMachineStateReporter(ABC):
    """Interface for reporting machine state (based on OctoEverywhere's IPrinterStateReporter)"""
    
    @abstractmethod
    async def get_current_state(self) -> PrinterState:
        """Get the current normalized machine state"""
        pass
    
    @abstractmethod
    async def get_temperatures(self) -> Dict[str, Tuple[float, float]]:
        """Get current/target temperatures for all zones
        Returns: {"hotend": (current, target), "bed": (current, target), ...}
        """
        pass
    
    @abstractmethod
    async def get_progress(self) -> Optional[float]:
        """Get current job progress (0-100) or None if not running"""
        pass
    
    @abstractmethod
    async def get_time_remaining(self) -> Optional[int]:
        """Get estimated time remaining in seconds"""
        pass
    
    @abstractmethod
    async def get_current_job(self) -> Optional[Dict[str, Any]]:
        """Get info about current job"""
        pass


class IMachineCommandHandler(ABC):
    """Interface for handling machine commands (based on OctoEverywhere's IPlatformCommandHandler)"""
    
    @abstractmethod
    async def start(self, file_path: Optional[str] = None) -> MachineCommandResponse:
        """Start a job"""
        pass
    
    @abstractmethod
    async def pause(self) -> MachineCommandResponse:
        """Pause current job"""
        pass
    
    @abstractmethod
    async def resume(self) -> MachineCommandResponse:
        """Resume paused job"""
        pass
    
    @abstractmethod
    async def cancel(self) -> MachineCommandResponse:
        """Cancel current job"""
        pass
    
    @abstractmethod
    async def home(self, axes: Optional[List[str]] = None) -> MachineCommandResponse:
        """Home specified axes (or all if None)"""
        pass
    
    @abstractmethod
    async def jog(self, axis: str, distance: float, speed: Optional[float] = None) -> MachineCommandResponse:
        """Jog an axis by specified distance"""
        pass
    
    @abstractmethod
    async def set_temperature(self, zone: str, target: float) -> MachineCommandResponse:
        """Set target temperature for a zone"""
        pass
    
    @abstractmethod
    async def emergency_stop(self) -> MachineCommandResponse:
        """Execute emergency stop"""
        pass


class IMachine(IMachineStateReporter, IMachineCommandHandler):
    """Complete machine interface combining state and commands"""
    
    @abstractmethod
    async def get_info(self) -> Dict[str, Any]:
        """Get machine info including type, capabilities, version"""
        pass
    
    @abstractmethod
    async def get_capabilities(self) -> List[MachineCapability]:
        """Get list of supported capabilities"""
        pass
    
    @abstractmethod
    async def upload_file(self, file_path: str, content: bytes) -> MachineCommandResponse:
        """Upload a file to the machine"""
        pass
    
    @abstractmethod
    async def list_files(self, path: Optional[str] = None) -> List[Dict[str, Any]]:
        """List files on the machine"""
        pass
    
    @abstractmethod
    async def delete_file(self, file_path: str) -> MachineCommandResponse:
        """Delete a file from the machine"""
        pass


class BaseMachine(IMachine):
    """Base implementation with common functionality"""
    
    def __init__(self, machine_id: str, machine_type: MachineType, 
                 connection: IMachineConnection, logger: Optional[logging.Logger] = None):
        self.machine_id = machine_id
        self.machine_type = machine_type
        self.connection = connection
        self.logger = logger or logging.getLogger(f"machine.{machine_id}")
        self._state = PrinterState.DISCONNECTED
        self._last_update = datetime.now()
        self._capabilities: List[MachineCapability] = []
        
    async def get_info(self) -> Dict[str, Any]:
        """Default implementation"""
        return {
            "id": self.machine_id,
            "type": self.machine_type.value,
            "state": self._state.value,
            "connected": await self.connection.is_connected(),
            "last_update": self._last_update.isoformat(),
            "capabilities": [cap.value for cap in self._capabilities]
        }
    
    async def get_capabilities(self) -> List[MachineCapability]:
        """Return cached capabilities"""
        return self._capabilities
    
    # Subclasses must implement the abstract methods