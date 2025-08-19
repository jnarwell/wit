# software/backend/core/machine_manager.py
"""
W.I.T. Machine Manager
Central management for all machines, integrating with existing printer code
"""
import asyncio
import logging
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime

from .machine_interface import IMachine, MachineCommandResponse
from .machine_types import MachineType, MachineCapability, PrinterState, ConnectionProtocol
from .state_manager import get_state_manager, MachineStateData, StateChangeEvent
from .discovery_service import get_discovery_service, DiscoveredMachine
from .machine_implementations import GCodePrinter, OctoPrintPrinter
from .connections import PrusaLinkConnection, HTTPConnection


class MachineManager:
    """Central manager for all machines in the system"""
    
    def __init__(self, logger: Optional[logging.Logger] = None):
        self.logger = logger or logging.getLogger("machine_manager")
        self._machines: Dict[str, IMachine] = {}
        self._state_manager = get_state_manager()
        self._discovery_service = get_discovery_service()
        self._discovery_enabled = False
        
        # Callbacks for integration
        self._on_machine_added: List[Callable[[str, IMachine], None]] = []
        self._on_machine_removed: List[Callable[[str], None]] = []
        self._on_state_changed: List[Callable[[StateChangeEvent], None]] = []
        
        # Setup discovery listener
        self._discovery_service.add_discovery_listener(self._on_machine_discovered)
        
        # Setup state change listener
        self._state_manager.add_state_listener(self._on_state_change)
        
    async def initialize(self):
        """Initialize the machine manager"""
        self.logger.info("Initializing Machine Manager")
        
        # Start discovery if enabled
        if self._discovery_enabled:
            await self.start_discovery()
            
    async def shutdown(self):
        """Shutdown the machine manager"""
        self.logger.info("Shutting down Machine Manager")
        
        # Stop discovery
        await self.stop_discovery()
        
        # Disconnect all machines
        for machine_id in list(self._machines.keys()):
            await self.remove_machine(machine_id)
            
    # Machine Management
    
    async def add_machine(self, machine_id: str, machine: IMachine) -> bool:
        """Add a machine to management"""
        if machine_id in self._machines:
            self.logger.warning(f"Machine {machine_id} already exists")
            return False
            
        self._machines[machine_id] = machine
        
        # Connect if not already connected
        if not await machine.connection.is_connected():
            if not await machine.connection.connect():
                self.logger.error(f"Failed to connect to machine {machine_id}")
                del self._machines[machine_id]
                return False
                
        # Register with state manager
        await self._state_manager.register_machine(machine_id, machine.machine_type)
        
        # Get initial state
        state = await machine.get_current_state()
        await self._state_manager.update_state(machine_id, state.value)
        
        self.logger.info(f"Added machine {machine_id} of type {machine.machine_type.value}")
        
        # Notify callbacks
        for callback in self._on_machine_added:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(machine_id, machine)
                else:
                    callback(machine_id, machine)
            except Exception as e:
                self.logger.error(f"Error in machine added callback: {e}")
                
        return True
        
    async def remove_machine(self, machine_id: str) -> bool:
        """Remove a machine from management"""
        if machine_id not in self._machines:
            return False
            
        machine = self._machines[machine_id]
        
        # Disconnect
        await machine.connection.disconnect()
        
        # Unregister from state manager
        await self._state_manager.unregister_machine(machine_id)
        
        # Remove from dict
        del self._machines[machine_id]
        
        self.logger.info(f"Removed machine {machine_id}")
        
        # Notify callbacks
        for callback in self._on_machine_removed:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(machine_id)
                else:
                    callback(machine_id)
            except Exception as e:
                self.logger.error(f"Error in machine removed callback: {e}")
                
        return True
        
    def get_machine(self, machine_id: str) -> Optional[IMachine]:
        """Get a specific machine"""
        return self._machines.get(machine_id)
        
    def get_all_machines(self) -> Dict[str, IMachine]:
        """Get all machines"""
        return self._machines.copy()
        
    async def get_machine_status(self, machine_id: str) -> Optional[Dict[str, Any]]:
        """Get comprehensive status for a machine"""
        machine = self.get_machine(machine_id)
        if not machine:
            return None
            
        state_data = await self._state_manager.get_state(machine_id)
        if not state_data:
            return None
            
        # Build status response compatible with existing code
        status = {
            "id": machine_id,
            "connected": await machine.connection.is_connected(),
            "state": {
                "text": state_data.state.value,
                "color": self._get_state_color(state_data.state)
            },
            "telemetry": {},
            "job": state_data.current_job,
            "progress": state_data.job_progress,
            "time_remaining": state_data.time_remaining,
            "capabilities": [cap.value for cap in await machine.get_capabilities()]
        }
        
        # Add temperature data
        temps = await machine.get_temperatures()
        if "hotend" in temps:
            status["telemetry"]["temp-nozzle"] = temps["hotend"][0]
            status["telemetry"]["temp-nozzle-target"] = temps["hotend"][1]
        if "bed" in temps:
            status["telemetry"]["temp-bed"] = temps["bed"][0]
            status["telemetry"]["temp-bed-target"] = temps["bed"][1]
            
        return status
        
    def _get_state_color(self, state: PrinterState) -> str:
        """Get color for state (compatible with existing UI)"""
        if state in [PrinterState.IDLE, PrinterState.COMPLETE]:
            return "green"
        elif state in [PrinterState.PRINTING, PrinterState.PAUSED, PrinterState.PREPARING]:
            return "yellow"
        elif state in [PrinterState.ERROR, PrinterState.DISCONNECTED]:
            return "red"
        else:
            return "gray"
            
    # Discovery Integration
    
    async def start_discovery(self, continuous: bool = True, interval: int = 30):
        """Start machine discovery"""
        self.logger.info("Starting machine discovery")
        self._discovery_enabled = True
        
        if continuous:
            await self._discovery_service.start_continuous_discovery(interval)
        else:
            await self._discovery_service.discover_once()
            
    async def stop_discovery(self):
        """Stop machine discovery"""
        self.logger.info("Stopping machine discovery")
        self._discovery_enabled = False
        await self._discovery_service.stop_continuous_discovery()
        
    async def _on_machine_discovered(self, discovered: DiscoveredMachine):
        """Handle discovered machine"""
        self.logger.info(f"Discovered machine: {discovered.name} ({discovered.discovery_id})")
        
        # Check if already managed
        if discovered.discovery_id in self._machines:
            return
            
        # Auto-add based on connection type
        if discovered.connection_protocol == ConnectionProtocol.SERIAL_GCODE:
            # Create serial printer
            machine = GCodePrinter(
                discovered.discovery_id,
                discovered.connection_params["port"],
                discovered.connection_params.get("baudrate", 115200)
            )
            await self.add_machine(discovered.discovery_id, machine)
            
        elif discovered.connection_protocol == ConnectionProtocol.OCTOPRINT:
            # OctoPrint requires API key - skip auto-add
            self.logger.info(f"OctoPrint discovered at {discovered.connection_params['base_url']} - needs API key")
            
    # Command Execution
    
    async def execute_command(self, machine_id: str, command: str, **kwargs) -> MachineCommandResponse:
        """Execute a command on a machine"""
        machine = self.get_machine(machine_id)
        if not machine:
            return MachineCommandResponse.error("Machine not found", "NOT_FOUND")
            
        # Map command names to methods
        command_map = {
            "START": machine.start,
            "PAUSE": machine.pause,
            "RESUME": machine.resume,
            "CANCEL": machine.cancel,
            "HOME": machine.home,
            "JOG": machine.jog,
            "SET_TEMPERATURE": machine.set_temperature,
            "EMERGENCY_STOP": machine.emergency_stop,
        }
        
        command_func = command_map.get(command.upper())
        if not command_func:
            return MachineCommandResponse.error(f"Unknown command: {command}", "UNKNOWN_COMMAND")
            
        try:
            return await command_func(**kwargs)
        except Exception as e:
            self.logger.error(f"Error executing command {command} on {machine_id}: {e}")
            return MachineCommandResponse.error(str(e), "EXECUTION_ERROR")
            
    # State Management
    
    def _on_state_change(self, event: StateChangeEvent):
        """Handle state change events"""
        # Notify callbacks
        for callback in self._on_state_changed:
            try:
                if asyncio.iscoroutinefunction(callback):
                    asyncio.create_task(callback(event))
                else:
                    callback(event)
            except Exception as e:
                self.logger.error(f"Error in state change callback: {e}")
                
    # Callback Management
    
    def add_machine_added_callback(self, callback: Callable[[str, IMachine], None]):
        """Add callback for when machines are added"""
        self._on_machine_added.append(callback)
        
    def add_machine_removed_callback(self, callback: Callable[[str], None]):
        """Add callback for when machines are removed"""
        self._on_machine_removed.append(callback)
        
    def add_state_changed_callback(self, callback: Callable[[StateChangeEvent], None]):
        """Add callback for state changes"""
        self._on_state_changed.append(callback)
        
    # Legacy Integration Methods
    
    async def create_from_legacy_config(self, config: Dict[str, Any]) -> Optional[str]:
        """Create machine from legacy printer configuration"""
        machine_id = config.get("id", config.get("printer_id"))
        if not machine_id:
            return None
            
        connection_type = config.get("connection_type", "")
        
        if connection_type == "serial":
            machine = GCodePrinter(
                machine_id,
                config.get("port", "/dev/ttyUSB0"),
                config.get("baudrate", 115200)
            )
            
        elif connection_type == "octoprint":
            base_url = config.get("url", config.get("base_url", ""))
            api_key = config.get("api_key", config.get("password", ""))
            if not base_url or not api_key:
                self.logger.error(f"Missing URL or API key for OctoPrint {machine_id}")
                return None
                
            machine = OctoPrintPrinter(machine_id, base_url, api_key)
            
        elif connection_type == "prusalink":
            # Create PrusaLink printer (would need implementation)
            base_url = config.get("url", "")
            password = config.get("password", "")
            if not base_url:
                self.logger.error(f"Missing URL for PrusaLink {machine_id}")
                return None
                
            # For now, treat as HTTP printer
            connection = PrusaLinkConnection(base_url, password)
            from .machine_interface import BaseMachine
            machine = BaseMachine(machine_id, MachineType.PRINTER_3D_FDM, connection)
            
        else:
            self.logger.warning(f"Unknown connection type: {connection_type}")
            return None
            
        if await self.add_machine(machine_id, machine):
            return machine_id
        return None
        
    async def get_legacy_status(self, machine_id: str) -> Dict[str, Any]:
        """Get status in legacy format"""
        status = await self.get_machine_status(machine_id)
        if not status:
            return {
                "connected": False,
                "state": {"text": "Not Found", "color": "red"},
                "telemetry": {
                    "temp-nozzle": 0,
                    "temp-nozzle-target": 0,
                    "temp-bed": 0,
                    "temp-bed-target": 0
                }
            }
        return status


# Global machine manager instance
_machine_manager: Optional[MachineManager] = None

def get_machine_manager() -> MachineManager:
    """Get the global machine manager instance"""
    global _machine_manager
    if _machine_manager is None:
        _machine_manager = MachineManager()
    return _machine_manager