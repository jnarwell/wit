# software/backend/tests/test_machine_interface.py
"""
Test the base machine interface classes
"""
import pytest
import asyncio
from typing import Dict, Any, Optional, Tuple, List

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.machine_interface import (
    MachineCommandResponse, IMachineConnection, BaseMachine
)
from core.machine_types import MachineType, MachineCapability, PrinterState


class MockConnection(IMachineConnection):
    """Mock connection for testing"""
    
    def __init__(self):
        self._connected = False
        self._commands_sent = []
        
    async def connect(self) -> bool:
        self._connected = True
        return True
    
    async def disconnect(self) -> bool:
        self._connected = False
        return True
    
    async def is_connected(self) -> bool:
        return self._connected
    
    async def send_command(self, command: str, params: Optional[Dict[str, Any]] = None) -> MachineCommandResponse:
        self._commands_sent.append((command, params))
        return MachineCommandResponse.success({"command": command, "params": params})


class TestMachine(BaseMachine):
    """Test implementation of BaseMachine"""
    
    def __init__(self, machine_id: str):
        connection = MockConnection()
        super().__init__(machine_id, MachineType.PRINTER_3D_FDM, connection)
        self._capabilities = [
            MachineCapability.START,
            MachineCapability.PAUSE,
            MachineCapability.CANCEL
        ]
        self._state = PrinterState.IDLE
        
    async def get_current_state(self) -> PrinterState:
        return self._state
    
    async def get_temperatures(self) -> Dict[str, Tuple[float, float]]:
        return {"hotend": (200.0, 210.0), "bed": (60.0, 60.0)}
    
    async def get_progress(self) -> Optional[float]:
        return 50.0 if self._state == PrinterState.PRINTING else None
    
    async def get_time_remaining(self) -> Optional[int]:
        return 3600 if self._state == PrinterState.PRINTING else None
    
    async def get_current_job(self) -> Optional[Dict[str, Any]]:
        if self._state == PrinterState.PRINTING:
            return {"file": "test.gcode", "started": "2024-01-01T00:00:00"}
        return None
    
    async def start(self, file_path: Optional[str] = None) -> MachineCommandResponse:
        if self._state != PrinterState.IDLE:
            return MachineCommandResponse.error("Cannot start: not idle")
        self._state = PrinterState.PRINTING
        return MachineCommandResponse.success({"file": file_path})
    
    async def pause(self) -> MachineCommandResponse:
        if self._state != PrinterState.PRINTING:
            return MachineCommandResponse.error("Cannot pause: not printing")
        self._state = PrinterState.PAUSED
        return MachineCommandResponse.success()
    
    async def resume(self) -> MachineCommandResponse:
        if self._state != PrinterState.PAUSED:
            return MachineCommandResponse.error("Cannot resume: not paused")
        self._state = PrinterState.PRINTING
        return MachineCommandResponse.success()
    
    async def cancel(self) -> MachineCommandResponse:
        if self._state not in [PrinterState.PRINTING, PrinterState.PAUSED]:
            return MachineCommandResponse.error("Cannot cancel: not printing")
        self._state = PrinterState.CANCELLED
        return MachineCommandResponse.success()
    
    async def home(self, axes: Optional[List[str]] = None) -> MachineCommandResponse:
        return await self.connection.send_command("G28", {"axes": axes})
    
    async def jog(self, axis: str, distance: float, speed: Optional[float] = None) -> MachineCommandResponse:
        return await self.connection.send_command("G91", {"axis": axis, "distance": distance})
    
    async def set_temperature(self, zone: str, target: float) -> MachineCommandResponse:
        return await self.connection.send_command("M104", {"zone": zone, "target": target})
    
    async def emergency_stop(self) -> MachineCommandResponse:
        self._state = PrinterState.ERROR
        return await self.connection.send_command("M112")
    
    async def upload_file(self, file_path: str, content: bytes) -> MachineCommandResponse:
        return MachineCommandResponse.success({"path": file_path, "size": len(content)})
    
    async def list_files(self, path: Optional[str] = None) -> List[Dict[str, Any]]:
        return [{"name": "test.gcode", "size": 1024, "modified": "2024-01-01T00:00:00"}]
    
    async def delete_file(self, file_path: str) -> MachineCommandResponse:
        return MachineCommandResponse.success({"deleted": file_path})


@pytest.mark.asyncio
async def test_machine_command_response():
    """Test MachineCommandResponse creation"""
    # Test success response
    resp = MachineCommandResponse.success({"value": 42})
    assert resp.success == True
    assert resp.data["value"] == 42
    assert resp.error_message is None
    
    # Test error response
    resp = MachineCommandResponse.error("Connection failed", "CONN_ERR")
    assert resp.success == False
    assert resp.error_message == "Connection failed"
    assert resp.error_code == "CONN_ERR"


@pytest.mark.asyncio
async def test_mock_connection():
    """Test the mock connection"""
    conn = MockConnection()
    
    # Test connection
    assert await conn.is_connected() == False
    assert await conn.connect() == True
    assert await conn.is_connected() == True
    
    # Test sending commands
    resp = await conn.send_command("TEST", {"param": "value"})
    assert resp.success == True
    assert resp.data["command"] == "TEST"
    assert conn._commands_sent[-1] == ("TEST", {"param": "value"})
    
    # Test disconnect
    assert await conn.disconnect() == True
    assert await conn.is_connected() == False


@pytest.mark.asyncio
async def test_base_machine():
    """Test BaseMachine implementation"""
    machine = TestMachine("test-001")
    
    # Test info
    info = await machine.get_info()
    assert info["id"] == "test-001"
    assert info["type"] == "3d_printer_fdm"
    assert info["state"] == "idle"
    assert info["connected"] == False
    
    # Test capabilities
    caps = await machine.get_capabilities()
    assert MachineCapability.START in caps
    assert MachineCapability.PAUSE in caps
    assert MachineCapability.CANCEL in caps
    
    # Test connection
    await machine.connection.connect()
    info = await machine.get_info()
    assert info["connected"] == True


@pytest.mark.asyncio
async def test_machine_state_flow():
    """Test machine state transitions"""
    machine = TestMachine("test-002")
    await machine.connection.connect()
    
    # Initial state
    assert await machine.get_current_state() == PrinterState.IDLE
    assert await machine.get_progress() is None
    
    # Start printing
    resp = await machine.start("test.gcode")
    assert resp.success == True
    assert await machine.get_current_state() == PrinterState.PRINTING
    assert await machine.get_progress() == 50.0
    assert await machine.get_time_remaining() == 3600
    
    # Pause
    resp = await machine.pause()
    assert resp.success == True
    assert await machine.get_current_state() == PrinterState.PAUSED
    
    # Resume
    resp = await machine.resume()
    assert resp.success == True
    assert await machine.get_current_state() == PrinterState.PRINTING
    
    # Cancel
    resp = await machine.cancel()
    assert resp.success == True
    assert await machine.get_current_state() == PrinterState.CANCELLED


@pytest.mark.asyncio
async def test_machine_commands():
    """Test various machine commands"""
    machine = TestMachine("test-003")
    await machine.connection.connect()
    
    # Test temperature reading
    temps = await machine.get_temperatures()
    assert temps["hotend"] == (200.0, 210.0)
    assert temps["bed"] == (60.0, 60.0)
    
    # Test file operations
    files = await machine.list_files()
    assert len(files) == 1
    assert files[0]["name"] == "test.gcode"
    
    resp = await machine.upload_file("new.gcode", b"G28\nG1 X10")
    assert resp.success == True
    assert resp.data["size"] == 10
    
    resp = await machine.delete_file("old.gcode")
    assert resp.success == True
    assert resp.data["deleted"] == "old.gcode"


@pytest.mark.asyncio
async def test_error_conditions():
    """Test error handling"""
    machine = TestMachine("test-004")
    
    # Try to pause when not printing
    resp = await machine.pause()
    assert resp.success == False
    assert "not printing" in resp.error_message
    
    # Try to resume when not paused
    resp = await machine.resume()
    assert resp.success == False
    assert "not paused" in resp.error_message


if __name__ == "__main__":
    print("Running machine interface tests...")
    asyncio.run(test_machine_command_response())
    asyncio.run(test_mock_connection())
    asyncio.run(test_base_machine())
    asyncio.run(test_machine_state_flow())
    asyncio.run(test_machine_commands())
    asyncio.run(test_error_conditions())
    print("✅ All tests passed!")