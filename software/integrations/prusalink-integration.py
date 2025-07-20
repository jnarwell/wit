"""
W.I.T. PrusaLink Integration

Network interface for controlling Prusa printers via PrusaLink API.
Supports Prusa XL, MK4, MINI+ with PrusaLink firmware.
"""

import asyncio
import aiohttp
import logging
from typing import Optional, Dict, Any, List, Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import json
from urllib.parse import urljoin
import base64

# Configure logging
logger = logging.getLogger(__name__)


class PrusaLinkState(Enum):
    """PrusaLink printer states"""
    IDLE = "idle"
    BUSY = "busy"
    PRINTING = "printing"
    PAUSED = "paused"
    FINISHED = "finished"
    STOPPED = "stopped"
    ERROR = "error"
    ATTENTION = "attention"
    READY = "ready"
    OFFLINE = "offline"


@dataclass
class PrusaLinkStatus:
    """Complete printer status from PrusaLink"""
    state: PrusaLinkState = PrusaLinkState.OFFLINE
    
    # Temperatures
    nozzle_temp: float = 0.0
    nozzle_target: float = 0.0
    bed_temp: float = 0.0
    bed_target: float = 0.0
    
    # Print job info
    job_name: Optional[str] = None
    progress: float = 0.0
    time_printing: int = 0  # seconds
    time_remaining: int = 0  # seconds
    
    # Position (if available)
    pos_x: Optional[float] = None
    pos_y: Optional[float] = None
    pos_z: Optional[float] = None
    
    # Printer info
    printer_model: Optional[str] = None
    firmware_version: Optional[str] = None
    serial_number: Optional[str] = None
    
    # Network info
    ip_address: Optional[str] = None
    hostname: Optional[str] = None
    
    # Errors/warnings
    error: Optional[str] = None
    warning: Optional[str] = None


@dataclass
class PrusaLinkConfig:
    """PrusaLink connection configuration"""
    host: str  # IP address or hostname
    api_key: str  # API key from PrusaLink settings
    username: Optional[str] = None  # For basic auth (older versions)
    password: Optional[str] = None  # For basic auth (older versions)
    
    # Connection settings
    port: int = 80  # Default HTTP port
    use_https: bool = False
    timeout: float = 30.0
    
    # Polling settings
    poll_interval: float = 2.0
    
    # Printer info
    name: str = "Prusa Printer"
    model: str = "Prusa XL"


class PrusaLinkClient:
    """PrusaLink API client"""
    
    def __init__(self, config: PrusaLinkConfig):
        self.config = config
        self.session: Optional[aiohttp.ClientSession] = None
        self.status = PrusaLinkStatus()
        self.connected = False
        
        # Polling task
        self.poll_task: Optional[asyncio.Task] = None
        
        # Callbacks
        self.state_callbacks: List[Callable] = []
        self.temperature_callbacks: List[Callable] = []
        self.progress_callbacks: List[Callable] = []
        self.error_callbacks: List[Callable] = []
        
        # Build base URL
        protocol = "https" if config.use_https else "http"
        self.base_url = f"{protocol}://{config.host}:{config.port}"
        
        # Auth headers
        self.headers = {
            "X-Api-Key": config.api_key,
            "Content-Type": "application/json"
        }
        
        # Add basic auth if provided (for older PrusaLink versions)
        if config.username and config.password:
            auth_str = f"{config.username}:{config.password}"
            auth_bytes = auth_str.encode('utf-8')
            auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
            self.headers["Authorization"] = f"Basic {auth_b64}"
            
    async def connect(self) -> bool:
        """Connect to PrusaLink"""
        try:
            logger.info(f"Connecting to PrusaLink at {self.base_url}")
            
            # Create session
            timeout = aiohttp.ClientTimeout(total=self.config.timeout)
            self.session = aiohttp.ClientSession(
                timeout=timeout,
                headers=self.headers
            )
            
            # Test connection with version endpoint
            async with self.session.get(
                urljoin(self.base_url, "/api/version")
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info(f"Connected to PrusaLink: {data}")
                    
                    # Extract printer info
                    self.status.printer_model = data.get("printer", self.config.model)
                    self.status.firmware_version = data.get("firmware")
                    self.status.serial_number = data.get("serial")
                    
                    self.connected = True
                    
                    # Start polling
                    self.poll_task = asyncio.create_task(self._poll_status())
                    
                    return True
                else:
                    logger.error(f"Connection failed: HTTP {response.status}")
                    return False
                    
        except Exception as e:
            logger.error(f"Connection error: {e}")
            if self.session:
                await self.session.close()
            return False
            
    async def disconnect(self):
        """Disconnect from PrusaLink"""
        self.connected = False
        
        # Cancel polling
        if self.poll_task:
            self.poll_task.cancel()
            try:
                await self.poll_task
            except asyncio.CancelledError:
                pass
                
        # Close session
        if self.session:
            await self.session.close()
            
        logger.info("Disconnected from PrusaLink")
        
    async def _poll_status(self):
        """Continuously poll printer status"""
        while self.connected:
            try:
                await self._update_status()
                await self._update_job_status()
                await asyncio.sleep(self.config.poll_interval)
                
            except Exception as e:
                logger.error(f"Polling error: {e}")
                await asyncio.sleep(self.config.poll_interval * 2)
                
    async def _update_status(self):
        """Update printer status"""
        try:
            # Get printer status
            async with self.session.get(
                urljoin(self.base_url, "/api/printer")
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Update state
                    state_str = data.get("state", {}).get("text", "").lower()
                    self.status.state = self._parse_state(state_str)
                    
                    # Update temperatures
                    telemetry = data.get("telemetry", {})
                    self.status.nozzle_temp = telemetry.get("temp-nozzle", 0.0)
                    self.status.bed_temp = telemetry.get("temp-bed", 0.0)
                    
                    # Targets might be in different location
                    self.status.nozzle_target = telemetry.get("target-nozzle", 0.0)
                    self.status.bed_target = telemetry.get("target-bed", 0.0)
                    
                    # Position (if available)
                    self.status.pos_x = telemetry.get("axis-x")
                    self.status.pos_y = telemetry.get("axis-y")
                    self.status.pos_z = telemetry.get("axis-z")
                    
                    # Trigger callbacks
                    await self._trigger_callbacks()
                    
        except Exception as e:
            logger.error(f"Status update error: {e}")
            
    async def _update_job_status(self):
        """Update current job status"""
        try:
            # Get job status
            async with self.session.get(
                urljoin(self.base_url, "/api/job")
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Update job info
                    job = data.get("job", {})
                    self.status.job_name = job.get("file", {}).get("display_name")
                    
                    # Progress
                    progress = data.get("progress", {})
                    self.status.progress = progress.get("completion", 0.0) * 100
                    self.status.time_printing = progress.get("printTime", 0)
                    self.status.time_remaining = progress.get("printTimeLeft", 0)
                    
                    # Trigger progress callbacks
                    for callback in self.progress_callbacks:
                        try:
                            await callback(self.status.progress)
                        except Exception as e:
                            logger.error(f"Progress callback error: {e}")
                            
        except Exception as e:
            logger.error(f"Job status error: {e}")
            
    def _parse_state(self, state_text: str) -> PrusaLinkState:
        """Parse state string to enum"""
        state_map = {
            "idle": PrusaLinkState.IDLE,
            "busy": PrusaLinkState.BUSY,
            "printing": PrusaLinkState.PRINTING,
            "paused": PrusaLinkState.PAUSED,
            "finished": PrusaLinkState.FINISHED,
            "stopped": PrusaLinkState.STOPPED,
            "error": PrusaLinkState.ERROR,
            "attention": PrusaLinkState.ATTENTION,
            "ready": PrusaLinkState.READY
        }
        
        for key, value in state_map.items():
            if key in state_text.lower():
                return value
                
        return PrusaLinkState.IDLE
        
    async def _trigger_callbacks(self):
        """Trigger registered callbacks"""
        # State callbacks
        for callback in self.state_callbacks:
            try:
                await callback(self.status)
            except Exception as e:
                logger.error(f"State callback error: {e}")
                
        # Temperature callbacks
        for callback in self.temperature_callbacks:
            try:
                await callback(
                    self.status.nozzle_temp,
                    self.status.nozzle_target,
                    self.status.bed_temp,
                    self.status.bed_target
                )
            except Exception as e:
                logger.error(f"Temperature callback error: {e}")
                
    # Control methods
    
    async def set_temperature(self, nozzle: Optional[float] = None, bed: Optional[float] = None):
        """Set target temperatures"""
        try:
            data = {}
            
            if nozzle is not None:
                data["target-nozzle"] = nozzle
                
            if bed is not None:
                data["target-bed"] = bed
                
            async with self.session.post(
                urljoin(self.base_url, "/api/printer/tools"),
                json=data
            ) as response:
                if response.status in [200, 204]:
                    logger.info(f"Temperature set - Nozzle: {nozzle}, Bed: {bed}")
                    return True
                else:
                    logger.error(f"Temperature command failed: {response.status}")
                    return False
                    
        except Exception as e:
            logger.error(f"Temperature control error: {e}")
            return False
            
    async def home_axes(self, axes: str = "XYZ") -> bool:
        """Home printer axes"""
        try:
            # PrusaLink uses G-code for homing
            gcode = f"G28 {' '.join(axes)}"
            
            return await self.send_gcode(gcode)
            
        except Exception as e:
            logger.error(f"Homing error: {e}")
            return False
            
    async def send_gcode(self, gcode: str) -> bool:
        """Send G-code command"""
        try:
            data = {"command": gcode}
            
            async with self.session.post(
                urljoin(self.base_url, "/api/printer/gcode"),
                json=data
            ) as response:
                if response.status in [200, 204]:
                    logger.info(f"G-code sent: {gcode}")
                    return True
                else:
                    logger.error(f"G-code failed: {response.status}")
                    return False
                    
        except Exception as e:
            logger.error(f"G-code error: {e}")
            return False
            
    async def upload_file(self, filename: str, gcode_content: str) -> bool:
        """Upload G-code file"""
        try:
            # Create multipart form
            data = aiohttp.FormData()
            data.add_field('file',
                          gcode_content,
                          filename=filename,
                          content_type='text/plain')
                          
            # Remove content-type header for multipart
            headers = {k: v for k, v in self.headers.items() if k != "Content-Type"}
            
            async with self.session.post(
                urljoin(self.base_url, "/api/files/local"),
                data=data,
                headers=headers
            ) as response:
                if response.status in [200, 201]:
                    logger.info(f"File uploaded: {filename}")
                    return True
                else:
                    logger.error(f"Upload failed: {response.status}")
                    return False
                    
        except Exception as e:
            logger.error(f"Upload error: {e}")
            return False
            
    async def start_print(self, filename: str) -> bool:
        """Start printing a file"""
        try:
            data = {"command": "start"}
            
            async with self.session.post(
                urljoin(self.base_url, f"/api/files/local/{filename}"),
                json=data
            ) as response:
                if response.status in [200, 204]:
                    logger.info(f"Print started: {filename}")
                    return True
                else:
                    logger.error(f"Start print failed: {response.status}")
                    return False
                    
        except Exception as e:
            logger.error(f"Start print error: {e}")
            return False
            
    async def pause_print(self) -> bool:
        """Pause current print"""
        try:
            data = {"command": "pause", "action": "pause"}
            
            async with self.session.post(
                urljoin(self.base_url, "/api/job"),
                json=data
            ) as response:
                if response.status in [200, 204]:
                    logger.info("Print paused")
                    return True
                else:
                    return False
                    
        except Exception as e:
            logger.error(f"Pause error: {e}")
            return False
            
    async def resume_print(self) -> bool:
        """Resume paused print"""
        try:
            data = {"command": "pause", "action": "resume"}
            
            async with self.session.post(
                urljoin(self.base_url, "/api/job"),
                json=data
            ) as response:
                if response.status in [200, 204]:
                    logger.info("Print resumed")
                    return True
                else:
                    return False
                    
        except Exception as e:
            logger.error(f"Resume error: {e}")
            return False
            
    async def cancel_print(self) -> bool:
        """Cancel current print"""
        try:
            data = {"command": "cancel"}
            
            async with self.session.post(
                urljoin(self.base_url, "/api/job"),
                json=data
            ) as response:
                if response.status in [200, 204]:
                    logger.info("Print cancelled")
                    return True
                else:
                    return False
                    
        except Exception as e:
            logger.error(f"Cancel error: {e}")
            return False
            
    async def get_files(self) -> List[Dict[str, Any]]:
        """Get list of files on printer"""
        try:
            async with self.session.get(
                urljoin(self.base_url, "/api/files?recursive=true")
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("files", [])
                else:
                    return []
                    
        except Exception as e:
            logger.error(f"Get files error: {e}")
            return []
            
    def get_status(self) -> Dict[str, Any]:
        """Get current status as dict"""
        return {
            "state": self.status.state.value,
            "connected": self.connected,
            "temperatures": {
                "nozzle": {
                    "current": self.status.nozzle_temp,
                    "target": self.status.nozzle_target
                },
                "bed": {
                    "current": self.status.bed_temp,
                    "target": self.status.bed_target
                }
            },
            "position": {
                "x": self.status.pos_x,
                "y": self.status.pos_y,
                "z": self.status.pos_z
            },
            "job": {
                "name": self.status.job_name,
                "progress": self.status.progress,
                "time_elapsed": self.status.time_printing,
                "time_remaining": self.status.time_remaining
            },
            "printer": {
                "model": self.status.printer_model,
                "firmware": self.status.firmware_version,
                "serial": self.status.serial_number,
                "ip": self.config.host
            }
        }
        
    # Callback registration
    
    def register_state_callback(self, callback: Callable):
        """Register state change callback"""
        self.state_callbacks.append(callback)
        
    def register_temperature_callback(self, callback: Callable):
        """Register temperature update callback"""
        self.temperature_callbacks.append(callback)
        
    def register_progress_callback(self, callback: Callable):
        """Register print progress callback"""
        self.progress_callbacks.append(callback)
        
    def register_error_callback(self, callback: Callable):
        """Register error callback"""
        self.error_callbacks.append(callback)


# Test function
async def test_prusalink():
    """Test PrusaLink connection"""
    
    # Configure connection
    config = PrusaLinkConfig(
        host="192.168.1.100",  # Replace with your printer's IP
        api_key="YOUR_API_KEY",  # Get from PrusaLink settings
        name="Prusa XL"
    )
    
    # Create client
    client = PrusaLinkClient(config)
    
    # Connect
    if await client.connect():
        print("Connected to PrusaLink!")
        
        # Get status
        status = client.get_status()
        print(json.dumps(status, indent=2))
        
        # Monitor for 30 seconds
        await asyncio.sleep(30)
        
        # Disconnect
        await client.disconnect()
        
    else:
        print("Failed to connect")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(test_prusalink())