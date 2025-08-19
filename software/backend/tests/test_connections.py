# software/backend/tests/test_connections.py
"""
Test connection protocol handlers
"""
import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock, MagicMock
import aiohttp

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.connections import (
    ConnectionState, SerialConnection, GCodeConnection,
    HTTPConnection, OctoPrintConnection
)


class TestConnectionState:
    """Test connection state tracking"""
    
    def test_initial_state(self):
        state = ConnectionState()
        assert state.connected == False
        assert state.last_error is None
        assert state.retry_count == 0
        assert state.total_commands == 0
        assert state.failed_commands == 0
        
    def test_mark_success(self):
        state = ConnectionState()
        state.connected = True
        state.retry_count = 3
        state.last_error = "previous error"
        
        state.mark_success()
        
        assert state.last_error is None
        assert state.retry_count == 0
        assert state.total_commands == 1
        assert state.failed_commands == 0
        
    def test_mark_failure(self):
        state = ConnectionState()
        
        state.mark_failure("test error")
        
        assert state.last_error == "test error"
        assert state.retry_count == 1
        assert state.total_commands == 1
        assert state.failed_commands == 1
        
    def test_is_healthy(self):
        state = ConnectionState()
        
        # Not connected
        assert state.is_healthy() == False
        
        # Connected and recent response
        state.connected = True
        state.mark_success()
        assert state.is_healthy() == True
        
        # Connected but timeout
        assert state.is_healthy(timeout_seconds=0) == False


@pytest.mark.asyncio
class TestSerialConnection:
    """Test serial connection handler"""
    
    @patch('serial.Serial')
    @patch('serial.tools.list_ports.comports')
    def test_list_ports(self, mock_comports, mock_serial):
        # Mock port info
        mock_port = Mock()
        mock_port.device = "/dev/ttyUSB0"
        mock_port.description = "USB Serial"
        mock_port.hwid = "USB VID:PID=1234:5678"
        mock_port.vid = 0x1234
        mock_port.pid = 0x5678
        mock_comports.return_value = [mock_port]
        
        ports = SerialConnection.list_ports()
        
        assert len(ports) == 1
        assert ports[0]["port"] == "/dev/ttyUSB0"
        assert ports[0]["description"] == "USB Serial"
        
    @patch('serial.Serial')
    async def test_connect_success(self, mock_serial_class):
        # Mock serial instance
        mock_serial = MagicMock()
        mock_serial.is_open = True
        mock_serial.in_waiting = 0
        mock_serial_class.return_value = mock_serial
        
        conn = SerialConnection("/dev/ttyUSB0", 115200)
        
        # Mock the M115 response
        from core.machine_interface import MachineCommandResponse
        async def mock_send_command(cmd):
            if cmd == "M115":
                return MachineCommandResponse.success({"response": ["ok"]})
            return MachineCommandResponse.error("Unknown")
            
        conn.send_command = mock_send_command
        
        result = await conn.connect()
        
        assert result == True
        assert conn.state.connected == True
        mock_serial.reset_input_buffer.assert_called_once()
        mock_serial.reset_output_buffer.assert_called_once()
        
    @patch('serial.Serial')
    async def test_disconnect(self, mock_serial_class):
        mock_serial = MagicMock()
        mock_serial.is_open = True
        mock_serial_class.return_value = mock_serial
        
        conn = SerialConnection("/dev/ttyUSB0")
        conn._serial = mock_serial
        conn.state.connected = True
        
        result = await conn.disconnect()
        
        assert result == True
        assert conn.state.connected == False
        mock_serial.close.assert_called_once()


@pytest.mark.asyncio
class TestHTTPConnection:
    """Test HTTP connection handler"""
    
    async def test_connection_init(self):
        conn = HTTPConnection("http://localhost:5000", "test-key")
        
        assert conn.base_url == "http://localhost:5000"
        assert conn.api_key == "test-key"
        assert conn._headers["X-Api-Key"] == "test-key"
        
    @patch('aiohttp.ClientSession')
    async def test_connect_success(self, mock_session_class):
        # Create a properly structured mock for aiohttp
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.text = AsyncMock(return_value='{"version": "1.0"}')
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=None)
        
        mock_session = MagicMock()
        mock_session.request = MagicMock(return_value=mock_response)
        mock_session.closed = False
        mock_session.close = AsyncMock()
        
        mock_session_class.return_value = mock_session
        
        conn = HTTPConnection("http://localhost:5000")
        result = await conn.connect()
        
        assert result == True
        assert conn.state.connected == True
        
    async def test_send_command_not_connected(self):
        conn = HTTPConnection("http://localhost:5000")
        
        response = await conn.send_command("GET /api/test")
        
        assert response.success == False
        assert response.error_code == "CONNECTION_ERROR"
        
    @patch('aiohttp.ClientSession')
    async def test_send_command_success(self, mock_session_class):
        # Setup mock
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.text = AsyncMock(return_value='{"result": "ok"}')
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=None)
        
        mock_session = MagicMock()
        mock_session.request = MagicMock(return_value=mock_response)
        mock_session.closed = False
        
        mock_session_class.return_value = mock_session
        
        conn = HTTPConnection("http://localhost:5000")
        conn._session = mock_session
        conn.state.connected = True
        
        response = await conn.send_command("POST /api/command", {"param": "value"})
        
        assert response.success == True
        assert response.data["result"] == "ok"


@pytest.mark.asyncio
class TestOctoPrintConnection:
    """Test OctoPrint-specific connection"""
    
    @patch('aiohttp.ClientSession')
    async def test_octoprint_commands(self, mock_session_class):
        # Setup mock
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.text = AsyncMock(return_value='{}')
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=None)
        
        mock_session = MagicMock()
        mock_session.request = MagicMock(return_value=mock_response)
        mock_session.closed = False
        
        conn = OctoPrintConnection("http://octopi.local", "test-key")
        conn._session = mock_session
        conn.state.connected = True
        
        # Test pause
        result = await conn.pause_job()
        assert result == True
        
        # Verify the request
        mock_session.request.assert_called()
        args = mock_session.request.call_args
        assert args[0][0] == "POST"
        assert args[0][1] == "http://octopi.local/api/job"
        assert args[1]["json"]["command"] == "pause"


if __name__ == "__main__":
    # Run tests
    print("Running connection protocol tests...")
    
    # Test ConnectionState
    test_state = TestConnectionState()
    test_state.test_initial_state()
    test_state.test_mark_success()
    test_state.test_mark_failure()
    test_state.test_is_healthy()
    print("✅ ConnectionState tests passed")
    
    # Test SerialConnection
    test_serial = TestSerialConnection()
    test_serial.test_list_ports()
    asyncio.run(test_serial.test_connect_success())
    asyncio.run(test_serial.test_disconnect())
    print("✅ SerialConnection tests passed")
    
    # Test HTTPConnection
    test_http = TestHTTPConnection()
    asyncio.run(test_http.test_connection_init())
    asyncio.run(test_http.test_connect_success())
    asyncio.run(test_http.test_send_command_not_connected())
    asyncio.run(test_http.test_send_command_success())
    print("✅ HTTPConnection tests passed")
    
    # Test OctoPrintConnection
    test_octo = TestOctoPrintConnection()
    asyncio.run(test_octo.test_octoprint_commands())
    print("✅ OctoPrintConnection tests passed")
    
    print("\n✅ All connection tests passed!")