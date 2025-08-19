# software/backend/core/connections/serial_connection.py
"""
Serial connection handler for machines using serial/USB communication
Supports GCODE, GRBL, and custom serial protocols
"""
import asyncio
import serial
import serial.tools.list_ports
from typing import Optional, Dict, Any, List
import re
from datetime import datetime

from .base_connection import BaseConnection
from ..machine_interface import MachineCommandResponse


class SerialConnection(BaseConnection):
    """Handle serial port connections for machines"""
    
    def __init__(self, port: str, baudrate: int = 115200, timeout: float = 2.0,
                 connection_id: Optional[str] = None):
        super().__init__(connection_id or f"serial_{port}")
        self.port = port
        self.baudrate = baudrate
        self.timeout = timeout
        self._serial: Optional[serial.Serial] = None
        self._read_task: Optional[asyncio.Task] = None
        self._response_queue: asyncio.Queue = asyncio.Queue()
        self._line_ending = b'\n'
        
        # Common response patterns
        self.ok_pattern = re.compile(r'^ok\b', re.IGNORECASE)
        self.error_pattern = re.compile(r'^error:?\s*(.+)', re.IGNORECASE)
        self.busy_pattern = re.compile(r'busy', re.IGNORECASE)
        
    @staticmethod
    def list_ports() -> List[Dict[str, str]]:
        """List available serial ports"""
        ports = []
        for port in serial.tools.list_ports.comports():
            ports.append({
                "port": port.device,
                "description": port.description,
                "hwid": port.hwid,
                "vid": port.vid,
                "pid": port.pid
            })
        return ports
        
    async def connect(self) -> bool:
        """Establish serial connection"""
        try:
            self._serial = serial.Serial(
                port=self.port,
                baudrate=self.baudrate,
                timeout=self.timeout,
                write_timeout=self.timeout
            )
            
            # Clear buffers
            self._serial.reset_input_buffer()
            self._serial.reset_output_buffer()
            
            # Start read task
            self._read_task = asyncio.create_task(self._read_loop())
            
            # Wait for initial response
            await asyncio.sleep(2)
            
            # Send initial command to verify connection
            test_response = await self.send_command("M115")  # Get firmware info
            if test_response.success:
                self.state.connected = True
                self.logger.info(f"Connected to {self.port} at {self.baudrate} baud")
                return True
            else:
                await self.disconnect()
                return False
                
        except Exception as e:
            self.logger.error(f"Failed to connect to {self.port}: {e}")
            self.state.mark_failure(str(e))
            return False
            
    async def disconnect(self) -> bool:
        """Close serial connection"""
        try:
            if self._read_task and not self._read_task.done():
                self._read_task.cancel()
                try:
                    await self._read_task
                except asyncio.CancelledError:
                    pass
                    
            if self._serial and self._serial.is_open:
                self._serial.close()
                
            self.state.connected = False
            self.logger.info(f"Disconnected from {self.port}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error disconnecting: {e}")
            return False
            
    async def is_connected(self) -> bool:
        """Check if serial port is connected and healthy"""
        return self._serial is not None and self._serial.is_open and self.state.is_healthy()
        
    async def send_command(self, command: str, params: Optional[Dict[str, Any]] = None) -> MachineCommandResponse:
        """Send command and wait for response"""
        if not await self.is_connected():
            return MachineCommandResponse.error("Not connected", "CONNECTION_ERROR")
            
        async with self._lock:
            try:
                # Format command with parameters
                if params:
                    # For GCODE, parameters are typically inline (e.g., G1 X10 Y20)
                    param_str = ' '.join(f"{k}{v}" for k, v in params.items())
                    command = f"{command} {param_str}"
                    
                # Clear response queue
                while not self._response_queue.empty():
                    self._response_queue.get_nowait()
                    
                # Send command
                self.logger.debug(f"Sending: {command}")
                self._serial.write(f"{command}\n".encode())
                
                # Wait for response
                response_lines = []
                start_time = datetime.now()
                
                while (datetime.now() - start_time).total_seconds() < self.timeout:
                    try:
                        line = await asyncio.wait_for(
                            self._response_queue.get(), 
                            timeout=0.1
                        )
                        response_lines.append(line)
                        
                        # Check for completion
                        if self.ok_pattern.match(line):
                            self.state.mark_success()
                            return MachineCommandResponse.success({
                                "command": command,
                                "response": response_lines
                            })
                        elif self.error_pattern.match(line):
                            error_match = self.error_pattern.match(line)
                            error_msg = error_match.group(1) if error_match else line
                            self.state.mark_failure(error_msg)
                            return MachineCommandResponse.error(error_msg, "COMMAND_ERROR")
                            
                    except asyncio.TimeoutError:
                        continue
                        
                # Timeout
                self.state.mark_failure("Command timeout")
                return MachineCommandResponse.error("Command timeout", "TIMEOUT")
                
            except Exception as e:
                self.logger.error(f"Error sending command: {e}")
                self.state.mark_failure(str(e))
                return MachineCommandResponse.error(str(e), "SEND_ERROR")
                
    async def _read_loop(self):
        """Continuously read from serial port"""
        buffer = b''
        
        while self.state.connected:
            try:
                if self._serial and self._serial.in_waiting:
                    data = self._serial.read(self._serial.in_waiting)
                    buffer += data
                    
                    # Process complete lines
                    while self._line_ending in buffer:
                        line, buffer = buffer.split(self._line_ending, 1)
                        line_str = line.decode('utf-8', errors='ignore').strip()
                        
                        if line_str:
                            self.logger.debug(f"Received: {line_str}")
                            await self._response_queue.put(line_str)
                            
                else:
                    await asyncio.sleep(0.01)
                    
            except Exception as e:
                self.logger.error(f"Read error: {e}")
                self.state.mark_failure(str(e))
                await asyncio.sleep(1)


class GCodeConnection(SerialConnection):
    """Specialized serial connection for GCODE-based machines"""
    
    def __init__(self, port: str, baudrate: int = 115200):
        super().__init__(port, baudrate)
        
        # GCODE-specific patterns
        self.temp_pattern = re.compile(r'T:([0-9.]+)\s*/([0-9.]+)')
        self.position_pattern = re.compile(r'X:([0-9.-]+)\s*Y:([0-9.-]+)\s*Z:([0-9.-]+)')
        
    async def get_temperature(self) -> Dict[str, float]:
        """Get current temperatures using M105"""
        response = await self.send_command("M105")
        if response.success:
            for line in response.data.get("response", []):
                match = self.temp_pattern.search(line)
                if match:
                    return {
                        "current": float(match.group(1)),
                        "target": float(match.group(2))
                    }
        return {}
        
    async def get_position(self) -> Dict[str, float]:
        """Get current position using M114"""
        response = await self.send_command("M114")
        if response.success:
            for line in response.data.get("response", []):
                match = self.position_pattern.search(line)
                if match:
                    return {
                        "x": float(match.group(1)),
                        "y": float(match.group(2)),
                        "z": float(match.group(3))
                    }
        return {}


class GrblConnection(SerialConnection):
    """Specialized serial connection for GRBL-based CNC machines"""
    
    def __init__(self, port: str, baudrate: int = 115200):
        super().__init__(port, baudrate)
        
        # GRBL-specific patterns
        self.status_pattern = re.compile(r'<([^,]+),MPos:([0-9.-]+),([0-9.-]+),([0-9.-]+)')
        self.alarm_pattern = re.compile(r'ALARM:(\d+)')
        
    async def get_status(self) -> Dict[str, Any]:
        """Get GRBL status using ?"""
        response = await self.send_command("?")
        if response.success:
            for line in response.data.get("response", []):
                match = self.status_pattern.search(line)
                if match:
                    return {
                        "state": match.group(1),
                        "mpos": {
                            "x": float(match.group(2)),
                            "y": float(match.group(3)),
                            "z": float(match.group(4))
                        }
                    }
        return {}