"""
W.I.T. Prusa/Marlin Serial Integration

Direct serial communication with Prusa 3D printers running Marlin firmware.
Supports Prusa XL, MK3S+, MINI+, and other Marlin-based printers.
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
import threading
from collections import deque
import json

# Configure logging
logger = logging.getLogger(__name__)


class PrinterState(Enum):
    """Printer states"""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    IDLE = "idle"
    PRINTING = "printing"
    PAUSED = "paused"
    HEATING = "heating"
    COOLING = "cooling"
    ERROR = "error"
    BUSY = "busy"


@dataclass
class Temperature:
    """Temperature reading"""
    current: float = 0.0
    target: float = 0.0
    
    def is_heating(self) -> bool:
        return self.target > 0 and abs(self.current - self.target) > 2.0


@dataclass
class PrinterStatus:
    """Complete printer status"""
    state: PrinterState = PrinterState.DISCONNECTED
    
    # Temperatures
    hotend_temp: Temperature = field(default_factory=Temperature)
    bed_temp: Temperature = field(default_factory=Temperature)
    
    # Position
    x_pos: float = 0.0
    y_pos: float = 0.0
    z_pos: float = 0.0
    e_pos: float = 0.0
    
    # Print job
    printing_file: Optional[str] = None
    print_progress: float = 0.0
    print_time_elapsed: int = 0  # seconds
    print_time_remaining: Optional[int] = None
    
    # Printer info
    firmware: Optional[str] = None
    printer_name: Optional[str] = None
    
    # Flags
    sd_ready: bool = False
    is_homed: bool = False
    fan_speed: int = 0  # 0-255
    flow_rate: int = 100  # percentage
    feed_rate: int = 100  # percentage


@dataclass
class PrusaConfig:
    """Prusa printer configuration"""
    port: str
    baudrate: int = 115200
    timeout: float = 2.0
    
    # Printer model
    model: str = "Prusa XL"  # XL, MK3S+, MINI+, etc.
    
    # Safety limits
    max_hotend_temp: float = 300.0
    max_bed_temp: float = 120.0
    
    # Features
    has_mmu: bool = False  # Multi-material unit
    has_filament_sensor: bool = True
    bed_size: Tuple[float, float, float] = (250, 210, 210)  # X, Y, Z in mm
    
    # Communication
    poll_interval: float = 2.0  # Status polling interval
    command_timeout: float = 60.0  # Timeout for commands
    

class PrusaSerial:
    """Direct serial communication with Prusa printers"""
    
    def __init__(self, config: PrusaConfig):
        self.config = config
        self.serial_port: Optional[serial.Serial] = None
        self.connected = False
        
        # Status tracking
        self.status = PrinterStatus()
        self.last_status_time = 0.0
        
        # Command queue
        self.command_queue: deque = deque()
        self.priority_queue: deque = deque()  # For immediate commands
        self.waiting_for_ok = False
        self.last_command: Optional[str] = None
        
        # Response handling
        self.response_handlers: Dict[str, Callable] = {}
        self.temperature_regex = re.compile(
            r'T:(?P<hotend>[\d.]+)\s*/(?P<hotend_target>[\d.]+)\s*'
            r'B:(?P<bed>[\d.]+)\s*/(?P<bed_target>[\d.]+)'
        )
        
        # Threads
        self.read_thread: Optional[threading.Thread] = None
        self.write_thread: Optional[threading.Thread] = None
        self.status_thread: Optional[threading.Thread] = None
        self.stop_event = threading.Event()
        
        # Callbacks
        self.state_callbacks: List[Callable] = []
        self.temperature_callbacks: List[Callable] = []
        self.progress_callbacks: List[Callable] = []
        self.error_callbacks: List[Callable] = []
        
    def find_prusa_ports(self) -> List[Dict[str, str]]:
        """Find available serial ports that might have Prusa printers"""
        ports = []
        
        for port in serial.tools.list_ports.comports():
            # Check for Prusa identifiers
            is_prusa = any(x in str(port.description).lower() for x in 
                          ["prusa", "ultimachine", "rambo", "einsy"])
            
            # Also check for common 3D printer chips
            is_printer = any(x in str(port.description).lower() for x in 
                           ["ch340", "ft232", "2341:0042"])  # Arduino Mega
            
            if is_prusa or is_printer:
                ports.append({
                    "port": port.device,
                    "description": port.description,
                    "hwid": port.hwid,
                    "likely_prusa": is_prusa
                })
                logger.info(f"Found potential printer port: {port.device} - {port.description}")
                
        return ports
        
    async def connect(self) -> bool:
        """Connect to Prusa printer"""
        try:
            logger.info(f"Connecting to Prusa on {self.config.port}...")
            
            # Open serial connection
            self.serial_port = serial.Serial(
                port=self.config.port,
                baudrate=self.config.baudrate,
                timeout=self.config.timeout,
                write_timeout=self.config.timeout
            )
            
            # Clear buffers
            self.serial_port.reset_input_buffer()
            self.serial_port.reset_output_buffer()
            
            # Wait for printer to initialize
            await asyncio.sleep(2)
            
            # Send initial commands
            self._send_now("M115")  # Get firmware info
            await asyncio.sleep(0.5)
            
            # Check if we got a response
            response = self._read_all()
            if "FIRMWARE_NAME" in response or "Marlin" in response:
                logger.info(f"Connected to printer: {response}")
                self.connected = True
                self.status.state = PrinterState.IDLE
                
                # Parse firmware info
                self._parse_firmware_info(response)
                
                # Start communication threads
                self._start_threads()
                
                # Get initial status
                await self.update_status()
                
                return True
            else:
                logger.error("No valid response from printer")
                self.serial_port.close()
                return False
                
        except Exception as e:
            logger.error(f"Connection failed: {e}")
            if self.serial_port and self.serial_port.is_open:
                self.serial_port.close()
            return False
            
    async def disconnect(self):
        """Disconnect from printer"""
        logger.info("Disconnecting from printer...")
        
        self.connected = False
        self.stop_event.set()
        
        # Stop threads
        for thread in [self.read_thread, self.write_thread, self.status_thread]:
            if thread and thread.is_alive():
                thread.join(timeout=2.0)
                
        # Close serial port
        if self.serial_port and self.serial_port.is_open:
            self.serial_port.close()
            
        self.status.state = PrinterState.DISCONNECTED
        logger.info("Disconnected")
        
    def _start_threads(self):
        """Start communication threads"""
        self.stop_event.clear()
        
        self.read_thread = threading.Thread(target=self._read_loop, daemon=True)
        self.read_thread.start()
        
        self.write_thread = threading.Thread(target=self._write_loop, daemon=True)
        self.write_thread.start()
        
        self.status_thread = threading.Thread(target=self._status_loop, daemon=True)
        self.status_thread.start()
        
    def _read_loop(self):
        """Continuously read from serial port"""
        buffer = ""
        
        while not self.stop_event.is_set() and self.connected:
            try:
                if self.serial_port.in_waiting:
                    data = self.serial_port.read(self.serial_port.in_waiting).decode('utf-8', errors='ignore')
                    buffer += data
                    
                    # Process complete lines
                    while '\n' in buffer:
                        line, buffer = buffer.split('\n', 1)
                        line = line.strip()
                        if line:
                            self._process_response(line)
                            
                else:
                    time.sleep(0.01)
                    
            except Exception as e:
                logger.error(f"Read error: {e}")
                time.sleep(0.1)
                
    def _write_loop(self):
        """Send queued commands to printer"""
        while not self.stop_event.is_set() and self.connected:
            try:
                # Priority commands first
                if self.priority_queue and not self.waiting_for_ok:
                    command = self.priority_queue.popleft()
                    self._send_command(command)
                    
                # Regular commands
                elif self.command_queue and not self.waiting_for_ok:
                    command = self.command_queue.popleft()
                    self._send_command(command)
                    
                else:
                    time.sleep(0.01)
                    
            except Exception as e:
                logger.error(f"Write error: {e}")
                time.sleep(0.1)
                
    def _status_loop(self):
        """Periodically update printer status"""
        while not self.stop_event.is_set() and self.connected:
            try:
                current_time = time.time()
                
                if current_time - self.last_status_time > self.config.poll_interval:
                    # Request temperature
                    self.send_command_priority("M105")
                    
                    # Request position
                    self.send_command_priority("M114")
                    
                    # If printing, get progress
                    if self.status.state == PrinterState.PRINTING:
                        self.send_command_priority("M27")  # SD print progress
                        
                    self.last_status_time = current_time
                    
                time.sleep(0.5)
                
            except Exception as e:
                logger.error(f"Status error: {e}")
                time.sleep(1)
                
    def _send_command(self, command: str):
        """Send a command to the printer"""
        if not command.endswith('\n'):
            command += '\n'
            
        try:
            self.serial_port.write(command.encode('utf-8'))
            self.last_command = command.strip()
            self.waiting_for_ok = True
            logger.debug(f"Sent: {command.strip()}")
            
        except Exception as e:
            logger.error(f"Failed to send command: {e}")
            self.waiting_for_ok = False
            
    def _send_now(self, command: str):
        """Send command immediately, bypassing queue"""
        if not command.endswith('\n'):
            command += '\n'
            
        try:
            self.serial_port.write(command.encode('utf-8'))
            logger.debug(f"Sent immediately: {command.strip()}")
            
        except Exception as e:
            logger.error(f"Failed to send immediate command: {e}")
            
    def _read_all(self) -> str:
        """Read all available data"""
        data = b""
        while self.serial_port.in_waiting:
            data += self.serial_port.read(self.serial_port.in_waiting)
            time.sleep(0.01)
        return data.decode('utf-8', errors='ignore')
        
    def _process_response(self, line: str):
        """Process a response line from the printer"""
        logger.debug(f"Recv: {line}")
        
        # Handle acknowledgment
        if line.startswith("ok"):
            self.waiting_for_ok = False
            
        # Handle errors
        elif line.startswith("Error:") or line.startswith("echo:Unknown command:"):
            logger.error(f"Printer error: {line}")
            self.waiting_for_ok = False
            for callback in self.error_callbacks:
                try:
                    callback(line)
                except Exception as e:
                    logger.error(f"Error callback failed: {e}")
                    
        # Handle temperature reports
        elif "T:" in line or "T0:" in line:
            self._parse_temperature(line)
            
        # Handle position reports
        elif line.startswith("X:") and "Y:" in line and "Z:" in line:
            self._parse_position(line)
            
        # Handle SD printing status
        elif "SD printing byte" in line:
            self._parse_sd_progress(line)
            
        # Handle other responses
        else:
            # Check registered handlers
            for pattern, handler in self.response_handlers.items():
                if pattern in line:
                    try:
                        handler(line)
                    except Exception as e:
                        logger.error(f"Response handler error: {e}")
                        
    def _parse_temperature(self, line: str):
        """Parse temperature from response"""
        match = self.temperature_regex.search(line)
        if match:
            try:
                self.status.hotend_temp.current = float(match.group('hotend'))
                self.status.hotend_temp.target = float(match.group('hotend_target'))
                self.status.bed_temp.current = float(match.group('bed'))
                self.status.bed_temp.target = float(match.group('bed_target'))
                
                # Update state based on temperature
                if self.status.hotend_temp.is_heating() or self.status.bed_temp.is_heating():
                    if self.status.state == PrinterState.IDLE:
                        self.status.state = PrinterState.HEATING
                        
                # Trigger callbacks
                for callback in self.temperature_callbacks:
                    try:
                        callback(self.status.hotend_temp, self.status.bed_temp)
                    except Exception as e:
                        logger.error(f"Temperature callback error: {e}")
                        
            except Exception as e:
                logger.error(f"Failed to parse temperature: {e}")
                
    def _parse_position(self, line: str):
        """Parse position from M114 response"""
        try:
            # Extract positions using regex
            x_match = re.search(r'X:([\d.-]+)', line)
            y_match = re.search(r'Y:([\d.-]+)', line)
            z_match = re.search(r'Z:([\d.-]+)', line)
            e_match = re.search(r'E:([\d.-]+)', line)
            
            if x_match:
                self.status.x_pos = float(x_match.group(1))
            if y_match:
                self.status.y_pos = float(y_match.group(1))
            if z_match:
                self.status.z_pos = float(z_match.group(1))
            if e_match:
                self.status.e_pos = float(e_match.group(1))
                
        except Exception as e:
            logger.error(f"Failed to parse position: {e}")
            
    def _parse_sd_progress(self, line: str):
        """Parse SD card printing progress"""
        try:
            # Format: "SD printing byte 123/12345"
            match = re.search(r'SD printing byte (\d+)/(\d+)', line)
            if match:
                current = int(match.group(1))
                total = int(match.group(2))
                if total > 0:
                    self.status.print_progress = (current / total) * 100
                    
                    # Trigger progress callbacks
                    for callback in self.progress_callbacks:
                        try:
                            callback(self.status.print_progress)
                        except Exception as e:
                            logger.error(f"Progress callback error: {e}")
                            
        except Exception as e:
            logger.error(f"Failed to parse SD progress: {e}")
            
    def _parse_firmware_info(self, response: str):
        """Parse firmware information from M115 response"""
        try:
            # Extract firmware name
            fw_match = re.search(r'FIRMWARE_NAME:([^\\s]+)', response)
            if fw_match:
                self.status.firmware = fw_match.group(1)
                
            # Extract machine name
            name_match = re.search(r'MACHINE_TYPE:([^\\s]+)', response)
            if name_match:
                self.status.printer_name = name_match.group(1)
                
        except Exception as e:
            logger.error(f"Failed to parse firmware info: {e}")
            
    # Public methods
    
    def send_command(self, command: str):
        """Queue a command to be sent"""
        self.command_queue.append(command)
        
    def send_command_priority(self, command: str):
        """Queue a high-priority command"""
        self.priority_queue.append(command)
        
    def send_gcode_file(self, gcode_lines: List[str]):
        """Send a list of G-code commands"""
        for line in gcode_lines:
            line = line.strip()
            if line and not line.startswith(';'):  # Skip empty lines and comments
                self.send_command(line)
                
    async def home_axes(self, axes: str = "XYZ") -> bool:
        """Home specified axes"""
        command = f"G28 {' '.join(axes)}"
        self.send_command_priority(command)
        self.status.is_homed = True
        return True
        
    async def set_temperature(self, hotend: Optional[float] = None, bed: Optional[float] = None, wait: bool = False):
        """Set target temperatures"""
        if hotend is not None:
            if hotend > self.config.max_hotend_temp:
                raise ValueError(f"Hotend temperature {hotend}°C exceeds limit {self.config.max_hotend_temp}°C")
            
            command = f"M104 S{hotend}" if not wait else f"M109 S{hotend}"
            self.send_command_priority(command)
            
        if bed is not None:
            if bed > self.config.max_bed_temp:
                raise ValueError(f"Bed temperature {bed}°C exceeds limit {self.config.max_bed_temp}°C")
                
            command = f"M140 S{bed}" if not wait else f"M190 S{bed}"
            self.send_command_priority(command)
            
    async def move_to(self, x: Optional[float] = None, y: Optional[float] = None, 
                     z: Optional[float] = None, feedrate: Optional[float] = None,
                     relative: bool = False):
        """Move to position"""
        if relative:
            self.send_command("G91")  # Relative positioning
            
        command = "G1"
        if x is not None:
            command += f" X{x}"
        if y is not None:
            command += f" Y{y}"
        if z is not None:
            command += f" Z{z}"
        if feedrate is not None:
            command += f" F{feedrate}"
            
        self.send_command(command)
        
        if relative:
            self.send_command("G90")  # Back to absolute
            
    async def start_sd_print(self, filename: str):
        """Start printing from SD card"""
        self.send_command_priority(f"M23 {filename}")  # Select file
        self.send_command_priority("M24")  # Start print
        self.status.state = PrinterState.PRINTING
        self.status.printing_file = filename
        
    async def pause_print(self):
        """Pause current print"""
        self.send_command_priority("M25")  # Pause SD print
        self.status.state = PrinterState.PAUSED
        
    async def resume_print(self):
        """Resume paused print"""
        self.send_command_priority("M24")  # Resume SD print
        self.status.state = PrinterState.PRINTING
        
    async def stop_print(self):
        """Stop current print"""
        self.send_command_priority("M524")  # Abort SD print (Marlin 2.0+)
        # For older firmware:
        # self.send_command_priority("M25")  # Pause
        # self.send_command_priority("M23")  # Deselect file
        
        self.status.state = PrinterState.IDLE
        self.status.printing_file = None
        self.status.print_progress = 0.0
        
    async def emergency_stop(self):
        """Emergency stop - kills all movement"""
        self.send_command_priority("M112")  # Emergency stop
        self.status.state = PrinterState.ERROR
        
    async def get_sd_files(self) -> List[str]:
        """Get list of files on SD card"""
        files = []
        
        # This would need custom response handling
        # self.send_command_priority("M20")  # List SD card
        
        return files
        
    async def update_status(self):
        """Force status update"""
        self.send_command_priority("M105")  # Temperature
        self.send_command_priority("M114")  # Position
        
        if self.status.state == PrinterState.PRINTING:
            self.send_command_priority("M27")  # Progress
            
    def get_status(self) -> Dict[str, Any]:
        """Get current printer status as dict"""
        return {
            "state": self.status.state.value,
            "connected": self.connected,
            "temperatures": {
                "hotend": {
                    "current": self.status.hotend_temp.current,
                    "target": self.status.hotend_temp.target
                },
                "bed": {
                    "current": self.status.bed_temp.current,
                    "target": self.status.bed_temp.target
                }
            },
            "position": {
                "x": self.status.x_pos,
                "y": self.status.y_pos,
                "z": self.status.z_pos,
                "e": self.status.e_pos
            },
            "print": {
                "file": self.status.printing_file,
                "progress": self.status.print_progress,
                "time_elapsed": self.status.print_time_elapsed
            },
            "info": {
                "firmware": self.status.firmware,
                "name": self.status.printer_name,
                "model": self.config.model
            }
        }
        
    # Callback registration
    
    def register_state_callback(self, callback: Callable):
        """Register callback for state changes"""
        self.state_callbacks.append(callback)
        
    def register_temperature_callback(self, callback: Callable):
        """Register callback for temperature updates"""
        self.temperature_callbacks.append(callback)
        
    def register_progress_callback(self, callback: Callable):
        """Register callback for print progress"""
        self.progress_callbacks.append(callback)
        
    def register_error_callback(self, callback: Callable):
        """Register callback for errors"""
        self.error_callbacks.append(callback)


# Example usage
async def main():
    """Example of using the Prusa serial integration"""
    
    # Find available ports
    prusa = PrusaSerial(PrusaConfig(port=""))
    ports = prusa.find_prusa_ports()
    
    if not ports:
        print("No printer ports found!")
        return
        
    # Use the first port found
    config = PrusaConfig(
        port=ports[0]["port"],
        model="Prusa XL"
    )
    
    # Create printer connection
    printer = PrusaSerial(config)
    
    # Register callbacks
    def on_temperature(hotend: Temperature, bed: Temperature):
        print(f"Temp - Hotend: {hotend.current}/{hotend.target}°C, Bed: {bed.current}/{bed.target}°C")
        
    def on_error(error: str):
        print(f"ERROR: {error}")
        
    printer.register_temperature_callback(on_temperature)
    printer.register_error_callback(on_error)
    
    # Connect
    if await printer.connect():
        print("Connected to Prusa printer!")
        
        # Get status
        status = printer.get_status()
        print(f"Status: {json.dumps(status, indent=2)}")
        
        # Home printer
        print("Homing...")
        await printer.home_axes()
        
        # Heat up
        print("Heating...")
        await printer.set_temperature(hotend=210, bed=60)
        
        # Wait a bit for temperature updates
        await asyncio.sleep(10)
        
        # Move around
        print("Moving...")
        await printer.move_to(x=100, y=100, z=10, feedrate=3000)
        
        # Cool down
        print("Cooling...")
        await printer.set_temperature(hotend=0, bed=0)
        
        # Disconnect
        await printer.disconnect()
        
    else:
        print("Failed to connect to printer")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())