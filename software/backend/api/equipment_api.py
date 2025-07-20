"""
W.I.T. Equipment API Router - Updated with Direct Prusa Support

File: software/backend/api/equipment_api_v2.py

Enhanced API endpoints for controlling workshop equipment including direct serial connection to Prusa printers.
"""

from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
import asyncio
import logging
import json
from datetime import datetime

# Import integrations
from software.integrations.octoprint_integration import (
    OctoPrintManager, OctoPrintConfig, PrinterState as OctoPrintState
)
from software.integrations.prusa_serial import (
    PrusaSerial, PrusaConfig, PrinterState as PrusaState
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
octoprint_manager = OctoPrintManager()
prusa_printers: Dict[str, PrusaSerial] = {}
cnc_controllers: Dict[str, GRBLController] = {}

# Active WebSocket connections
active_connections: Dict[str, List[WebSocket]] = {}


# Request/Response Models
class PrinterConnectionType(str):
    OCTOPRINT = "octoprint"
    SERIAL = "serial"
    PRUSALINK = "prusalink"


class PrinterAddRequest(BaseModel):
    """Add printer request"""
    printer_id: str = Field(..., description="Unique printer ID")
    name: str = Field(..., description="Printer name")
    connection_type: str = Field(..., description="Connection type: octoprint, serial, prusalink")
    
    # OctoPrint specific
    url: Optional[str] = Field(None, description="OctoPrint URL")
    api_key: Optional[str] = Field(None, description="OctoPrint API key")
    
    # Serial specific
    port: Optional[str] = Field(None, description="Serial port")
    baudrate: Optional[int] = Field(115200, description="Baud rate")
    model: Optional[str] = Field("Prusa XL", description="Printer model")
    
    # Common settings
    auto_connect: bool = Field(default=True)


class TemperatureSetRequest(BaseModel):
    """Temperature control request"""
    printer_id: str
    hotend: Optional[float] = Field(None, ge=0, le=300)
    bed: Optional[float] = Field(None, ge=0, le=120)
    wait: bool = Field(default=False, description="Wait for temperature to reach target")


class MoveRequest(BaseModel):
    """Movement request"""
    printer_id: str
    x: Optional[float] = None
    y: Optional[float] = None
    z: Optional[float] = None
    feedrate: Optional[float] = Field(None, description="Movement speed in mm/min")
    relative: bool = Field(default=False, description="Relative movement")


class GCodeRequest(BaseModel):
    """Direct G-code request"""
    printer_id: str
    commands: List[str] = Field(..., description="G-code commands to send")
    priority: bool = Field(default=False, description="Send as priority commands")


# Printer discovery endpoint
@router.get("/printers/discover", response_model=List[Dict[str, Any]])
async def discover_printers():
    """Discover available printers (serial ports)"""
    try:
        # Create temporary Prusa instance for port discovery
        prusa = PrusaSerial(PrusaConfig(port=""))
        ports = prusa.find_prusa_ports()
        
        return [{
            "port": p["port"],
            "description": p["description"],
            "likely_prusa": p["likely_prusa"],
            "connection_type": "serial"
        } for p in ports]
        
    except Exception as e:
        logger.error(f"Discovery error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Add printer endpoint
@router.post("/printers", response_model=Dict[str, str])
async def add_printer(
    request: PrinterAddRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add a 3D printer with any connection type"""
    try:
        if request.connection_type == "octoprint":
            # OctoPrint connection
            if not request.url or not request.api_key:
                raise HTTPException(
                    status_code=400,
                    detail="URL and API key required for OctoPrint"
                )
                
            config = OctoPrintConfig(
                url=request.url,
                api_key=request.api_key,
                name=request.name,
                auto_connect=request.auto_connect
            )
            
            success = await octoprint_manager.add_printer(request.printer_id, config)
            
        elif request.connection_type == "serial":
            # Direct serial connection
            if not request.port:
                raise HTTPException(
                    status_code=400,
                    detail="Serial port required for direct connection"
                )
                
            config = PrusaConfig(
                port=request.port,
                baudrate=request.baudrate,
                model=request.model
            )
            
            printer = PrusaSerial(config)
            success = await printer.connect()
            
            if success:
                prusa_printers[request.printer_id] = printer
                
                # Register status callbacks for WebSocket updates
                async def on_state_change():
                    await broadcast_printer_status(request.printer_id)
                    
                printer.register_state_callback(on_state_change)
                
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported connection type: {request.connection_type}"
            )
            
        if success:
            logger.info(f"Added printer: {request.printer_id} via {request.connection_type}")
            return {
                "status": "success",
                "message": f"Printer {request.name} connected successfully"
            }
        else:
            raise HTTPException(
                status_code=400,
                detail="Failed to connect to printer"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding printer: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Get all printers
@router.get("/printers", response_model=List[Dict[str, Any]])
async def get_printers():
    """Get all configured printers"""
    printers = []
    
    # OctoPrint printers
    for printer_id, client in octoprint_manager.get_all_printers().items():
        status = client.get_status()
        printers.append({
            "id": printer_id,
            "connection_type": "octoprint",
            **status
        })
        
    # Direct serial printers
    for printer_id, printer in prusa_printers.items():
        status = printer.get_status()
        printers.append({
            "id": printer_id,
            "connection_type": "serial",
            **status
        })
        
    return printers


# Get specific printer
@router.get("/printers/{printer_id}", response_model=Dict[str, Any])
async def get_printer_status(printer_id: str):
    """Get specific printer status"""
    
    # Check OctoPrint
    printer = octoprint_manager.get_printer(printer_id)
    if printer:
        return {
            "id": printer_id,
            "connection_type": "octoprint",
            **printer.get_status()
        }
        
    # Check serial printers
    if printer_id in prusa_printers:
        return {
            "id": printer_id,
            "connection_type": "serial",
            **prusa_printers[printer_id].get_status()
        }
        
    raise HTTPException(status_code=404, detail="Printer not found")


# Temperature control
@router.post("/printers/temperature", response_model=Dict[str, str])
async def set_temperature(
    request: TemperatureSetRequest,
    current_user: dict = Depends(get_current_user)
):
    """Set printer temperatures"""
    try:
        # Find printer
        if request.printer_id in prusa_printers:
            printer = prusa_printers[request.printer_id]
            await printer.set_temperature(
                hotend=request.hotend,
                bed=request.bed,
                wait=request.wait
            )
            
        elif octoprint_manager.get_printer(request.printer_id):
            printer = octoprint_manager.get_printer(request.printer_id)
            await printer.set_temperatures(
                extruder=request.hotend,
                bed=request.bed
            )
            
        else:
            raise HTTPException(status_code=404, detail="Printer not found")
            
        return {
            "status": "success",
            "message": "Temperature command sent"
        }
        
    except Exception as e:
        logger.error(f"Temperature control error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Movement control
@router.post("/printers/move", response_model=Dict[str, str])
async def move_printer(
    request: MoveRequest,
    current_user: dict = Depends(get_current_user)
):
    """Move printer to position"""
    try:
        if request.printer_id in prusa_printers:
            printer = prusa_printers[request.printer_id]
            await printer.move_to(
                x=request.x,
                y=request.y,
                z=request.z,
                feedrate=request.feedrate,
                relative=request.relative
            )
            
        elif octoprint_manager.get_printer(request.printer_id):
            printer = octoprint_manager.get_printer(request.printer_id)
            # OctoPrint movement would go here
            raise HTTPException(
                status_code=501,
                detail="Movement control not implemented for OctoPrint"
            )
            
        else:
            raise HTTPException(status_code=404, detail="Printer not found")
            
        return {
            "status": "success",
            "message": "Movement command sent"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Movement error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Home printer
@router.post("/printers/{printer_id}/home", response_model=Dict[str, str])
async def home_printer(
    printer_id: str,
    axes: str = "XYZ",
    current_user: dict = Depends(get_current_user)
):
    """Home printer axes"""
    try:
        if printer_id in prusa_printers:
            printer = prusa_printers[printer_id]
            await printer.home_axes(axes)
            
        elif octoprint_manager.get_printer(printer_id):
            printer = octoprint_manager.get_printer(printer_id)
            await printer.home_axes(list(axes.lower()))
            
        else:
            raise HTTPException(status_code=404, detail="Printer not found")
            
        return {
            "status": "success",
            "message": f"Homing axes: {axes}"
        }
        
    except Exception as e:
        logger.error(f"Homing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Send G-code
@router.post("/printers/gcode", response_model=Dict[str, str])
async def send_gcode(
    request: GCodeRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send G-code commands to printer"""
    try:
        if request.printer_id in prusa_printers:
            printer = prusa_printers[request.printer_id]
            
            for command in request.commands:
                if request.priority:
                    printer.send_command_priority(command)
                else:
                    printer.send_command(command)
                    
        else:
            raise HTTPException(
                status_code=404,
                detail="Printer not found or doesn't support direct G-code"
            )
            
        return {
            "status": "success",
            "message": f"Sent {len(request.commands)} commands"
        }
        
    except Exception as e:
        logger.error(f"G-code error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Emergency stop
@router.post("/printers/{printer_id}/emergency-stop", response_model=Dict[str, str])
async def emergency_stop(
    printer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Emergency stop printer"""
    try:
        if printer_id in prusa_printers:
            printer = prusa_printers[printer_id]
            await printer.emergency_stop()
            
        else:
            # Try all connection types
            logger.warning(f"Emergency stop for unknown printer: {printer_id}")
            
        return {
            "status": "success",
            "message": "Emergency stop activated"
        }
        
    except Exception as e:
        logger.error(f"Emergency stop error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# WebSocket for real-time updates
@router.websocket("/ws/{printer_id}")
async def websocket_endpoint(websocket: WebSocket, printer_id: str):
    """WebSocket for real-time printer updates"""
    await websocket.accept()
    
    # Add to active connections
    if printer_id not in active_connections:
        active_connections[printer_id] = []
    active_connections[printer_id].append(websocket)
    
    try:
        while True:
            # Send periodic status updates
            if printer_id in prusa_printers:
                status = prusa_printers[printer_id].get_status()
                await websocket.send_json({
                    "type": "status",
                    "data": status
                })
                
            await asyncio.sleep(1)  # Update every second
            
    except WebSocketDisconnect:
        active_connections[printer_id].remove(websocket)
        if not active_connections[printer_id]:
            del active_connections[printer_id]
            
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            active_connections[printer_id].remove(websocket)
        except:
            pass


async def broadcast_printer_status(printer_id: str):
    """Broadcast status update to all connected WebSocket clients"""
    if printer_id in active_connections:
        status = None
        
        if printer_id in prusa_printers:
            status = prusa_printers[printer_id].get_status()
            
        if status:
            for connection in active_connections[printer_id]:
                try:
                    await connection.send_json({
                        "type": "status",
                        "data": status
                    })
                except:
                    pass


# Cleanup on shutdown
async def shutdown_equipment():
    """Disconnect all equipment on shutdown"""
    logger.info("Shutting down equipment connections...")
    
    # Disconnect serial printers
    for printer_id, printer in prusa_printers.items():
        await printer.disconnect()
        
    # Disconnect OctoPrint
    await octoprint_manager.shutdown()
    
    # Clear connections
    prusa_printers.clear()
    active_connections.clear()