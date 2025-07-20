"""
W.I.T. PrusaLink Integration

Network interface for controlling Prusa printers via PrusaLink API.
Supports Prusa XL, MK4, MINI+ with PrusaLink firmware.
Updated to use username/password authentication.
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
    username: str = "maker"  # Default username
    password: str = ""  # Required password
    
    # Legacy API key support (for newer firmware that might add it)
    api_key: Optional[str] = None
    
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
    """PrusaLink API client with username/password authentication"""
    
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
        
        # Setup authentication headers
        self.headers = {"Content-Type": "application/json"}
        
        # Use Basic Auth with username/password
        if config.username and config.password:
            auth_str = f"{config.username}:{config.password}"
            auth_bytes = auth_str.encode('utf-8')
            auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
            self.headers["Authorization"] = f"Basic {auth_b64}"
        # Fallback to API key if provided (for future compatibility)
        elif config.api_key:
            self.headers["X-Api-Key"] = config.api_key
        else:
            logger.warning("No authentication credentials provided")
            
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
                    self.status.hostname = data.get("hostname")
                    
                    self.connected = True
                    
                    # Start polling
                    self.poll_task = asyncio.create_task(self._poll_status())
                    
                    return True
                elif response.status == 401:
                    logger.error("Authentication failed - check username/password")
                    return False
                else:
                    logger.error(f"Connection failed: HTTP {response.status}")
                    return False
                    
        except Exception as e:
            logger.error(f"Connection error: {e}")
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
            
    async def _poll_status(self):
        """Poll printer status periodically"""
        while self.connected:
            try:
                await self._update_status()
                await asyncio.sleep(self.config.poll_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Polling error: {e}")
                await asyncio.sleep(self.config.poll_interval)
                
    async def _update_status(self):
        """Update printer status from API"""
        try:
            # Get printer status
            async with self.session.get(
                urljoin(self.base_url, "/api/printer")
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Update state
                    state_text = data.get("state", {}).get("text", "").lower()
                    self.status.state = self._parse_state(state_text)
                    
                    # Update temperatures from telemetry
                    telemetry = data.get("telemetry", {})
                    
                    # Nozzle temperature
                    self.status.nozzle_temp = telemetry.get("temp-nozzle", 0.0)
                    self.status.nozzle_target = telemetry.get("target-nozzle", 0.0)
                    
                    # Bed temperature
                    self.status.bed_temp = telemetry.get("temp-bed", 0.0)
                    self.status.bed_target = telemetry.get("target-bed", 0.0)
                    
                    # Position
                    self.status.pos_x = telemetry.get("axis-x", 0.0)
                    self.status.pos_y = telemetry.get("axis-y", 0.0)
                    self.status.pos_z = telemetry.get("axis-z", 0.0)
                    
                    # Print progress
                    self.status.progress = telemetry.get("print-progress", 0.0)
                    
                    # Notify callbacks
                    for callback in self.state_callbacks:
                        await callback(self.status.state)
                        
                    for callback in self.temperature_callbacks:
                        await callback({
                            "nozzle": {"current": self.status.nozzle_temp, "target": self.status.nozzle_target},
                            "bed": {"current": self.status.bed_temp, "target": self.status.bed_target}
                        })
                        
            # Get job status if printing
            if self.status.state in [PrusaLinkState.PRINTING, PrusaLinkState.PAUSED]:
                async with self.session.get(
                    urljoin(self.base_url, "/api/job")
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        # Job info
                        self.status.job_name = data.get("file", {}).get("name")
                        
                        # Progress
                        progress = data.get("progress", {})
                        self.status.progress = progress.get("completion", 0.0) or 0.0
                        self.status.time_printing = progress.get("printTime", 0) or 0
                        self.status.time_remaining = progress.get("printTimeLeft", 0) or 0
                        
                        # Notify progress callbacks
                        for callback in self.progress_callbacks:
                            await callback(self.status.progress)
                            
        except Exception as e:
            logger.error(f"Status update error: {e}")
            self.status.state = PrusaLinkState.OFFLINE
            
            # Notify error callbacks
            for callback in self.error_callbacks:
                await callback(str(e))
                
    def _parse_state(self, state_text: str) -> PrusaLinkState:
        """Parse state text to enum"""
        state_map = {
            "idle": PrusaLinkState.IDLE,
            "busy": PrusaLinkState.BUSY,
            "printing": PrusaLinkState.PRINTING,
            "paused": PrusaLinkState.PAUSED,
            "finished": PrusaLinkState.FINISHED,
            "stopped": PrusaLinkState.STOPPED,
            "error": PrusaLinkState.ERROR,
            "attention": PrusaLinkState.ATTENTION,
            "ready": PrusaLinkState.READY,
            "operational": PrusaLinkState.IDLE
        }
        
        return state_map.get(state_text.lower(), PrusaLinkState.OFFLINE)
        
    def get_status(self) -> Dict[str, Any]:
        """Get current printer status"""
        return {
            "connected": self.connected,
            "state": self.status.state.value,
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
            "job": {
                "name": self.status.job_name,
                "progress": self.status.progress,
                "time_printing": self.status.time_printing,
                "time_remaining": self.status.time_remaining
            },
            "position": {
                "x": self.status.pos_x,
                "y": self.status.pos_y,
                "z": self.status.pos_z
            },
            "printer": {
                "model": self.status.printer_model,
                "firmware": self.status.firmware_version,
                "serial": self.status.serial_number,
                "hostname": self.status.hostname
            }
        }
        
    # Control methods
    async def start_print(self, filename: str) -> bool:
        """Start printing a file"""
        if not self.connected:
            return False
            
        try:
            data = {"command": "start"}
            
            async with self.session.post(
                urljoin(self.base_url, f"/api/files/local/{filename}"),
                json=data
            ) as response:
                return response.status == 204
                
        except Exception as e:
            logger.error(f"Start print error: {e}")
            return False
            
    async def pause_print(self) -> bool:
        """Pause current print"""
        if not self.connected:
            return False
            
        try:
            data = {"command": "pause", "action": "pause"}
            
            async with self.session.post(
                urljoin(self.base_url, "/api/job"),
                json=data
            ) as response:
                return response.status == 204
                
        except Exception as e:
            logger.error(f"Pause print error: {e}")
            return False
            
    async def resume_print(self) -> bool:
        """Resume paused print"""
        if not self.connected:
            return False
            
        try:
            data = {"command": "pause", "action": "resume"}
            
            async with self.session.post(
                urljoin(self.base_url, "/api/job"),
                json=data
            ) as response:
                return response.status == 204
                
        except Exception as e:
            logger.error(f"Resume print error: {e}")
            return False
            
    async def cancel_print(self) -> bool:
        """Cancel current print"""
        if not self.connected:
            return False
            
        try:
            data = {"command": "cancel"}
            
            async with self.session.post(
                urljoin(self.base_url, "/api/job"),
                json=data
            ) as response:
                return response.status == 204
                
        except Exception as e:
            logger.error(f"Cancel print error: {e}")
            return False
            
    async def set_temperatures(self, nozzle: Optional[float] = None, bed: Optional[float] = None) -> bool:
        """Set target temperatures"""
        if not self.connected:
            return False
            
        try:
            # PrusaLink uses different endpoints for nozzle and bed
            success = True
            
            if nozzle is not None:
                data = {"command": "target", "target": nozzle}
                async with self.session.post(
                    urljoin(self.base_url, "/api/printer/tool"),
                    json=data
                ) as response:
                    success &= response.status == 204
                    
            if bed is not None:
                data = {"command": "target", "target": bed}
                async with self.session.post(
                    urljoin(self.base_url, "/api/printer/bed"),
                    json=data
                ) as response:
                    success &= response.status == 204
                    
            return success
            
        except Exception as e:
            logger.error(f"Set temperature error: {e}")
            return False
            
    async def home_axes(self, axes: List[str] = ["x", "y", "z"]) -> bool:
        """Home printer axes"""
        if not self.connected:
            return False
            
        try:
            data = {
                "command": "home",
                "axes": axes
            }
            
            async with self.session.post(
                urljoin(self.base_url, "/api/printer/printhead"),
                json=data
            ) as response:
                return response.status == 204
                
        except Exception as e:
            logger.error(f"Home axes error: {e}")
            return False
            
    async def jog(self, x: float = 0, y: float = 0, z: float = 0, relative: bool = True) -> bool:
        """Jog printer axes"""
        if not self.connected:
            return False
            
        try:
            data = {
                "command": "jog",
                "x": x,
                "y": y,
                "z": z,
                "absolute": not relative
            }
            
            async with self.session.post(
                urljoin(self.base_url, "/api/printer/printhead"),
                json=data
            ) as response:
                return response.status == 204
                
        except Exception as e:
            logger.error(f"Jog error: {e}")
            return False
            
    async def get_files(self) -> List[Dict[str, Any]]:
        """Get list of files on printer"""
        if not self.connected:
            return []
            
        try:
            async with self.session.get(
                urljoin(self.base_url, "/api/files/local")
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("files", [])
                    
        except Exception as e:
            logger.error(f"Get files error: {e}")
            
        return []
        
    async def upload_file(self, filename: str, file_data: bytes) -> bool:
        """Upload file to printer"""
        if not self.connected:
            return False
            
        try:
            # Create multipart form data
            data = aiohttp.FormData()
            data.add_field('file', file_data, filename=filename)
            
            # PrusaLink doesn't use the JSON content-type for uploads
            headers = dict(self.headers)
            headers.pop("Content-Type", None)
            
            async with self.session.post(
                urljoin(self.base_url, "/api/files/local"),
                data=data,
                headers=headers
            ) as response:
                return response.status in [201, 204]
                
        except Exception as e:
            logger.error(f"Upload file error: {e}")
            return False
            
    async def delete_file(self, filename: str) -> bool:
        """Delete file from printer"""
        if not self.connected:
            return False
            
        try:
            async with self.session.delete(
                urljoin(self.base_url, f"/api/files/local/{filename}")
            ) as response:
                return response.status == 204
                
        except Exception as e:
            logger.error(f"Delete file error: {e}")
            return False
            
    # Callback management
    def add_state_callback(self, callback: Callable):
        """Add state change callback"""
        self.state_callbacks.append(callback)
        
    def add_temperature_callback(self, callback: Callable):
        """Add temperature update callback"""
        self.temperature_callbacks.append(callback)
        
    def add_progress_callback(self, callback: Callable):
        """Add print progress callback"""
        self.progress_callbacks.append(callback)
        
    def add_error_callback(self, callback: Callable):
        """Add error callback"""
        self.error_callbacks.append(callback)


# Example usage
async def main():
    """Example usage of PrusaLink client"""
    
    # Configure connection
    config = PrusaLinkConfig(
        host="192.168.1.134",  # Your printer IP
        username="maker",       # Default username
        password="your_password_here"  # Your password from PrusaLink settings
    )
    
    # Create client
    client = PrusaLinkClient(config)
    
    # Define callbacks
    async def on_state_change(state):
        print(f"State changed: {state}")
        
    async def on_temperature_update(temps):
        print(f"Temperatures: Nozzle={temps['nozzle']['current']}°C, Bed={temps['bed']['current']}°C")
        
    async def on_progress_update(progress):
        print(f"Print progress: {progress:.1f}%")
        
    # Register callbacks
    client.add_state_callback(on_state_change)
    client.add_temperature_callback(on_temperature_update)
    client.add_progress_callback(on_progress_update)
    
    # Connect
    if await client.connect():
        print("Connected to PrusaLink!")
        
        # Get status
        status = client.get_status()
        print(f"Current status: {json.dumps(status, indent=2)}")
        
        # Keep running for 30 seconds to see updates
        await asyncio.sleep(30)
        
        # Disconnect
        await client.disconnect()
    else:
        print("Failed to connect")


if __name__ == "__main__":
    asyncio.run(main())