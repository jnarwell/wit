"""
W.I.T. OctoPrint Integration

Interface for controlling 3D printers via OctoPrint API.
Supports multiple printer management, job control, and monitoring.
"""

import asyncio
import aiohttp
import logging
from typing import Optional, Dict, Any, List, Tuple, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import json
from urllib.parse import urljoin

# Configure logging
logger = logging.getLogger(__name__)


class PrinterState(Enum):
    """Printer states"""
    OFFLINE = "offline"
    OPERATIONAL = "operational"
    PRINTING = "printing"
    PAUSED = "paused"
    CANCELLING = "cancelling"
    ERROR = "error"
    UNKNOWN = "unknown"


class JobState(Enum):
    """Print job states"""
    NONE = "none"
    PRINTING = "printing"
    PAUSED = "paused"
    COMPLETE = "complete"
    CANCELLED = "cancelled"
    ERROR = "error"


@dataclass
class PrinterInfo:
    """Printer information"""
    name: str
    model: str
    state: PrinterState
    connected: bool
    ready: bool
    error: Optional[str] = None
    
    # Temperature info
    extruder_temp: float = 0.0
    extruder_target: float = 0.0
    bed_temp: float = 0.0
    bed_target: float = 0.0
    
    # Position
    x_pos: float = 0.0
    y_pos: float = 0.0
    z_pos: float = 0.0
    
    # Firmware info
    firmware_name: Optional[str] = None
    firmware_version: Optional[str] = None


@dataclass
class PrintJob:
    """Print job information"""
    name: str
    path: str
    size: int
    date: datetime
    origin: str
    
    # Job state
    state: JobState = JobState.NONE
    progress: float = 0.0
    time_elapsed: int = 0
    time_remaining: Optional[int] = None
    
    # Print details
    filament_used: float = 0.0
    filament_total: float = 0.0
    layer_current: Optional[int] = None
    layer_total: Optional[int] = None
    
    # File analysis
    estimated_time: Optional[int] = None
    dimensions: Optional[Dict[str, float]] = None


@dataclass
class OctoPrintConfig:
    """OctoPrint connection configuration"""
    url: str
    api_key: str
    name: str = "3D Printer"
    
    # Connection settings
    timeout: float = 30.0
    retry_count: int = 3
    retry_delay: float = 1.0
    
    # Monitoring settings
    poll_interval: float = 2.0  # seconds
    temperature_poll_interval: float = 5.0
    
    # Safety settings
    max_extruder_temp: float = 280.0
    max_bed_temp: float = 120.0
    auto_connect: bool = True
    
    # Features
    enable_webcam: bool = True
    enable_timelapse: bool = True
    enable_psu_control: bool = False


class OctoPrintClient:
    """OctoPrint API client for single printer"""
    
    def __init__(self, config: OctoPrintConfig):
        self.config = config
        self.session: Optional[aiohttp.ClientSession] = None
        self.connected = False
        self.printer_info = PrinterInfo(
            name=config.name,
            model="Unknown",
            state=PrinterState.OFFLINE,
            connected=False,
            ready=False
        )
        self.current_job: Optional[PrintJob] = None
        
        # Callbacks
        self.state_callbacks: List[Callable] = []
        self.progress_callbacks: List[Callable] = []
        self.error_callbacks: List[Callable] = []
        
        # Monitoring tasks
        self.monitor_task: Optional[asyncio.Task] = None
        self.temp_monitor_task: Optional[asyncio.Task] = None
        
    async def connect(self):
        """Connect to OctoPrint"""
        if self.session is None:
            headers = {
                "X-Api-Key": self.config.api_key,
                "Content-Type": "application/json"
            }
            timeout = aiohttp.ClientTimeout(total=self.config.timeout)
            self.session = aiohttp.ClientSession(
                headers=headers,
                timeout=timeout
            )
            
        try:
            # Test connection
            async with self.session.get(
                urljoin(self.config.url, "/api/version")
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info(f"Connected to OctoPrint {data.get('server', 'Unknown')}")
                    self.connected = True
                    
                    # Get printer info
                    await self._update_printer_info()
                    
                    # Start monitoring
                    await self.start_monitoring()
                    
                    return True
                else:
                    logger.error(f"Failed to connect: HTTP {response.status}")
                    return False
                    
        except Exception as e:
            logger.error(f"Connection error: {e}")
            self.connected = False
            return False
            
    async def disconnect(self):
        """Disconnect from OctoPrint"""
        # Stop monitoring
        await self.stop_monitoring()
        
        # Close session
        if self.session:
            await self.session.close()
            self.session = None
            
        self.connected = False
        logger.info(f"Disconnected from {self.config.name}")
        
    async def start_monitoring(self):
        """Start monitoring tasks"""
        if not self.monitor_task or self.monitor_task.done():
            self.monitor_task = asyncio.create_task(self._monitor_loop())
            
        if not self.temp_monitor_task or self.temp_monitor_task.done():
            self.temp_monitor_task = asyncio.create_task(self._temperature_monitor_loop())
            
    async def stop_monitoring(self):
        """Stop monitoring tasks"""
        if self.monitor_task:
            self.monitor_task.cancel()
            
        if self.temp_monitor_task:
            self.temp_monitor_task.cancel()
            
    async def _monitor_loop(self):
        """Monitor printer state and job progress"""
        while self.connected:
            try:
                await self._update_printer_state()
                await self._update_job_state()
                await asyncio.sleep(self.config.poll_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Monitor error: {e}")
                await asyncio.sleep(self.config.retry_delay)
                
    async def _temperature_monitor_loop(self):
        """Monitor temperatures"""
        while self.connected:
            try:
                await self._update_temperatures()
                await asyncio.sleep(self.config.temperature_poll_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Temperature monitor error: {e}")
                await asyncio.sleep(self.config.retry_delay)
                
    async def _update_printer_info(self):
        """Update printer information"""
        try:
            async with self.session.get(
                urljoin(self.config.url, "/api/printerprofiles/_default")
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    self.printer_info.model = data.get("model", "Unknown")
                    
        except Exception as e:
            logger.error(f"Failed to get printer info: {e}")
            
    async def _update_printer_state(self):
        """Update printer state"""
        try:
            async with self.session.get(
                urljoin(self.config.url, "/api/printer")
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Update state
                    state_data = data.get("state", {})
                    state_text = state_data.get("text", "").lower()
                    
                    if "operational" in state_text:
                        self.printer_info.state = PrinterState.OPERATIONAL
                    elif "printing" in state_text:
                        self.printer_info.state = PrinterState.PRINTING
                    elif "paused" in state_text:
                        self.printer_info.state = PrinterState.PAUSED
                    elif "error" in state_text:
                        self.printer_info.state = PrinterState.ERROR
                        self.printer_info.error = state_text
                    elif "offline" in state_text:
                        self.printer_info.state = PrinterState.OFFLINE
                    else:
                        self.printer_info.state = PrinterState.UNKNOWN
                        
                    self.printer_info.ready = state_data.get("ready", False)
                    
                    # Trigger callbacks
                    await self._trigger_state_callbacks()
                    
                elif response.status == 409:
                    # Printer not connected
                    self.printer_info.state = PrinterState.OFFLINE
                    self.printer_info.connected = False
                    
        except Exception as e:
            logger.error(f"Failed to update printer state: {e}")
            
    async def _update_temperatures(self):
        """Update temperature readings"""
        try:
            async with self.session.get(
                urljoin(self.config.url, "/api/printer")
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    temps = data.get("temperature", {})
                    
                    # Update extruder temperature
                    tool0 = temps.get("tool0", {})
                    self.printer_info.extruder_temp = tool0.get("actual", 0.0)
                    self.printer_info.extruder_target = tool0.get("target", 0.0)
                    
                    # Update bed temperature
                    bed = temps.get("bed", {})
                    self.printer_info.bed_temp = bed.get("actual", 0.0)
                    self.printer_info.bed_target = bed.get("target", 0.0)
                    
                    # Check safety limits
                    if self.printer_info.extruder_temp > self.config.max_extruder_temp:
                        await self._trigger_error(
                            f"Extruder temperature too high: {self.printer_info.extruder_temp}°C"
                        )
                        
                    if self.printer_info.bed_temp > self.config.max_bed_temp:
                        await self._trigger_error(
                            f"Bed temperature too high: {self.printer_info.bed_temp}°C"
                        )
                        
        except Exception as e:
            logger.error(f"Failed to update temperatures: {e}")
            
    async def _update_job_state(self):
        """Update current job state"""
        try:
            async with self.session.get(
                urljoin(self.config.url, "/api/job")
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    job_data = data.get("job", {})
                    if job_data.get("file", {}).get("name"):
                        # Create or update job
                        if not self.current_job:
                            self.current_job = PrintJob(
                                name=job_data["file"]["name"],
                                path=job_data["file"]["path"],
                                size=job_data["file"].get("size", 0),
                                date=datetime.now(),
                                origin=job_data["file"].get("origin", "local")
                            )
                            
                        # Update state
                        state = data.get("state", "").lower()
                        if "printing" in state:
                            self.current_job.state = JobState.PRINTING
                        elif "paused" in state:
                            self.current_job.state = JobState.PAUSED
                        elif "complete" in state:
                            self.current_job.state = JobState.COMPLETE
                        elif "cancelled" in state:
                            self.current_job.state = JobState.CANCELLED
                        elif "error" in state:
                            self.current_job.state = JobState.ERROR
                            
                        # Update progress
                        progress = data.get("progress", {})
                        self.current_job.progress = progress.get("completion", 0.0)
                        self.current_job.time_elapsed = progress.get("printTime", 0)
                        self.current_job.time_remaining = progress.get("printTimeLeft")
                        
                        # Trigger callbacks
                        await self._trigger_progress_callbacks()
                        
                    else:
                        # No active job
                        self.current_job = None
                        
        except Exception as e:
            logger.error(f"Failed to update job state: {e}")
            
    # Control methods
    async def start_print(self, file_path: str) -> bool:
        """Start printing a file"""
        if not self.connected or self.printer_info.state != PrinterState.OPERATIONAL:
            logger.error("Printer not ready for printing")
            return False
            
        try:
            payload = {
                "command": "select",
                "print": True
            }
            
            async with self.session.post(
                urljoin(self.config.url, f"/api/files/local/{file_path}"),
                json=payload
            ) as response:
                if response.status in [200, 204]:
                    logger.info(f"Started printing: {file_path}")
                    return True
                else:
                    logger.error(f"Failed to start print: HTTP {response.status}")
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to start print: {e}")
            return False
            
    async def pause_print(self) -> bool:
        """Pause current print"""
        if not self.current_job or self.current_job.state != JobState.PRINTING:
            logger.error("No active print to pause")
            return False
            
        try:
            payload = {"command": "pause", "action": "pause"}
            
            async with self.session.post(
                urljoin(self.config.url, "/api/job"),
                json=payload
            ) as response:
                if response.status in [200, 204]:
                    logger.info("Print paused")
                    return True
                else:
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to pause print: {e}")
            return False
            
    async def resume_print(self) -> bool:
        """Resume paused print"""
        if not self.current_job or self.current_job.state != JobState.PAUSED:
            logger.error("No paused print to resume")
            return False
            
        try:
            payload = {"command": "pause", "action": "resume"}
            
            async with self.session.post(
                urljoin(self.config.url, "/api/job"),
                json=payload
            ) as response:
                if response.status in [200, 204]:
                    logger.info("Print resumed")
                    return True
                else:
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to resume print: {e}")
            return False
            
    async def cancel_print(self) -> bool:
        """Cancel current print"""
        if not self.current_job:
            logger.error("No active print to cancel")
            return False
            
        try:
            payload = {"command": "cancel"}
            
            async with self.session.post(
                urljoin(self.config.url, "/api/job"),
                json=payload
            ) as response:
                if response.status in [200, 204]:
                    logger.info("Print cancelled")
                    return True
                else:
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to cancel print: {e}")
            return False
            
    async def home_axes(self, axes: List[str] = ["x", "y", "z"]) -> bool:
        """Home printer axes"""
        if self.printer_info.state != PrinterState.OPERATIONAL:
            logger.error("Printer not ready for homing")
            return False
            
        try:
            payload = {
                "command": "home",
                "axes": axes
            }
            
            async with self.session.post(
                urljoin(self.config.url, "/api/printer/printhead"),
                json=payload
            ) as response:
                if response.status in [200, 204]:
                    logger.info(f"Homed axes: {axes}")
                    return True
                else:
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to home axes: {e}")
            return False
            
    async def set_temperatures(self, extruder: Optional[float] = None, 
                             bed: Optional[float] = None) -> bool:
        """Set target temperatures"""
        try:
            payload = {"command": "target"}
            
            if extruder is not None:
                # Safety check
                if extruder > self.config.max_extruder_temp:
                    logger.error(f"Extruder temperature too high: {extruder}")
                    return False
                payload["targets"] = {"tool0": extruder}
                
            if bed is not None:
                # Safety check
                if bed > self.config.max_bed_temp:
                    logger.error(f"Bed temperature too high: {bed}")
                    return False
                if "targets" not in payload:
                    payload["targets"] = {}
                payload["targets"]["bed"] = bed
                
            async with self.session.post(
                urljoin(self.config.url, "/api/printer/tool"),
                json=payload
            ) as response:
                if response.status in [200, 204]:
                    logger.info(f"Set temperatures - Extruder: {extruder}, Bed: {bed}")
                    return True
                else:
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to set temperatures: {e}")
            return False
            
    async def jog(self, x: float = 0, y: float = 0, z: float = 0, 
                  speed: Optional[int] = None) -> bool:
        """Jog printer head"""
        if self.printer_info.state != PrinterState.OPERATIONAL:
            logger.error("Printer not ready for jogging")
            return False
            
        try:
            payload = {
                "command": "jog",
                "x": x,
                "y": y,
                "z": z
            }
            
            if speed is not None:
                payload["speed"] = speed
                
            async with self.session.post(
                urljoin(self.config.url, "/api/printer/printhead"),
                json=payload
            ) as response:
                if response.status in [200, 204]:
                    return True
                else:
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to jog: {e}")
            return False
            
    async def send_gcode(self, commands: List[str]) -> bool:
        """Send raw G-code commands"""
        if self.printer_info.state not in [PrinterState.OPERATIONAL, PrinterState.PRINTING]:
            logger.error("Printer not ready for commands")
            return False
            
        try:
            payload = {"commands": commands}
            
            async with self.session.post(
                urljoin(self.config.url, "/api/printer/command"),
                json=payload
            ) as response:
                if response.status in [200, 204]:
                    logger.info(f"Sent G-code: {commands}")
                    return True
                else:
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to send G-code: {e}")
            return False
            
    async def get_files(self, location: str = "local") -> List[Dict[str, Any]]:
        """Get list of available files"""
        try:
            async with self.session.get(
                urljoin(self.config.url, f"/api/files/{location}")
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("files", [])
                else:
                    return []
                    
        except Exception as e:
            logger.error(f"Failed to get files: {e}")
            return []
            
    async def upload_file(self, file_data: bytes, filename: str) -> bool:
        """Upload file to OctoPrint"""
        try:
            data = aiohttp.FormData()
            data.add_field('file', file_data, filename=filename)
            
            async with self.session.post(
                urljoin(self.config.url, "/api/files/local"),
                data=data
            ) as response:
                if response.status in [200, 201]:
                    logger.info(f"Uploaded file: {filename}")
                    return True
                else:
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to upload file: {e}")
            return False
            
    # Callbacks
    def register_state_callback(self, callback: Callable):
        """Register callback for state changes"""
        self.state_callbacks.append(callback)
        
    def register_progress_callback(self, callback: Callable):
        """Register callback for progress updates"""
        self.progress_callbacks.append(callback)
        
    def register_error_callback(self, callback: Callable):
        """Register callback for errors"""
        self.error_callbacks.append(callback)
        
    async def _trigger_state_callbacks(self):
        """Trigger state change callbacks"""
        for callback in self.state_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(self.printer_info)
                else:
                    await asyncio.get_event_loop().run_in_executor(
                        None, callback, self.printer_info
                    )
            except Exception as e:
                logger.error(f"State callback error: {e}")
                
    async def _trigger_progress_callbacks(self):
        """Trigger progress callbacks"""
        if not self.current_job:
            return
            
        for callback in self.progress_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(self.current_job)
                else:
                    await asyncio.get_event_loop().run_in_executor(
                        None, callback, self.current_job
                    )
            except Exception as e:
                logger.error(f"Progress callback error: {e}")
                
    async def _trigger_error(self, error_msg: str):
        """Trigger error callbacks"""
        for callback in self.error_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(error_msg)
                else:
                    await asyncio.get_event_loop().run_in_executor(
                        None, callback, error_msg
                    )
            except Exception as e:
                logger.error(f"Error callback error: {e}")
                
    def get_status(self) -> Dict[str, Any]:
        """Get printer status summary"""
        status = {
            "name": self.config.name,
            "connected": self.connected,
            "state": self.printer_info.state.value,
            "ready": self.printer_info.ready,
            "temperatures": {
                "extruder": {
                    "actual": self.printer_info.extruder_temp,
                    "target": self.printer_info.extruder_target
                },
                "bed": {
                    "actual": self.printer_info.bed_temp,
                    "target": self.printer_info.bed_target
                }
            }
        }
        
        if self.current_job:
            status["job"] = {
                "name": self.current_job.name,
                "state": self.current_job.state.value,
                "progress": self.current_job.progress,
                "time_elapsed": self.current_job.time_elapsed,
                "time_remaining": self.current_job.time_remaining
            }
            
        return status


class OctoPrintManager:
    """Manager for multiple OctoPrint instances"""
    
    def __init__(self):
        self.printers: Dict[str, OctoPrintClient] = {}
        
    async def add_printer(self, printer_id: str, config: OctoPrintConfig) -> bool:
        """Add a printer"""
        if printer_id in self.printers:
            logger.warning(f"Printer {printer_id} already exists")
            return False
            
        client = OctoPrintClient(config)
        if await client.connect():
            self.printers[printer_id] = client
            logger.info(f"Added printer: {printer_id}")
            return True
        else:
            return False
            
    async def remove_printer(self, printer_id: str) -> bool:
        """Remove a printer"""
        if printer_id in self.printers:
            await self.printers[printer_id].disconnect()
            del self.printers[printer_id]
            logger.info(f"Removed printer: {printer_id}")
            return True
        return False
        
    def get_printer(self, printer_id: str) -> Optional[OctoPrintClient]:
        """Get printer by ID"""
        return self.printers.get(printer_id)
        
    def get_all_printers(self) -> Dict[str, OctoPrintClient]:
        """Get all printers"""
        return self.printers
        
    def get_status_summary(self) -> Dict[str, Any]:
        """Get status of all printers"""
        summary = {
            "total_printers": len(self.printers),
            "printers": {}
        }
        
        for printer_id, client in self.printers.items():
            summary["printers"][printer_id] = client.get_status()
            
        return summary
        
    async def shutdown(self):
        """Shutdown all connections"""
        for client in self.printers.values():
            await client.disconnect()
        self.printers.clear()


# Example usage
async def main():
    """Example usage"""
    # Configure printer
    config = OctoPrintConfig(
        url="http://octopi.local",
        api_key="YOUR_API_KEY",
        name="Prusa MK3S+"
    )
    
    # Create manager
    manager = OctoPrintManager()
    
    # Add printer
    if await manager.add_printer("printer1", config):
        printer = manager.get_printer("printer1")
        
        # Register callbacks
        async def on_state_change(info: PrinterInfo):
            print(f"State changed: {info.state.value}")
            
        async def on_progress(job: PrintJob):
            print(f"Progress: {job.progress:.1f}%")
            
        printer.register_state_callback(on_state_change)
        printer.register_progress_callback(on_progress)
        
        # Example operations
        files = await printer.get_files()
        print(f"Available files: {len(files)}")
        
        # Start a print
        if files and printer.printer_info.state == PrinterState.OPERATIONAL:
            await printer.start_print(files[0]["path"])
            
        # Monitor for a while
        await asyncio.sleep(30)
        
        # Get status
        status = manager.get_status_summary()
        print(json.dumps(status, indent=2))
        
    # Cleanup
    await manager.shutdown()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())