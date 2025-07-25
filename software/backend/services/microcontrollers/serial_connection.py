# software/backend/services/microcontrollers/serial_connection.py
import asyncio
import serial
import serial.tools.list_ports
from typing import Dict, Any, Optional
import logging
import json
from datetime import datetime

from .base_connection import BaseConnection

logger = logging.getLogger(__name__)


class SerialConnection(BaseConnection):
    """Serial/USB connection for microcontrollers"""
    
    def __init__(self, connection_string: str, params: Dict[str, Any]):
        super().__init__(connection_string, params)
        self.serial_port = None
        self._reader_task = None
        self._write_lock = asyncio.Lock()
        
    async def connect(self) -> bool:
        """Connect to the serial port"""
        try:
            # Extract parameters
            baudrate = self.params.get("baudrate", 115200)
            timeout = self.params.get("timeout", 2.0)
            
            # Create serial connection
            self.serial_port = serial.Serial(
                port=self.connection_string,
                baudrate=baudrate,
                timeout=timeout,
                write_timeout=timeout,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE
            )
            
            # Set DTR/RTS if specified (for Arduino reset)
            if "dtr" in self.params:
                self.serial_port.dtr = self.params["dtr"]
            if "rts" in self.params:
                self.serial_port.rts = self.params["rts"]
            
            # Clear buffers
            self.serial_port.reset_input_buffer()
            self.serial_port.reset_output_buffer()
            
            # Wait for device to initialize
            await asyncio.sleep(2.0)
            
            # Start reader task
            self._reader_task = asyncio.create_task(self._read_loop())
            
            self.is_connected = True
            logger.info(f"Connected to serial port {self.connection_string}")
            
            # Send initial handshake
            await self._handshake()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to serial port {self.connection_string}: {e}")
            return False
    
    async def disconnect(self):
        """Disconnect from the serial port"""
        self.is_connected = False
        
        if self._reader_task:
            self._reader_task.cancel()
            try:
                await self._reader_task
            except asyncio.CancelledError:
                pass
        
        if self.serial_port and self.serial_port.is_open:
            self.serial_port.close()
            
        logger.info(f"Disconnected from serial port {self.connection_string}")
    
    async def send_command(self, command: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Send a command and wait for response"""
        if not self.is_connected or not self.serial_port:
            raise ConnectionError("Not connected to device")
        
        # Create command message
        message = {
            "cmd": command,
            "params": params or {},
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Send command
        await self.write_data(json.dumps(message).encode() + b'\n')
        
        # Wait for response (with timeout)
        try:
            response = await asyncio.wait_for(self._wait_for_response(command), timeout=5.0)
            return response
        except asyncio.TimeoutError:
            return {"error": "Command timeout", "success": False}
    
    async def write_data(self, data: bytes):
        """Write data to the serial port"""
        if not self.serial_port or not self.serial_port.is_open:
            raise ConnectionError("Serial port not open")
        
        async with self._write_lock:
            await asyncio.get_event_loop().run_in_executor(None, self.serial_port.write, data)
            await asyncio.get_event_loop().run_in_executor(None, self.serial_port.flush)
    
    async def read_data(self) -> Optional[Dict[str, Any]]:
        """Read data from the queue (non-blocking)"""
        try:
            return self._read_queue.get_nowait()
        except asyncio.QueueEmpty:
            return None
    
    async def _read_loop(self):
        """Continuously read from serial port"""
        buffer = b""
        
        while self.is_connected and self.serial_port and self.serial_port.is_open:
            try:
                # Read available bytes
                in_waiting = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: self.serial_port.in_waiting
                )
                
                if in_waiting > 0:
                    data = await asyncio.get_event_loop().run_in_executor(
                        None, self.serial_port.read, in_waiting
                    )
                    buffer += data
                    
                    # Process complete lines
                    while b'\n' in buffer:
                        line, buffer = buffer.split(b'\n', 1)
                        if line:
                            parsed = self._parse_message(line)
                            if parsed:
                                await self._read_queue.put(parsed)
                else:
                    await asyncio.sleep(0.01)  # Small delay if no data
                    
            except Exception as e:
                logger.error(f"Error in serial read loop: {e}")
                await asyncio.sleep(0.1)
    
    async def _handshake(self):
        """Perform initial handshake with device"""
        # Send identification request
        await self.write_data(b'{"cmd": "identify"}\n')
        
        # Wait for response
        start_time = asyncio.get_event_loop().time()
        while asyncio.get_event_loop().time() - start_time < 3.0:
            data = await self.read_data()
            if data and data.get("type") == "identity":
                logger.info(f"Device identified: {data}")
                return
            await asyncio.sleep(0.1)
        
        logger.warning("Device did not respond to handshake")
    
    async def _wait_for_response(self, command: str) -> Dict[str, Any]:
        """Wait for a response to a specific command"""
        while True:
            data = await self.read_data()
            if data:
                # Check if this is a response to our command
                if data.get("response_to") == command or data.get("cmd") == command:
                    return data
                # Put it back if it's not for us
                await self._read_queue.put(data)
            await asyncio.sleep(0.01)