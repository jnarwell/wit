"""
W.I.T. Equipment API Router

File: software/backend/api/equipment_api.py

API endpoints for controlling workshop equipment (3D printers, CNC machines, etc.)
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import asyncio
import logging
from datetime import datetime
import io

# Import integrations
import sys
# Import path handled by main module
from software.integrations.octoprint_integration import (
    OctoPrintManager, OctoPrintConfig, PrinterState, JobState
)
from software.integrations.grbl_integration import (
    GRBLController, GRBLConfig, MachineState
)

# Import auth
from software.backend.services.auth_services import get_current_user

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/v1/equipment", tags=["equipment"])

# Global equipment managers
printer_manager = OctoPrintManager()
cnc_controllers: Dict[str, GRBLController] = {}


# Request/Response Models
class PrinterConfig(BaseModel):
    """3D Printer configuration"""
    printer_id: str = Field(..., description="Unique printer ID")
    name: str = Field(..., description="Printer name")
    url: str = Field(..., description="OctoPrint URL")
    api_key: str = Field(..., description="OctoPrint API key")
    auto_connect: bool = Field(default=True)


class CNCConfig(BaseModel):
    """CNC machine configuration"""
    machine_id: str = Field(..., description="Unique machine ID")
    name: str = Field(..., description="Machine name")
    port: str = Field(..., description="Serial port")
    baudrate: int = Field(default=115200)
    max_x: float = Field(default=300.0, description="Max X travel (mm)")
    max_y: float = Field(default=300.0, description="Max Y travel (mm)")
    max_z: float = Field(default=100.0, description="Max Z travel (mm)")


class PrintCommand(BaseModel):
    """3D print command"""
    printer_id: str
    file_path: str
    
    
class MoveCommand(BaseModel):
    """Movement command"""
    machine_id: str
    x: Optional[float] = None
    y: Optional[float] = None
    z: Optional[float] = None
    feed_rate: float = Field(default=1000.0, description="Feed rate (mm/min)")
    relative: bool = Field(default=False, description="Relative movement")


class GCodeCommand(BaseModel):
    """G-code command"""
    machine_id: str
    commands: List[str] = Field(..., description="G-code commands")
    wait_response: bool = Field(default=False)


class TemperatureCommand(BaseModel):
    """Temperature command"""
    printer_id: str
    extruder: Optional[float] = Field(None, ge=0, le=300)
    bed: Optional[float] = Field(None, ge=0, le=120)


# Printer endpoints
@router.post("/printers", response_model=Dict[str, str])
async def add_printer(
    config: PrinterConfig,
    current_user: dict = Depends(get_current_user)
):
    """Add a 3D printer"""
    try:
        octo_config = OctoPrintConfig(
            url=config.url,
            api_key=config.api_key,
            name=config.name,
            auto_connect=config.auto_connect
        )
        
        success = await printer_manager.add_printer(config.printer_id, octo_config)
        
        if success:
            logger.info(f"Added printer: {config.printer_id}")
            return {
                "status": "success",
                "message": f"Printer {config.name} added successfully"
            }
        else:
            raise HTTPException(
                status_code=400,
                detail="Failed to connect to printer"
            )
            
    except Exception as e:
        logger.error(f"Error adding printer: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/printers", response_model=List[Dict[str, Any]])
async def get_printers():
    """Get all configured printers"""
    printers = []
    
    for printer_id, client in printer_manager.get_all_printers().items():
        status = client.get_status()
        printers.append({
            "id": printer_id,
            "name": client.config.name,
            **status
        })
        
    return printers


@router.get("/printers/{printer_id}", response_model=Dict[str, Any])
async def get_printer_status(printer_id: str):
    """Get specific printer status"""
    printer = printer_manager.get_printer(printer_id)
    
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
        
    return printer.get_status()


@router.delete("/printers/{printer_id}", response_model=Dict[str, str])
async def remove_printer(
    printer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a printer"""
    success = await printer_manager.remove_printer(printer_id)
    
    if success:
        return {
            "status": "success",
            "message": f"Printer {printer_id} removed"
        }
    else:
        raise HTTPException(status_code=404, detail="Printer not found")


@router.post("/printers/{printer_id}/print", response_model=Dict[str, str])
async def start_print(
    printer_id: str,
    file_path: str,
    current_user: dict = Depends(get_current_user)
):
    """Start a print job"""
    printer = printer_manager.get_printer(printer_id)
    
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
        
    success = await printer.start_print(file_path)
    
    if success:
        return {
            "status": "success",
            "message": f"Started printing {file_path}"
        }
    else:
        raise HTTPException(status_code=400, detail="Failed to start print")


@router.post("/printers/{printer_id}/pause", response_model=Dict[str, str])
async def pause_print(
    printer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Pause current print"""
    printer = printer_manager.get_printer(printer_id)
    
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
        
    success = await printer.pause_print()
    
    if success:
        return {"status": "success", "message": "Print paused"}
    else:
        raise HTTPException(status_code=400, detail="No active print to pause")


@router.post("/printers/{printer_id}/resume", response_model=Dict[str, str])
async def resume_print(
    printer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Resume paused print"""
    printer = printer_manager.get_printer(printer_id)
    
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
        
    success = await printer.resume_print()
    
    if success:
        return {"status": "success", "message": "Print resumed"}
    else:
        raise HTTPException(status_code=400, detail="No paused print to resume")


@router.post("/printers/{printer_id}/cancel", response_model=Dict[str, str])
async def cancel_print(
    printer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel current print"""
    printer = printer_manager.get_printer(printer_id)
    
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
        
    success = await printer.cancel_print()
    
    if success:
        return {"status": "success", "message": "Print cancelled"}
    else:
        raise HTTPException(status_code=400, detail="No active print to cancel")


@router.post("/printers/{printer_id}/temperature", response_model=Dict[str, str])
async def set_printer_temperature(
    command: TemperatureCommand,
    current_user: dict = Depends(get_current_user)
):
    """Set printer temperatures"""
    printer = printer_manager.get_printer(command.printer_id)
    
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
        
    success = await printer.set_temperatures(
        extruder=command.extruder,
        bed=command.bed
    )
    
    if success:
        return {"status": "success", "message": "Temperatures set"}
    else:
        raise HTTPException(status_code=400, detail="Failed to set temperatures")


@router.post("/printers/{printer_id}/home", response_model=Dict[str, str])
async def home_printer(
    printer_id: str,
    axes: List[str] = ["x", "y", "z"],
    current_user: dict = Depends(get_current_user)
):
    """Home printer axes"""
    printer = printer_manager.get_printer(printer_id)
    
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
        
    success = await printer.home_axes(axes)
    
    if success:
        return {"status": "success", "message": f"Homed axes: {axes}"}
    else:
        raise HTTPException(status_code=400, detail="Failed to home axes")


@router.get("/printers/{printer_id}/files", response_model=List[Dict[str, Any]])
async def get_printer_files(printer_id: str):
    """Get available files on printer"""
    printer = printer_manager.get_printer(printer_id)
    
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
        
    return await printer.get_files()


@router.post("/printers/{printer_id}/upload")
async def upload_to_printer(
    printer_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload file to printer"""
    printer = printer_manager.get_printer(printer_id)
    
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
        
    try:
        contents = await file.read()
        success = await printer.upload_file(contents, file.filename)
        
        if success:
            return {
                "status": "success",
                "message": f"Uploaded {file.filename}",
                "filename": file.filename
            }
        else:
            raise HTTPException(status_code=400, detail="Upload failed")
            
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# CNC endpoints
@router.post("/cnc", response_model=Dict[str, str])
async def add_cnc_machine(
    config: CNCConfig,
    current_user: dict = Depends(get_current_user)
):
    """Add a CNC machine"""
    try:
        grbl_config = GRBLConfig(
            port=config.port,
            baudrate=config.baudrate,
            max_x=config.max_x,
            max_y=config.max_y,
            max_z=config.max_z
        )
        
        controller = GRBLController(grbl_config)
        
        if await controller.connect():
            cnc_controllers[config.machine_id] = controller
            logger.info(f"Added CNC machine: {config.machine_id}")
            
            return {
                "status": "success",
                "message": f"CNC machine {config.name} added successfully"
            }
        else:
            raise HTTPException(
                status_code=400,
                detail="Failed to connect to CNC machine"
            )
            
    except Exception as e:
        logger.error(f"Error adding CNC machine: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cnc", response_model=List[Dict[str, Any]])
async def get_cnc_machines():
    """Get all configured CNC machines"""
    machines = []
    
    for machine_id, controller in cnc_controllers.items():
        status = controller.get_status()
        machines.append({
            "id": machine_id,
            "name": controller.config.port,
            **status
        })
        
    return machines


@router.get("/cnc/{machine_id}", response_model=Dict[str, Any])
async def get_cnc_status(machine_id: str):
    """Get specific CNC machine status"""
    controller = cnc_controllers.get(machine_id)
    
    if not controller:
        raise HTTPException(status_code=404, detail="CNC machine not found")
        
    return controller.get_status()


@router.delete("/cnc/{machine_id}", response_model=Dict[str, str])
async def remove_cnc_machine(
    machine_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a CNC machine"""
    if machine_id in cnc_controllers:
        await cnc_controllers[machine_id].disconnect()
        del cnc_controllers[machine_id]
        
        return {
            "status": "success",
            "message": f"CNC machine {machine_id} removed"
        }
    else:
        raise HTTPException(status_code=404, detail="CNC machine not found")


@router.post("/cnc/{machine_id}/home", response_model=Dict[str, str])
async def home_cnc(
    machine_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Home CNC machine"""
    controller = cnc_controllers.get(machine_id)
    
    if not controller:
        raise HTTPException(status_code=404, detail="CNC machine not found")
        
    success = await controller.home_machine()
    
    if success:
        return {"status": "success", "message": "Machine homed"}
    else:
        raise HTTPException(status_code=400, detail="Failed to home machine")


@router.post("/cnc/{machine_id}/move", response_model=Dict[str, str])
async def move_cnc(
    command: MoveCommand,
    current_user: dict = Depends(get_current_user)
):
    """Move CNC machine"""
    controller = cnc_controllers.get(command.machine_id)
    
    if not controller:
        raise HTTPException(status_code=404, detail="CNC machine not found")
        
    try:
        if command.relative:
            success = await controller.jog(
                x=command.x or 0,
                y=command.y or 0,
                z=command.z or 0,
                feed_rate=command.feed_rate
            )
        else:
            success = await controller.move_to(
                x=command.x,
                y=command.y,
                z=command.z,
                feed_rate=command.feed_rate
            )
            
        if success:
            return {"status": "success", "message": "Movement completed"}
        else:
            raise HTTPException(status_code=400, detail="Movement failed")
            
    except Exception as e:
        logger.error(f"Movement error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cnc/{machine_id}/gcode", response_model=Dict[str, Any])
async def send_gcode(
    command: GCodeCommand,
    current_user: dict = Depends(get_current_user)
):
    """Send G-code to CNC machine"""
    controller = cnc_controllers.get(command.machine_id)
    
    if not controller:
        raise HTTPException(status_code=404, detail="CNC machine not found")
        
    try:
        responses = []
        
        for gcode in command.commands:
            response = await controller.send_command(
                gcode, 
                wait_response=command.wait_response
            )
            responses.append(response)
            
        return {
            "status": "success",
            "responses": responses if command.wait_response else None
        }
        
    except Exception as e:
        logger.error(f"G-code error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cnc/{machine_id}/job")
async def upload_cnc_job(
    machine_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload and run G-code job"""
    controller = cnc_controllers.get(machine_id)
    
    if not controller:
        raise HTTPException(status_code=404, detail="CNC machine not found")
        
    try:
        # Read G-code file
        contents = await file.read()
        gcode_lines = contents.decode('utf-8').splitlines()
        
        # Filter out empty lines and comments
        gcode_lines = [
            line.strip() for line in gcode_lines 
            if line.strip() and not line.strip().startswith(';')
        ]
        
        # Start job
        success = await controller.run_gcode_file(gcode_lines)
        
        if success:
            return {
                "status": "success",
                "message": f"Started job: {file.filename}",
                "lines": len(gcode_lines)
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to start job")
            
    except Exception as e:
        logger.error(f"Job upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cnc/{machine_id}/pause", response_model=Dict[str, str])
async def pause_cnc_job(
    machine_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Pause CNC job"""
    controller = cnc_controllers.get(machine_id)
    
    if not controller:
        raise HTTPException(status_code=404, detail="CNC machine not found")
        
    success = await controller.pause_job()
    
    if success:
        return {"status": "success", "message": "Job paused"}
    else:
        raise HTTPException(status_code=400, detail="No active job to pause")


@router.post("/cnc/{machine_id}/resume", response_model=Dict[str, str])
async def resume_cnc_job(
    machine_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Resume CNC job"""
    controller = cnc_controllers.get(machine_id)
    
    if not controller:
        raise HTTPException(status_code=404, detail="CNC machine not found")
        
    success = await controller.resume_job()
    
    if success:
        return {"status": "success", "message": "Job resumed"}
    else:
        raise HTTPException(status_code=400, detail="No paused job to resume")


@router.post("/cnc/{machine_id}/stop", response_model=Dict[str, str])
async def stop_cnc_job(
    machine_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Stop CNC job"""
    controller = cnc_controllers.get(machine_id)
    
    if not controller:
        raise HTTPException(status_code=404, detail="CNC machine not found")
        
    success = await controller.stop_job()
    
    if success:
        return {"status": "success", "message": "Job stopped"}
    else:
        raise HTTPException(status_code=400, detail="Failed to stop job")


@router.post("/cnc/{machine_id}/probe", response_model=Dict[str, Any])
async def probe_cnc(
    machine_id: str,
    axis: str = "z",
    feed_rate: float = 100.0,
    max_distance: float = 10.0,
    current_user: dict = Depends(get_current_user)
):
    """Probe CNC machine"""
    controller = cnc_controllers.get(machine_id)
    
    if not controller:
        raise HTTPException(status_code=404, detail="CNC machine not found")
        
    if axis.lower() != "z":
        raise HTTPException(status_code=400, detail="Only Z probe supported")
        
    result = await controller.probe_z(
        feed_rate=feed_rate,
        max_distance=max_distance
    )
    
    if result is not None:
        return {
            "status": "success",
            "probe_position": result,
            "axis": axis
        }
    else:
        raise HTTPException(status_code=400, detail="Probe failed")


@router.get("/cnc/ports", response_model=List[str])
async def find_cnc_ports():
    """Find available serial ports for CNC"""
    # Use any controller to find ports
    temp_controller = GRBLController(GRBLConfig(port=""))
    ports = temp_controller.find_grbl_ports()
    
    return ports


# Equipment summary endpoint
@router.get("/summary", response_model=Dict[str, Any])
async def get_equipment_summary():
    """Get summary of all equipment"""
    printer_summary = printer_manager.get_status_summary()
    
    cnc_summary = {
        "total_machines": len(cnc_controllers),
        "machines": {}
    }
    
    for machine_id, controller in cnc_controllers.items():
        cnc_summary["machines"][machine_id] = controller.get_status()
        
    return {
        "printers": printer_summary,
        "cnc": cnc_summary,
        "timestamp": datetime.now().isoformat()
    }


# Emergency stop
@router.post("/emergency-stop", response_model=Dict[str, str])
async def emergency_stop_all(
    current_user: dict = Depends(get_current_user)
):
    """Emergency stop all equipment"""
    logger.warning(f"EMERGENCY STOP initiated by {current_user['username']}")
    
    results = []
    
    # Stop all printers
    for printer_id, printer in printer_manager.get_all_printers().items():
        try:
            await printer.cancel_print()
            results.append(f"Stopped printer: {printer_id}")
        except Exception as e:
            logger.error(f"Failed to stop printer {printer_id}: {e}")
            
    # Stop all CNC machines
    for machine_id, controller in cnc_controllers.items():
        try:
            await controller.stop_job()
            results.append(f"Stopped CNC: {machine_id}")
        except Exception as e:
            logger.error(f"Failed to stop CNC {machine_id}: {e}")
            
    return {
        "status": "success",
        "message": "Emergency stop executed",
        "results": results
    }


# Startup event
@router.on_event("startup")
async def startup_event():
    """Initialize equipment connections on startup"""
    logger.info("Equipment API starting up...")
    # Could auto-connect to configured equipment here


# Shutdown event
@router.on_event("shutdown")
async def shutdown_event():
    """Cleanup equipment connections on shutdown"""
    logger.info("Equipment API shutting down...")
    
    # Disconnect all printers
    await printer_manager.shutdown()
    
    # Disconnect all CNC machines
    for controller in cnc_controllers.values():
        await controller.disconnect()
    cnc_controllers.clear()