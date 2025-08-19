# software/backend/core/machine_implementations.py
"""
Concrete machine implementations using the base interfaces
"""
import asyncio
from typing import Dict, Any, Optional, Tuple, List
import logging

from .machine_interface import BaseMachine, MachineCommandResponse
from .machine_types import MachineType, MachineCapability, PrinterState
from .connections import SerialConnection, GCodeConnection, HTTPConnection, OctoPrintConnection
from .state_manager import get_state_manager


class GCodePrinter(BaseMachine):
    """Generic GCODE-based 3D printer over serial"""
    
    def __init__(self, machine_id: str, port: str, baudrate: int = 115200):
        connection = GCodeConnection(port, baudrate)
        super().__init__(machine_id, MachineType.PRINTER_3D_FDM, connection)
        self._capabilities = [
            MachineCapability.START,
            MachineCapability.PAUSE,
            MachineCapability.CANCEL,
            MachineCapability.TEMP_HOTEND,
            MachineCapability.TEMP_BED,
            MachineCapability.HOME,
            MachineCapability.JOG,
            MachineCapability.PROGRESS,
        ]
        self._state_manager = get_state_manager()
        self._current_file: Optional[str] = None
        self._job_start_time: Optional[float] = None
        
    async def connect(self) -> bool:
        """Connect and register with state manager"""
        if await self.connection.connect():
            await self._state_manager.register_machine(self.machine_id, self.machine_type)
            await self._state_manager.update_state(self.machine_id, "OPERATIONAL")
            self._state = PrinterState.IDLE
            return True
        return False
        
    async def get_current_state(self) -> PrinterState:
        """Get current state from state manager"""
        state_data = await self._state_manager.get_state(self.machine_id)
        if state_data:
            return state_data.state
        return PrinterState.UNKNOWN
        
    async def get_temperatures(self) -> Dict[str, Tuple[float, float]]:
        """Get temperatures via M105"""
        temps = {}
        if isinstance(self.connection, GCodeConnection):
            temp_data = await self.connection.get_temperature()
            if temp_data:
                temps["hotend"] = (temp_data.get("current", 0), temp_data.get("target", 0))
                # TODO: Parse bed temp from response
        return temps
        
    async def get_progress(self) -> Optional[float]:
        """Get print progress"""
        state = await self.get_current_state()
        if state == PrinterState.PRINTING:
            # Basic progress calculation - would need enhancement
            return 50.0  # Placeholder
        return None
        
    async def get_time_remaining(self) -> Optional[int]:
        """Get estimated time remaining"""
        # Would need to track this based on file analysis
        return None
        
    async def get_current_job(self) -> Optional[Dict[str, Any]]:
        """Get current job info"""
        state = await self.get_current_state()
        if state in [PrinterState.PRINTING, PrinterState.PAUSED]:
            return {
                "file": self._current_file,
                "progress": await self.get_progress(),
                "state": state.value
            }
        return None
        
    async def start(self, file_path: Optional[str] = None) -> MachineCommandResponse:
        """Start printing"""
        state = await self.get_current_state()
        if state != PrinterState.IDLE:
            return MachineCommandResponse.error("Not idle", "INVALID_STATE")
            
        if file_path:
            # Would need to handle file upload/selection
            self._current_file = file_path
            
        # Start print
        response = await self.connection.send_command("M23", {"filename": file_path})
        if response.success:
            await self.connection.send_command("M24")  # Start/resume SD print
            await self._state_manager.update_state(self.machine_id, "PRINTING")
            return MachineCommandResponse.success()
        return response
        
    async def pause(self) -> MachineCommandResponse:
        """Pause printing"""
        state = await self.get_current_state()
        if state != PrinterState.PRINTING:
            return MachineCommandResponse.error("Not printing", "INVALID_STATE")
            
        response = await self.connection.send_command("M25")  # Pause SD print
        if response.success:
            await self._state_manager.update_state(self.machine_id, "PAUSED")
        return response
        
    async def resume(self) -> MachineCommandResponse:
        """Resume printing"""
        state = await self.get_current_state()
        if state != PrinterState.PAUSED:
            return MachineCommandResponse.error("Not paused", "INVALID_STATE")
            
        response = await self.connection.send_command("M24")  # Resume SD print
        if response.success:
            await self._state_manager.update_state(self.machine_id, "PRINTING")
        return response
        
    async def cancel(self) -> MachineCommandResponse:
        """Cancel printing"""
        state = await self.get_current_state()
        if state not in [PrinterState.PRINTING, PrinterState.PAUSED]:
            return MachineCommandResponse.error("Not printing", "INVALID_STATE")
            
        # Cancel sequence
        await self.connection.send_command("M25")  # Pause first
        response = await self.connection.send_command("M524")  # Abort SD print
        if response.success:
            await self._state_manager.update_state(self.machine_id, "CANCELLED")
            self._current_file = None
        return response
        
    async def home(self, axes: Optional[List[str]] = None) -> MachineCommandResponse:
        """Home axes"""
        if axes:
            axes_str = "".join(axes).upper()
            return await self.connection.send_command(f"G28 {axes_str}")
        else:
            return await self.connection.send_command("G28")
            
    async def jog(self, axis: str, distance: float, speed: Optional[float] = None) -> MachineCommandResponse:
        """Jog an axis"""
        # Set to relative positioning
        await self.connection.send_command("G91")
        
        # Jog command
        cmd = f"G1 {axis.upper()}{distance}"
        if speed:
            cmd += f" F{speed}"
        response = await self.connection.send_command(cmd)
        
        # Back to absolute
        await self.connection.send_command("G90")
        
        return response
        
    async def set_temperature(self, zone: str, target: float) -> MachineCommandResponse:
        """Set temperature"""
        if zone.lower() == "hotend":
            return await self.connection.send_command(f"M104 S{target}")
        elif zone.lower() == "bed":
            return await self.connection.send_command(f"M140 S{target}")
        else:
            return MachineCommandResponse.error(f"Unknown zone: {zone}", "INVALID_ZONE")
            
    async def emergency_stop(self) -> MachineCommandResponse:
        """Emergency stop"""
        response = await self.connection.send_command("M112")
        await self._state_manager.update_state(self.machine_id, "ERROR")
        return response
        
    async def upload_file(self, file_path: str, content: bytes) -> MachineCommandResponse:
        """Upload file - not implemented for serial"""
        return MachineCommandResponse.error("File upload not supported over serial", "NOT_SUPPORTED")
        
    async def list_files(self, path: Optional[str] = None) -> List[Dict[str, Any]]:
        """List SD card files"""
        response = await self.connection.send_command("M20")
        # Would need to parse response
        return []
        
    async def delete_file(self, file_path: str) -> MachineCommandResponse:
        """Delete file from SD"""
        return await self.connection.send_command(f"M30 {file_path}")


class OctoPrintPrinter(BaseMachine):
    """OctoPrint-based 3D printer"""
    
    def __init__(self, machine_id: str, base_url: str, api_key: str):
        connection = OctoPrintConnection(base_url, api_key)
        super().__init__(machine_id, MachineType.PRINTER_3D_FDM, connection)
        self._capabilities = [
            MachineCapability.START,
            MachineCapability.PAUSE,
            MachineCapability.RESUME,
            MachineCapability.CANCEL,
            MachineCapability.TEMP_HOTEND,
            MachineCapability.TEMP_BED,
            MachineCapability.HOME,
            MachineCapability.JOG,
            MachineCapability.UPLOAD,
            MachineCapability.LIST_FILES,
            MachineCapability.DELETE,
            MachineCapability.PROGRESS,
            MachineCapability.CAMERA,
        ]
        self._state_manager = get_state_manager()
        
    async def connect(self) -> bool:
        """Connect to OctoPrint"""
        if await self.connection.connect():
            await self._state_manager.register_machine(self.machine_id, self.machine_type)
            # Get initial state
            await self._update_state()
            return True
        return False
        
    async def _update_state(self):
        """Update state from OctoPrint"""
        if isinstance(self.connection, OctoPrintConnection):
            state_data = await self.connection.get_printer_state()
            if state_data and "state" in state_data:
                octo_state = state_data["state"]["text"]
                
                # Get job info
                job_data = await self.connection.get_job_info()
                additional_data = {}
                
                if job_data:
                    if "job" in job_data:
                        additional_data["job"] = job_data["job"]
                    if "progress" in job_data:
                        additional_data["progress"] = job_data["progress"]["completion"]
                    if "job" in job_data and job_data["job"]["estimatedPrintTime"]:
                        progress = job_data["progress"]["completion"] or 0
                        est_time = job_data["job"]["estimatedPrintTime"]
                        additional_data["time_remaining"] = int(est_time * (1 - progress / 100))
                        
                await self._state_manager.update_state(
                    self.machine_id, 
                    octo_state,
                    additional_data
                )
                
    async def get_current_state(self) -> PrinterState:
        """Get current state"""
        await self._update_state()
        state_data = await self._state_manager.get_state(self.machine_id)
        if state_data:
            return state_data.state
        return PrinterState.UNKNOWN
        
    async def get_temperatures(self) -> Dict[str, Tuple[float, float]]:
        """Get temperatures from OctoPrint"""
        temps = {}
        if isinstance(self.connection, OctoPrintConnection):
            state = await self.connection.get_printer_state()
            if state and "temperature" in state:
                temp_data = state["temperature"]
                if "tool0" in temp_data:
                    temps["hotend"] = (
                        temp_data["tool0"]["actual"],
                        temp_data["tool0"]["target"]
                    )
                if "bed" in temp_data:
                    temps["bed"] = (
                        temp_data["bed"]["actual"],
                        temp_data["bed"]["target"]
                    )
        return temps
        
    async def get_progress(self) -> Optional[float]:
        """Get print progress"""
        state_data = await self._state_manager.get_state(self.machine_id)
        if state_data:
            return state_data.job_progress
        return None
        
    async def get_time_remaining(self) -> Optional[int]:
        """Get time remaining"""
        state_data = await self._state_manager.get_state(self.machine_id)
        if state_data:
            return state_data.time_remaining
        return None
        
    async def get_current_job(self) -> Optional[Dict[str, Any]]:
        """Get current job"""
        state_data = await self._state_manager.get_state(self.machine_id)
        if state_data:
            return state_data.current_job
        return None
        
    async def start(self, file_path: Optional[str] = None) -> MachineCommandResponse:
        """Start print"""
        if isinstance(self.connection, OctoPrintConnection):
            if file_path:
                if await self.connection.start_job(file_path):
                    await self._update_state()
                    return MachineCommandResponse.success()
                return MachineCommandResponse.error("Failed to start job")
            else:
                # Start current job
                response = await self.connection.send_command("POST /api/job", {"command": "start"})
                if response.success:
                    await self._update_state()
                return response
        return MachineCommandResponse.error("Invalid connection")
        
    async def pause(self) -> MachineCommandResponse:
        """Pause print"""
        if isinstance(self.connection, OctoPrintConnection):
            if await self.connection.pause_job():
                await self._update_state()
                return MachineCommandResponse.success()
        return MachineCommandResponse.error("Failed to pause")
        
    async def resume(self) -> MachineCommandResponse:
        """Resume print"""
        if isinstance(self.connection, OctoPrintConnection):
            if await self.connection.resume_job():
                await self._update_state()
                return MachineCommandResponse.success()
        return MachineCommandResponse.error("Failed to resume")
        
    async def cancel(self) -> MachineCommandResponse:
        """Cancel print"""
        if isinstance(self.connection, OctoPrintConnection):
            if await self.connection.cancel_job():
                await self._update_state()
                return MachineCommandResponse.success()
        return MachineCommandResponse.error("Failed to cancel")
        
    async def home(self, axes: Optional[List[str]] = None) -> MachineCommandResponse:
        """Home axes via OctoPrint"""
        axes_list = axes or ["x", "y", "z"]
        return await self.connection.send_command(
            "POST /api/printer/printhead",
            {"command": "home", "axes": axes_list}
        )
        
    async def jog(self, axis: str, distance: float, speed: Optional[float] = None) -> MachineCommandResponse:
        """Jog via OctoPrint"""
        data = {"command": "jog"}
        data[axis.lower()] = distance
        if speed:
            data["speed"] = speed
        return await self.connection.send_command("POST /api/printer/printhead", data)
        
    async def set_temperature(self, zone: str, target: float) -> MachineCommandResponse:
        """Set temperature via OctoPrint"""
        if zone.lower() == "hotend":
            return await self.connection.send_command(
                "POST /api/printer/tool",
                {"command": "target", "targets": {"tool0": target}}
            )
        elif zone.lower() == "bed":
            return await self.connection.send_command(
                "POST /api/printer/bed",
                {"command": "target", "target": target}
            )
        return MachineCommandResponse.error(f"Unknown zone: {zone}")
        
    async def emergency_stop(self) -> MachineCommandResponse:
        """Emergency stop - not directly supported by OctoPrint"""
        # Cancel current job as emergency stop
        response = await self.cancel()
        await self._state_manager.update_state(self.machine_id, "ERROR")
        return response
        
    async def upload_file(self, file_path: str, content: bytes) -> MachineCommandResponse:
        """Upload file to OctoPrint"""
        # Would need multipart form upload implementation
        return MachineCommandResponse.error("Not implemented", "NOT_IMPLEMENTED")
        
    async def list_files(self, path: Optional[str] = None) -> List[Dict[str, Any]]:
        """List files in OctoPrint"""
        response = await self.connection.send_command("GET /api/files")
        if response.success and "files" in response.data:
            return response.data["files"]
        return []
        
    async def delete_file(self, file_path: str) -> MachineCommandResponse:
        """Delete file from OctoPrint"""
        return await self.connection.send_command(f"DELETE /api/files/local/{file_path}")