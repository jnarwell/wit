"""
W.I.T. GRBL Integration

Interface for controlling CNC machines running GRBL firmware.
Supports serial communication, real-time status, job streaming, and safety features.
"""

import asyncio
import serial
import serial.tools.list_ports
import logging
import re
import time
from typing import Optional, Dict, Any, List, Tuple, Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import numpy as np
from collections import deque
import threading

# Configure logging
logger = logging.getLogger(__name__)


class MachineState(Enum):
    """GRBL machine states"""
    IDLE = "Idle"
    RUN = "Run"
    HOLD = "Hold"
    JOG = "Jog"
    ALARM = "Alarm"
    DOOR = "Door"
    CHECK = "Check"
    HOME = "Home"
    SLEEP = "Sleep"
    DISCONNECTED = "Disconnected"


class AlarmCode(Enum):
    """GRBL alarm codes"""
    HARD_LIMIT = 1
    SOFT_LIMIT = 2
    ABORT_CYCLE = 3
    PROBE_FAIL = 4
    PROBE_FAIL_RETRACT = 5
    HOMING_FAIL_RESET = 6
    HOMING_FAIL_DOOR = 7
    HOMING_FAIL_PULLOFF = 8
    HOMING_FAIL_APPROACH = 9


class ErrorCode(Enum):
    """GRBL error codes"""
    EXPECTED_COMMAND = 1
    BAD_NUMBER_FORMAT = 2
    INVALID_STATEMENT = 3
    NEGATIVE_VALUE = 4
    SETTING_DISABLED = 5
    SETTING_MIN_VALUE = 6
    SETTING_MAX_VALUE = 7
    MODAL_GROUP_VIOLATION = 8
    UNSUPPORTED_COMMAND = 9
    GCODE_COMMAND_UNSUPPORTED = 10


@dataclass
class MachinePosition:
    """Machine position in work and machine coordinates"""
    work_x: float = 0.0
    work_y: float = 0.0
    work_z: float = 0.0
    machine_x: float = 0.0
    machine_y: float = 0.0
    machine_z: float = 0.0
    
    def __str__(self):
        return f"WPos: X:{self.work_x:.3f} Y:{self.work_y:.3f} Z:{self.work_z:.3f}"


@dataclass
class MachineStatus:
    """Complete machine status"""
    state: MachineState = MachineState.DISCONNECTED
    position: MachinePosition = field(default_factory=MachinePosition)
    feed_rate: float = 0.0
    spindle_speed: float = 0.0
    feed_override: int = 100
    rapid_override: int = 100
    spindle_override: int = 100
    
    # Status flags
    probe_triggered: bool = False
    limit_triggered: bool = False
    door_open: bool = False
    
    # Buffer state
    planner_blocks: int = 0
    rx_buffer_available: int = 128
    
    # Job info
    line_number: Optional[int] = None
    
    # Alarm/Error
    alarm: Optional[AlarmCode] = None
    error: Optional[ErrorCode] = None
    message: Optional[str] = None


@dataclass
class GRBLConfig:
    """GRBL connection configuration"""
    port: str
    baudrate: int = 115200
    
    # Connection settings
    timeout: float = 2.0
    write_timeout: float = 2.0
    
    # Machine settings
    max_x: float = 300.0  # mm
    max_y: float = 300.0  # mm
    max_z: float = 100.0  # mm
    max_feed_rate: float = 3000.0  # mm/min
    max_spindle_rpm: float = 24000.0
    
    # Safety settings
    soft_limits: bool = True
    hard_limits: bool = True
    homing_required: bool = True
    probe_feed_rate: float = 100.0  # mm/min
    
    # Performance settings
    status_poll_interval: float = 0.1  # seconds
    buffer_fill_threshold: float = 0.75  # 75% full
    line_buffer_size: int = 50


class GRBLController:
    """GRBL machine controller"""
    
    def __init__(self, config: GRBLConfig):
        self.config = config
        self.serial_port: Optional[serial.Serial] = None
        self.connected = False
        
        # Status
        self.status = MachineStatus()
        self.settings: Dict[str, Any] = {}
        
        # Job management
        self.current_job: Optional[List[str]] = None
        self.job_line_index = 0
        self.job_start_time: Optional[datetime] = None
        self.is_streaming = False
        
        # Buffers
        self.command_queue: deque = deque()
        self.send_buffer: List[str] = []
        self.response_buffer: deque = deque(maxlen=100)
        
        # Threads
        self.read_thread: Optional[threading.Thread] = None
        self.write_thread: Optional[threading.Thread] = None
        self.status_thread: Optional[threading.Thread] = None
        self.thread_stop_event = threading.Event()
        
        # Callbacks
        self.status_callbacks: List[Callable] = []
        self.alarm_callbacks: List[Callable] = []
        self.complete_callbacks: List[Callable] = []
        
        # Statistics
        self.stats = {
            "lines_sent": 0,
            "lines_completed": 0,
            "errors": 0,
            "total_time": 0.0
        }
        
    def find_grbl_ports(self) -> List[str]:
        """Find available serial ports that might have GRBL"""
        ports = []
        
        for port in serial.tools.list_ports.comports():
            # Check for common GRBL devices
            if any(x in port.description.lower() for x in ["arduino", "ch340", "ftdi", "grbl"]):
                ports.append(port.device)
                logger.info(f"Found potential GRBL port: {port.device} - {port.description}")
                
        return ports
        
    async def connect(self) -> bool:
        """Connect to GRBL controller"""
        try:
            # Open serial port
            self.serial_port = serial.Serial(
                port=self.config.port,
                baudrate=self.config.baudrate,
                timeout=self.config.timeout,
                write_timeout=self.config.write_timeout
            )
            
            # Clear buffers
            self.serial_port.reset_input_buffer()
            self.serial_port.reset_output_buffer()
            
            # Wait for GRBL to initialize
            await asyncio.sleep(2)
            
            # Send soft reset
            self.serial_port.write(b'\x18')  # Ctrl-X
            await asyncio.sleep(0.5)
            
            # Check for GRBL response
            self.serial_port.write(b'\r\n')
            response = self.serial_port.readline().decode('utf-8').strip()
            
            if "Grbl" in response:
                logger.info(f"Connected to GRBL: {response}")
                self.connected = True
                
                # Start threads
                self._start_threads()
                
                # Get initial status
                await self.update_status()
                
                # Get settings
                await self.get_settings()
                
                return True
            else:
                logger.error("No GRBL response")
                self.serial_port.close()
                return False
                
        except Exception as e:
            logger.error(f"Connection error: {e}")
            if self.serial_port and self.serial_port.is_open:
                self.serial_port.close()
            return False
            
    async def disconnect(self):
        """Disconnect from GRBL"""
        self.connected = False
        
        # Stop threads
        self.thread_stop_event.set()
        
        # Wait for threads to stop
        for thread in [self.read_thread, self.write_thread, self.status_thread]:
            if thread and thread.is_alive():
                thread.join(timeout=1.0)
                
        # Close serial port
        if self.serial_port and self.serial_port.is_open:
            self.serial_port.close()
            
        logger.info("Disconnected from GRBL")
        
    def _start_threads(self):
        """Start communication threads"""
        self.thread_stop_event.clear()
        
        # Read thread
        self.read_thread = threading.Thread(target=self._read_loop, daemon=True)
        self.read_thread.start()
        
        # Write thread
        self.write_thread = threading.Thread(target=self._write_loop, daemon=True)
        self.write_thread.start()
        
        # Status thread
        self.status_thread = threading.Thread(target=self._status_loop, daemon=True)
        self.status_thread.start()
        
    def _read_loop(self):
        """Read responses from GRBL"""
        while not self.thread_stop_event.is_set() and self.connected:
            try:
                if self.serial_port.in_waiting:
                    line = self.serial_port.readline().decode('utf-8').strip()
                    if line:
                        self._process_response(line)
                        self.response_buffer.append(line)
                else:
                    time.sleep(0.001)
                    
            except Exception as e:
                logger.error(f"Read error: {e}")
                time.sleep(0.1)
                
    def _write_loop(self):
        """Write commands to GRBL"""
        while not self.thread_stop_event.is_set() and self.connected:
            try:
                if self.command_queue and self._can_send():
                    command = self.command_queue.popleft()
                    self._send_command(command)
                else:
                    time.sleep(0.001)
                    
            except Exception as e:
                logger.error(f"Write error: {e}")
                time.sleep(0.1)
                
    def _status_loop(self):
        """Poll machine status"""
        while not self.thread_stop_event.is_set() and self.connected:
            try:
                # Send status query
                self.serial_port.write(b'?')
                time.sleep(self.config.status_poll_interval)
                
            except Exception as e:
                logger.error(f"Status error: {e}")
                time.sleep(1.0)
                
    def _can_send(self) -> bool:
        """Check if we can send more data"""
        # Simple buffer management
        return len(self.send_buffer) < self.config.line_buffer_size
        
    def _send_command(self, command: str):
        """Send command to GRBL"""
        if not command.endswith('\n'):
            command += '\n'
            
        self.serial_port.write(command.encode('utf-8'))
        self.send_buffer.append(command.strip())
        self.stats["lines_sent"] += 1
        
        logger.debug(f"Sent: {command.strip()}")
        
    def _process_response(self, response: str):
        """Process GRBL response"""
        # Status response
        if response.startswith('<') and response.endswith('>'):
            self._parse_status(response)
            
        # OK response
        elif response == 'ok':
            if self.send_buffer:
                completed = self.send_buffer.pop(0)
                self.stats["lines_completed"] += 1
                
                # Update job progress
                if self.is_streaming and self.current_job:
                    self.job_line_index += 1
                    if self.job_line_index >= len(self.current_job):
                        self._job_complete()
                        
        # Error response
        elif response.startswith('error:'):
            self._handle_error(response)
            
        # Alarm response
        elif response.startswith('ALARM:'):
            self._handle_alarm(response)
            
        # Settings response
        elif response.startswith('$'):
            self._parse_setting(response)
            
        # Info messages
        elif response.startswith('['):
            logger.info(f"GRBL: {response}")
            
    def _parse_status(self, status_str: str):
        """Parse status response"""
        # Remove < and >
        status_str = status_str[1:-1]
        
        # Split into parts
        parts = status_str.split('|')
        
        # Parse state
        state_str = parts[0]
        if ':' in state_str:
            state_str = state_str.split(':')[0]
            
        try:
            self.status.state = MachineState(state_str)
        except ValueError:
            self.status.state = MachineState.DISCONNECTED
            
        # Parse other fields
        for part in parts[1:]:
            if ':' in part:
                key, value = part.split(':', 1)
                
                # Work position
                if key == 'WPos':
                    coords = value.split(',')
                    if len(coords) >= 3:
                        self.status.position.work_x = float(coords[0])
                        self.status.position.work_y = float(coords[1])
                        self.status.position.work_z = float(coords[2])
                        
                # Machine position
                elif key == 'MPos':
                    coords = value.split(',')
                    if len(coords) >= 3:
                        self.status.position.machine_x = float(coords[0])
                        self.status.position.machine_y = float(coords[1])
                        self.status.position.machine_z = float(coords[2])
                        
                # Feed rate
                elif key == 'F':
                    self.status.feed_rate = float(value)
                    
                # Spindle speed
                elif key == 'S':
                    self.status.spindle_speed = float(value)
                    
                # Buffer state
                elif key == 'Bf':
                    buf_parts = value.split(',')
                    if len(buf_parts) >= 2:
                        self.status.planner_blocks = int(buf_parts[0])
                        self.status.rx_buffer_available = int(buf_parts[1])
                        
                # Line number
                elif key == 'Ln':
                    self.status.line_number = int(value)
                    
                # Overrides
                elif key == 'Ov':
                    ov_parts = value.split(',')
                    if len(ov_parts) >= 3:
                        self.status.feed_override = int(ov_parts[0])
                        self.status.rapid_override = int(ov_parts[1])
                        self.status.spindle_override = int(ov_parts[2])
                        
                # Probe
                elif key == 'Pn':
                    self.status.probe_triggered = 'P' in value
                    self.status.limit_triggered = any(c in value for c in ['X', 'Y', 'Z'])
                    self.status.door_open = 'D' in value
                    
        # Trigger callbacks
        asyncio.create_task(self._trigger_status_callbacks())
        
    def _handle_error(self, error_str: str):
        """Handle error response"""
        match = re.match(r'error:(\d+)', error_str)
        if match:
            error_code = int(match.group(1))
            try:
                self.status.error = ErrorCode(error_code)
                logger.error(f"GRBL Error {error_code}: {self.status.error.name}")
            except ValueError:
                logger.error(f"Unknown GRBL error: {error_code}")
                
        self.stats["errors"] += 1
        
        # Clear send buffer for this error
        if self.send_buffer:
            self.send_buffer.pop(0)
            
    def _handle_alarm(self, alarm_str: str):
        """Handle alarm response"""
        match = re.match(r'ALARM:(\d+)', alarm_str)
        if match:
            alarm_code = int(match.group(1))
            try:
                self.status.alarm = AlarmCode(alarm_code)
                self.status.state = MachineState.ALARM
                logger.error(f"GRBL Alarm {alarm_code}: {self.status.alarm.name}")
                
                # Trigger alarm callbacks
                asyncio.create_task(self._trigger_alarm_callbacks())
                
            except ValueError:
                logger.error(f"Unknown GRBL alarm: {alarm_code}")
                
    def _parse_setting(self, setting_str: str):
        """Parse GRBL setting"""
        match = re.match(r'\$(\d+)=(.+)', setting_str)
        if match:
            setting_num = match.group(1)
            setting_value = match.group(2)
            self.settings[f"${setting_num}"] = setting_value
            
    def _job_complete(self):
        """Handle job completion"""
        self.is_streaming = False
        
        if self.job_start_time:
            elapsed = (datetime.now() - self.job_start_time).total_seconds()
            self.stats["total_time"] += elapsed
            
        logger.info(f"Job complete: {self.job_line_index} lines")
        
        # Trigger callbacks
        asyncio.create_task(self._trigger_complete_callbacks())
        
        # Reset job state
        self.current_job = None
        self.job_line_index = 0
        self.job_start_time = None
        
    # Public control methods
    async def send_command(self, command: str, wait_response: bool = False) -> Optional[str]:
        """Send single command"""
        if not self.connected:
            raise RuntimeError("Not connected to GRBL")
            
        # Add to queue
        self.command_queue.append(command)
        
        if wait_response:
            # Wait for response
            start_time = time.time()
            while time.time() - start_time < self.config.timeout:
                if self.response_buffer and self.response_buffer[-1] == 'ok':
                    return 'ok'
                await asyncio.sleep(0.01)
                
            return None
            
    async def home_machine(self) -> bool:
        """Home the machine"""
        logger.info("Homing machine...")
        response = await self.send_command("$H", wait_response=True)
        
        if response:
            # Wait for homing to complete
            while self.status.state == MachineState.HOME:
                await asyncio.sleep(0.1)
                
            return self.status.state == MachineState.IDLE
        return False
        
    async def jog(self, x: float = 0, y: float = 0, z: float = 0, 
                  feed_rate: float = 1000) -> bool:
        """Jog machine incrementally"""
        # Build jog command
        jog_cmd = f"$J=G91 G21 F{feed_rate}"
        
        if x != 0:
            jog_cmd += f" X{x}"
        if y != 0:
            jog_cmd += f" Y{y}"
        if z != 0:
            jog_cmd += f" Z{z}"
            
        response = await self.send_command(jog_cmd, wait_response=True)
        return response == 'ok'
        
    async def move_to(self, x: Optional[float] = None, y: Optional[float] = None, 
                     z: Optional[float] = None, feed_rate: float = 1000) -> bool:
        """Move to absolute position"""
        # Build move command
        move_cmd = f"G90 G21 G1 F{feed_rate}"
        
        if x is not None:
            move_cmd += f" X{x}"
        if y is not None:
            move_cmd += f" Y{y}"
        if z is not None:
            move_cmd += f" Z{z}"
            
        response = await self.send_command(move_cmd, wait_response=True)
        return response == 'ok'
        
    async def set_spindle(self, rpm: float, clockwise: bool = True) -> bool:
        """Set spindle speed"""
        if rpm > self.config.max_spindle_rpm:
            logger.error(f"Spindle speed {rpm} exceeds max {self.config.max_spindle_rpm}")
            return False
            
        if rpm > 0:
            direction = "M3" if clockwise else "M4"
            command = f"{direction} S{rpm}"
        else:
            command = "M5"  # Stop spindle
            
        response = await self.send_command(command, wait_response=True)
        return response == 'ok'
        
    async def probe_z(self, feed_rate: Optional[float] = None, 
                     max_distance: float = 10.0) -> Optional[float]:
        """Probe Z axis"""
        if feed_rate is None:
            feed_rate = self.config.probe_feed_rate
            
        # Probe command
        probe_cmd = f"G38.2 Z-{max_distance} F{feed_rate}"
        
        # Clear probe status
        self.status.probe_triggered = False
        
        # Send probe command
        await self.send_command(probe_cmd)
        
        # Wait for probe to trigger or complete
        start_time = time.time()
        while time.time() - start_time < 30:  # 30 second timeout
            if self.status.probe_triggered:
                return self.status.position.work_z
            if self.status.state == MachineState.IDLE:
                break
            await asyncio.sleep(0.01)
            
        return None
        
    async def run_gcode_file(self, gcode_lines: List[str]) -> bool:
        """Run G-code program"""
        if self.is_streaming:
            logger.error("Already running a job")
            return False
            
        if self.status.state != MachineState.IDLE:
            logger.error(f"Machine not ready: {self.status.state}")
            return False
            
        # Prepare job
        self.current_job = gcode_lines
        self.job_line_index = 0
        self.job_start_time = datetime.now()
        self.is_streaming = True
        
        # Start streaming
        asyncio.create_task(self._stream_job())
        
        logger.info(f"Started job: {len(gcode_lines)} lines")
        return True
        
    async def _stream_job(self):
        """Stream G-code job"""
        while self.is_streaming and self.job_line_index < len(self.current_job):
            # Check if we can send more
            if len(self.command_queue) < self.config.line_buffer_size:
                line = self.current_job[self.job_line_index].strip()
                
                # Skip empty lines and comments
                if line and not line.startswith('('):
                    self.command_queue.append(line)
                else:
                    self.job_line_index += 1
                    
            await asyncio.sleep(0.001)
            
    async def pause_job(self) -> bool:
        """Pause current job"""
        if not self.is_streaming:
            return False
            
        # Send feed hold
        self.serial_port.write(b'!')
        self.is_streaming = False
        
        logger.info("Job paused")
        return True
        
    async def resume_job(self) -> bool:
        """Resume paused job"""
        if self.status.state != MachineState.HOLD:
            return False
            
        # Send cycle start
        self.serial_port.write(b'~')
        self.is_streaming = True
        
        # Resume streaming
        asyncio.create_task(self._stream_job())
        
        logger.info("Job resumed")
        return True
        
    async def stop_job(self) -> bool:
        """Stop current job"""
        # Send reset
        self.serial_port.write(b'\x18')  # Ctrl-X
        
        self.is_streaming = False
        self.current_job = None
        self.job_line_index = 0
        
        logger.info("Job stopped")
        return True
        
    async def reset_alarm(self) -> bool:
        """Reset alarm state"""
        if self.status.state != MachineState.ALARM:
            return False
            
        # Send unlock
        response = await self.send_command("$X", wait_response=True)
        
        if response == 'ok':
            self.status.alarm = None
            logger.info("Alarm reset")
            return True
        return False
        
    async def get_settings(self) -> Dict[str, Any]:
        """Get GRBL settings"""
        self.settings.clear()
        
        # Request settings
        await self.send_command("$$")
        
        # Wait for settings
        await asyncio.sleep(0.5)
        
        return self.settings
        
    async def set_setting(self, setting: str, value: Any) -> bool:
        """Set GRBL setting"""
        command = f"{setting}={value}"
        response = await self.send_command(command, wait_response=True)
        return response == 'ok'
        
    async def update_status(self):
        """Request immediate status update"""
        self.serial_port.write(b'?')
        await asyncio.sleep(0.1)
        
    def get_status(self) -> Dict[str, Any]:
        """Get current status"""
        return {
            "state": self.status.state.value,
            "position": {
                "work": {
                    "x": self.status.position.work_x,
                    "y": self.status.position.work_y,
                    "z": self.status.position.work_z
                },
                "machine": {
                    "x": self.status.position.machine_x,
                    "y": self.status.position.machine_y,
                    "z": self.status.position.machine_z
                }
            },
            "feed_rate": self.status.feed_rate,
            "spindle_speed": self.status.spindle_speed,
            "overrides": {
                "feed": self.status.feed_override,
                "rapid": self.status.rapid_override,
                "spindle": self.status.spindle_override
            },
            "job": {
                "running": self.is_streaming,
                "line": self.job_line_index,
                "total_lines": len(self.current_job) if self.current_job else 0,
                "progress": (self.job_line_index / len(self.current_job) * 100) 
                          if self.current_job and len(self.current_job) > 0 else 0
            },
            "alarm": self.status.alarm.name if self.status.alarm else None,
            "error": self.status.error.name if self.status.error else None,
            "stats": self.stats
        }
        
    # Callbacks
    def register_status_callback(self, callback: Callable):
        """Register status update callback"""
        self.status_callbacks.append(callback)
        
    def register_alarm_callback(self, callback: Callable):
        """Register alarm callback"""
        self.alarm_callbacks.append(callback)
        
    def register_complete_callback(self, callback: Callable):
        """Register job complete callback"""
        self.complete_callbacks.append(callback)
        
    async def _trigger_status_callbacks(self):
        """Trigger status callbacks"""
        for callback in self.status_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(self.status)
                else:
                    await asyncio.get_event_loop().run_in_executor(
                        None, callback, self.status
                    )
            except Exception as e:
                logger.error(f"Status callback error: {e}")
                
    async def _trigger_alarm_callbacks(self):
        """Trigger alarm callbacks"""
        for callback in self.alarm_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(self.status.alarm)
                else:
                    await asyncio.get_event_loop().run_in_executor(
                        None, callback, self.status.alarm
                    )
            except Exception as e:
                logger.error(f"Alarm callback error: {e}")
                
    async def _trigger_complete_callbacks(self):
        """Trigger complete callbacks"""
        for callback in self.complete_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback()
                else:
                    await asyncio.get_event_loop().run_in_executor(
                        None, callback
                    )
            except Exception as e:
                logger.error(f"Complete callback error: {e}")


# Example usage
async def main():
    """Example usage"""
    # Configure GRBL
    config = GRBLConfig(
        port="/dev/ttyUSB0",  # Adjust for your system
        baudrate=115200
    )
    
    # Create controller
    controller = GRBLController(config)
    
    # Find available ports
    ports = controller.find_grbl_ports()
    if ports:
        config.port = ports[0]
        
    # Connect
    if await controller.connect():
        # Register callbacks
        async def on_status(status: MachineStatus):
            print(f"State: {status.state.value}, Pos: {status.position}")
            
        controller.register_status_callback(on_status)
        
        # Home machine
        if await controller.home_machine():
            print("Machine homed")
            
        # Move to position
        await controller.move_to(x=100, y=100, z=10)
        
        # Run simple G-code
        gcode = [
            "G90",  # Absolute positioning
            "G21",  # Metric
            "G0 X0 Y0 Z5",  # Rapid to start
            "M3 S10000",  # Spindle on
            "G1 Z-1 F100",  # Plunge
            "G1 X50 Y50 F1000",  # Cut
            "G1 X50 Y100",
            "G1 X100 Y100",
            "G1 X100 Y50",
            "G1 X50 Y50",
            "G0 Z5",  # Retract
            "M5",  # Spindle off
            "G0 X0 Y0",  # Return home
        ]
        
        await controller.run_gcode_file(gcode)
        
        # Wait for completion
        while controller.is_streaming:
            await asyncio.sleep(1)
            status = controller.get_status()
            print(f"Progress: {status['job']['progress']:.1f}%")
            
        # Disconnect
        await controller.disconnect()
        
    else:
        print("Failed to connect to GRBL")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())