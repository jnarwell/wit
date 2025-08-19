# software/backend/core/state_manager.py
"""
W.I.T. Machine State Management
Handles state tracking, normalization, and event notifications

Inspired by OctoEverywhere's state translation pattern
"""
import asyncio
import logging
from typing import Dict, Any, Optional, Callable, List, Set
from datetime import datetime
from dataclasses import dataclass, field
import json

from .machine_types import MachineType, PrinterState, get_machine_config


@dataclass
class MachineStateData:
    """Complete state data for a machine"""
    machine_id: str
    machine_type: MachineType
    state: PrinterState = PrinterState.UNKNOWN
    previous_state: Optional[PrinterState] = None
    state_details: Optional[str] = None
    last_update: datetime = field(default_factory=datetime.now)
    
    # Job information
    current_job: Optional[Dict[str, Any]] = None
    job_progress: Optional[float] = None
    time_remaining: Optional[int] = None
    
    # Temperature data
    temperatures: Dict[str, Dict[str, float]] = field(default_factory=dict)
    
    # Position data
    position: Dict[str, float] = field(default_factory=dict)
    
    # Capabilities
    capabilities: List[str] = field(default_factory=list)
    
    # Raw platform state (before normalization)
    platform_state: Optional[str] = None
    
    # Additional metadata
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            "machine_id": self.machine_id,
            "machine_type": self.machine_type.value,
            "state": self.state.value,
            "previous_state": self.previous_state.value if self.previous_state else None,
            "state_details": self.state_details,
            "last_update": self.last_update.isoformat(),
            "current_job": self.current_job,
            "job_progress": self.job_progress,
            "time_remaining": self.time_remaining,
            "temperatures": self.temperatures,
            "position": self.position,
            "capabilities": self.capabilities,
            "platform_state": self.platform_state,
            "metadata": self.metadata
        }


class StateChangeEvent:
    """Event fired when machine state changes"""
    
    def __init__(self, machine_id: str, old_state: PrinterState, new_state: PrinterState, 
                 state_data: MachineStateData):
        self.machine_id = machine_id
        self.old_state = old_state
        self.new_state = new_state
        self.state_data = state_data
        self.timestamp = datetime.now()


class MachineStateManager:
    """Manage state for all connected machines"""
    
    def __init__(self, logger: Optional[logging.Logger] = None):
        self.logger = logger or logging.getLogger("state_manager")
        self._states: Dict[str, MachineStateData] = {}
        self._state_listeners: List[Callable[[StateChangeEvent], None]] = []
        self._update_listeners: Dict[str, List[Callable[[MachineStateData], None]]] = {}
        self._lock = asyncio.Lock()
        
    async def register_machine(self, machine_id: str, machine_type: MachineType) -> MachineStateData:
        """Register a new machine for state tracking"""
        async with self._lock:
            if machine_id not in self._states:
                self._states[machine_id] = MachineStateData(
                    machine_id=machine_id,
                    machine_type=machine_type,
                    state=PrinterState.DISCONNECTED
                )
                self.logger.info(f"Registered machine {machine_id} of type {machine_type.value}")
            return self._states[machine_id]
            
    async def unregister_machine(self, machine_id: str) -> bool:
        """Remove a machine from state tracking"""
        async with self._lock:
            if machine_id in self._states:
                del self._states[machine_id]
                if machine_id in self._update_listeners:
                    del self._update_listeners[machine_id]
                self.logger.info(f"Unregistered machine {machine_id}")
                return True
            return False
            
    async def update_state(self, machine_id: str, platform_state: str, 
                          additional_data: Optional[Dict[str, Any]] = None) -> Optional[MachineStateData]:
        """Update machine state from platform-specific state"""
        async with self._lock:
            if machine_id not in self._states:
                self.logger.warning(f"Unknown machine {machine_id}")
                return None
                
            state_data = self._states[machine_id]
            old_state = state_data.state
            
            # Normalize the platform state
            machine_config = get_machine_config(state_data.machine_type)
            if machine_config:
                state_mapping = machine_config.get("state_mapping", {})
                new_state = state_mapping.get(platform_state, PrinterState.UNKNOWN)
            else:
                new_state = PrinterState.UNKNOWN
                
            # Update state data
            state_data.platform_state = platform_state
            state_data.state = new_state
            state_data.previous_state = old_state
            state_data.last_update = datetime.now()
            
            # Update additional data if provided
            if additional_data:
                if "job" in additional_data:
                    state_data.current_job = additional_data["job"]
                if "progress" in additional_data:
                    state_data.job_progress = additional_data["progress"]
                if "time_remaining" in additional_data:
                    state_data.time_remaining = additional_data["time_remaining"]
                if "temperatures" in additional_data:
                    state_data.temperatures = additional_data["temperatures"]
                if "position" in additional_data:
                    state_data.position = additional_data["position"]
                if "metadata" in additional_data:
                    state_data.metadata.update(additional_data["metadata"])
                    
            # Fire state change event if state changed
            if old_state != new_state:
                self.logger.info(f"Machine {machine_id} state changed: {old_state.value} -> {new_state.value}")
                event = StateChangeEvent(machine_id, old_state, new_state, state_data)
                await self._fire_state_change(event)
                
            # Fire update listeners
            await self._fire_update(machine_id, state_data)
            
            return state_data
            
    async def get_state(self, machine_id: str) -> Optional[MachineStateData]:
        """Get current state for a machine"""
        async with self._lock:
            return self._states.get(machine_id)
            
    async def get_all_states(self) -> Dict[str, MachineStateData]:
        """Get states for all machines"""
        async with self._lock:
            return self._states.copy()
            
    def add_state_listener(self, listener: Callable[[StateChangeEvent], None]):
        """Add a listener for all state changes"""
        self._state_listeners.append(listener)
        
    def remove_state_listener(self, listener: Callable[[StateChangeEvent], None]):
        """Remove a state change listener"""
        if listener in self._state_listeners:
            self._state_listeners.remove(listener)
            
    def add_update_listener(self, machine_id: str, listener: Callable[[MachineStateData], None]):
        """Add a listener for updates to a specific machine"""
        if machine_id not in self._update_listeners:
            self._update_listeners[machine_id] = []
        self._update_listeners[machine_id].append(listener)
        
    def remove_update_listener(self, machine_id: str, listener: Callable[[MachineStateData], None]):
        """Remove an update listener"""
        if machine_id in self._update_listeners:
            listeners = self._update_listeners[machine_id]
            if listener in listeners:
                listeners.remove(listener)
                
    async def _fire_state_change(self, event: StateChangeEvent):
        """Fire state change event to all listeners"""
        for listener in self._state_listeners:
            try:
                if asyncio.iscoroutinefunction(listener):
                    await listener(event)
                else:
                    listener(event)
            except Exception as e:
                self.logger.error(f"Error in state change listener: {e}")
                
    async def _fire_update(self, machine_id: str, state_data: MachineStateData):
        """Fire update event to machine-specific listeners"""
        if machine_id in self._update_listeners:
            for listener in self._update_listeners[machine_id]:
                try:
                    if asyncio.iscoroutinefunction(listener):
                        await listener(state_data)
                    else:
                        listener(state_data)
                except Exception as e:
                    self.logger.error(f"Error in update listener: {e}")


class StateTransitionValidator:
    """Validate state transitions based on machine type"""
    
    # Valid state transitions for most machines
    VALID_TRANSITIONS = {
        PrinterState.DISCONNECTED: {PrinterState.CONNECTING, PrinterState.IDLE, PrinterState.ERROR},
        PrinterState.CONNECTING: {PrinterState.IDLE, PrinterState.ERROR, PrinterState.DISCONNECTED},
        PrinterState.IDLE: {PrinterState.PREPARING, PrinterState.PRINTING, PrinterState.MAINTENANCE, 
                           PrinterState.ERROR, PrinterState.DISCONNECTED},
        PrinterState.PREPARING: {PrinterState.PRINTING, PrinterState.IDLE, PrinterState.ERROR, 
                                PrinterState.CANCELLED},
        PrinterState.PRINTING: {PrinterState.PAUSING, PrinterState.COMPLETING, PrinterState.CANCELLING, 
                               PrinterState.ERROR},
        PrinterState.PAUSING: {PrinterState.PAUSED, PrinterState.PRINTING, PrinterState.ERROR},
        PrinterState.PAUSED: {PrinterState.RESUMING, PrinterState.CANCELLING, PrinterState.ERROR},
        PrinterState.RESUMING: {PrinterState.PRINTING, PrinterState.PAUSED, PrinterState.ERROR},
        PrinterState.COMPLETING: {PrinterState.COMPLETE, PrinterState.ERROR},
        PrinterState.COMPLETE: {PrinterState.IDLE},
        PrinterState.CANCELLING: {PrinterState.CANCELLED, PrinterState.ERROR},
        PrinterState.CANCELLED: {PrinterState.IDLE},
        PrinterState.ERROR: {PrinterState.IDLE, PrinterState.DISCONNECTED},
        PrinterState.MAINTENANCE: {PrinterState.IDLE, PrinterState.ERROR}
    }
    
    @classmethod
    def is_valid_transition(cls, from_state: PrinterState, to_state: PrinterState) -> bool:
        """Check if a state transition is valid"""
        if from_state == to_state:
            return True  # Same state is always valid
        if from_state == PrinterState.UNKNOWN:
            return True  # Can transition from unknown to any state
        if to_state == PrinterState.UNKNOWN:
            return False  # Should not transition TO unknown
            
        valid_next_states = cls.VALID_TRANSITIONS.get(from_state, set())
        return to_state in valid_next_states


# Global state manager instance
_state_manager: Optional[MachineStateManager] = None

def get_state_manager() -> MachineStateManager:
    """Get the global state manager instance"""
    global _state_manager
    if _state_manager is None:
        _state_manager = MachineStateManager()
    return _state_manager