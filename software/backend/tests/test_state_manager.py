# software/backend/tests/test_state_manager.py
"""
Test the state management system
"""
import pytest
import asyncio
from datetime import datetime
from unittest.mock import Mock, AsyncMock

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.state_manager import (
    MachineStateManager, MachineStateData, StateChangeEvent,
    StateTransitionValidator, get_state_manager
)
from core.machine_types import MachineType, PrinterState
from core.machine_implementations import GCodePrinter, OctoPrintPrinter


@pytest.mark.asyncio
class TestMachineStateData:
    """Test state data structure"""
    
    def test_state_data_creation(self):
        state = MachineStateData(
            machine_id="test-001",
            machine_type=MachineType.PRINTER_3D_FDM,
            state=PrinterState.IDLE
        )
        
        assert state.machine_id == "test-001"
        assert state.machine_type == MachineType.PRINTER_3D_FDM
        assert state.state == PrinterState.IDLE
        assert state.previous_state is None
        assert isinstance(state.last_update, datetime)
        
    def test_state_data_to_dict(self):
        state = MachineStateData(
            machine_id="test-001",
            machine_type=MachineType.PRINTER_3D_FDM,
            state=PrinterState.PRINTING,
            job_progress=50.0,
            temperatures={"hotend": {"current": 200, "target": 210}}
        )
        
        data = state.to_dict()
        
        assert data["machine_id"] == "test-001"
        assert data["machine_type"] == "3d_printer_fdm"
        assert data["state"] == "printing"
        assert data["job_progress"] == 50.0
        assert data["temperatures"]["hotend"]["current"] == 200


@pytest.mark.asyncio
class TestMachineStateManager:
    """Test state manager"""
    
    async def test_register_machine(self):
        manager = MachineStateManager()
        
        state = await manager.register_machine("test-001", MachineType.PRINTER_3D_FDM)
        
        assert state.machine_id == "test-001"
        assert state.machine_type == MachineType.PRINTER_3D_FDM
        assert state.state == PrinterState.DISCONNECTED
        
        # Register again should return same instance
        state2 = await manager.register_machine("test-001", MachineType.PRINTER_3D_FDM)
        assert state is state2
        
    async def test_update_state(self):
        manager = MachineStateManager()
        await manager.register_machine("test-001", MachineType.PRINTER_3D_FDM)
        
        # Update with platform state
        updated = await manager.update_state("test-001", "PRINTING", {
            "progress": 25.0,
            "job": {"file": "test.gcode"}
        })
        
        assert updated is not None
        assert updated.state == PrinterState.PRINTING
        assert updated.platform_state == "PRINTING"
        assert updated.job_progress == 25.0
        assert updated.current_job["file"] == "test.gcode"
        
    async def test_state_change_event(self):
        manager = MachineStateManager()
        await manager.register_machine("test-001", MachineType.PRINTER_3D_FDM)
        
        # Track state changes
        events = []
        def listener(event: StateChangeEvent):
            events.append(event)
            
        manager.add_state_listener(listener)
        
        # First change DISCONNECTED -> IDLE  
        await manager.update_state("test-001", "OPERATIONAL")
        # Then IDLE -> PRINTING
        await manager.update_state("test-001", "PRINTING")
        
        assert len(events) == 2
        assert events[0].old_state == PrinterState.DISCONNECTED
        assert events[0].new_state == PrinterState.IDLE
        assert events[1].old_state == PrinterState.IDLE
        assert events[1].new_state == PrinterState.PRINTING
        
    async def test_update_listeners(self):
        manager = MachineStateManager()
        await manager.register_machine("test-001", MachineType.PRINTER_3D_FDM)
        
        # Track updates - store copies of the progress values
        progress_updates = []
        def listener(state: MachineStateData):
            progress_updates.append(state.job_progress)
            
        manager.add_update_listener("test-001", listener)
        
        # Trigger updates
        await manager.update_state("test-001", "OPERATIONAL")  # Initial state
        progress_updates.clear()  # Clear initial update
        
        await manager.update_state("test-001", "PRINTING", {"progress": 10})
        await manager.update_state("test-001", "PRINTING", {"progress": 20})
        
        assert len(progress_updates) == 2
        assert progress_updates[0] == 10
        assert progress_updates[1] == 20
        
    async def test_state_normalization(self):
        manager = MachineStateManager()
        await manager.register_machine("test-001", MachineType.PRINTER_3D_FDM)
        await manager.register_machine("test-002", MachineType.PRINTER_3D_COREXY)
        
        # Test OctoPrint state mapping
        await manager.update_state("test-001", "OPERATIONAL")
        state1 = await manager.get_state("test-001")
        assert state1.state == PrinterState.IDLE
        
        # Test Klipper/Bambu state mapping  
        await manager.update_state("test-002", "ready")
        state2 = await manager.get_state("test-002")
        assert state2.state == PrinterState.IDLE


class TestStateTransitionValidator:
    """Test state transition validation"""
    
    def test_valid_transitions(self):
        # Valid transitions
        assert StateTransitionValidator.is_valid_transition(
            PrinterState.IDLE, PrinterState.PREPARING
        ) == True
        assert StateTransitionValidator.is_valid_transition(
            PrinterState.PRINTING, PrinterState.PAUSING
        ) == True
        assert StateTransitionValidator.is_valid_transition(
            PrinterState.PAUSED, PrinterState.RESUMING
        ) == True
        
    def test_invalid_transitions(self):
        # Invalid transitions
        assert StateTransitionValidator.is_valid_transition(
            PrinterState.IDLE, PrinterState.PAUSED
        ) == False
        assert StateTransitionValidator.is_valid_transition(
            PrinterState.PRINTING, PrinterState.IDLE
        ) == False
        
    def test_special_transitions(self):
        # Same state is valid
        assert StateTransitionValidator.is_valid_transition(
            PrinterState.IDLE, PrinterState.IDLE
        ) == True
        
        # From UNKNOWN is valid
        assert StateTransitionValidator.is_valid_transition(
            PrinterState.UNKNOWN, PrinterState.IDLE
        ) == True
        
        # TO UNKNOWN is invalid
        assert StateTransitionValidator.is_valid_transition(
            PrinterState.IDLE, PrinterState.UNKNOWN
        ) == False


@pytest.mark.asyncio  
class TestMachineImplementations:
    """Test concrete machine implementations"""
    
    async def test_gcode_printer_state_flow(self):
        # Mock serial connection
        from unittest.mock import patch, MagicMock
        
        with patch('core.machine_implementations.GCodeConnection') as mock_conn_class:
            mock_conn = AsyncMock()
            mock_conn.connect = AsyncMock(return_value=True)
            mock_conn.send_command = AsyncMock(
                return_value=Mock(success=True, data={})
            )
            mock_conn_class.return_value = mock_conn
            
            printer = GCodePrinter("test-001", "/dev/ttyUSB0")
            
            # Connect
            assert await printer.connect() == True
            assert await printer.get_current_state() == PrinterState.IDLE
            
            # Start printing
            response = await printer.start("test.gcode")
            assert response.success == True
            assert await printer.get_current_state() == PrinterState.PRINTING
            
            # Pause
            response = await printer.pause()
            assert response.success == True
            assert await printer.get_current_state() == PrinterState.PAUSED
            
            # Resume
            response = await printer.resume()
            assert response.success == True
            assert await printer.get_current_state() == PrinterState.PRINTING
            
            # Cancel
            response = await printer.cancel()
            assert response.success == True
            assert await printer.get_current_state() == PrinterState.CANCELLED


if __name__ == "__main__":
    print("Running state management tests...")
    
    # Test MachineStateData
    test_data = TestMachineStateData()
    test_data.test_state_data_creation()
    test_data.test_state_data_to_dict()
    print("✅ MachineStateData tests passed")
    
    # Test MachineStateManager
    test_manager = TestMachineStateManager()
    asyncio.run(test_manager.test_register_machine())
    asyncio.run(test_manager.test_update_state())
    asyncio.run(test_manager.test_state_change_event())
    asyncio.run(test_manager.test_update_listeners())
    asyncio.run(test_manager.test_state_normalization())
    print("✅ MachineStateManager tests passed")
    
    # Test StateTransitionValidator
    test_validator = TestStateTransitionValidator()
    test_validator.test_valid_transitions()
    test_validator.test_invalid_transitions()
    test_validator.test_special_transitions()
    print("✅ StateTransitionValidator tests passed")
    
    # Test implementations
    test_impl = TestMachineImplementations()
    asyncio.run(test_impl.test_gcode_printer_state_flow())
    print("✅ Machine implementation tests passed")
    
    print("\n✅ All state management tests passed!")