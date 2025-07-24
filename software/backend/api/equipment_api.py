"""
W.I.T. Equipment API Router - Updated with Direct Prusa Support

File: software/backend/api/equipment_api.py

Enhanced API endpoints for controlling workshop equipment including direct serial connection to Prusa printers.
"""

from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import requests
from requests.auth import HTTPDigestAuth
from typing import Optional, List, Dict, Any, Union
import asyncio
import logging
import json
from datetime import datetime
import time

# Import integrations
from software.frontend.web.integrations.octoprint_integration import (
    OctoPrintManager, OctoPrintConfig, PrinterState as OctoPrintState
)
from software.frontend.web.integrations.prusa_serial import (
    PrusaSerial, PrusaConfig, PrinterState as PrusaState
)
from software.frontend.web.integrations.grbl_integration import (
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

# PrusaLink printer storage
prusalink_printers: Dict[str, Dict[str, Any]] = {}

# Active WebSocket connections
active_connections: List[WebSocket] = []

# Background task for polling PrusaLink printers
polling_task = None


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
    url: Optional[str] = Field(None, description="OctoPrint/PrusaLink URL")
    api_key: Optional[str] = Field(None, description="OctoPrint API key")
    
    # PrusaLink specific
    username: Optional[str] = Field(None, description="PrusaLink username")
    password: Optional[str] = Field(None, description="PrusaLink password")
    
    # Serial specific
    port: Optional[str] = Field(None, description="Serial port")
    baudrate: Optional[int] = Field(115200, description="Baud rate")
    model: Optional[str] = Field("Prusa XL", description="Printer model")
    
    # Common settings
    auto_connect: bool = Field(default=True)
    manufacturer: Optional[str] = Field(None, description="Manufacturer")
    notes: Optional[str] = Field(None, description="Notes")


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

class PrinterTestRequest(BaseModel):
    """Test printer connection request"""
    connection_type: str
    url: Optional[str] = None
    port: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    api_key: Optional[str] = None


# Helper function to fetch PrusaLink data
async def fetch_prusalink_status(printer_info: Dict[str, Any]) -> Dict[str, Any]:
    """Fetch real-time status from PrusaLink printer"""
    try:
        url = printer_info["url"].replace("http://", "").replace("https://", "").strip("/")
        auth = HTTPDigestAuth(printer_info["username"], printer_info["password"])
        
        # Fetch printer status
        response = requests.get(
            f"http://{url}/api/printer",
            auth=auth,
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            telemetry = data.get("telemetry", {})
            state = data.get("state", {})
            
            # Update printer info with real data
            printer_info["connected"] = True
            printer_info["state"] = state
            printer_info["telemetry"] = {
                "temp-nozzle": telemetry.get("temp-nozzle", 0.0),
                "temp-bed": telemetry.get("temp-bed", 0.0),
                "temp-nozzle-target": telemetry.get("target-nozzle", 0.0),
                "temp-bed-target": telemetry.get("target-bed", 0.0),
                "axis-x": telemetry.get("axis-x", 0.0),
                "axis-y": telemetry.get("axis-y", 0.0),
                "axis-z": telemetry.get("axis-z", 0.0),
                "print-speed": telemetry.get("print-speed", 100),
                "flow-factor": telemetry.get("flow-factor", 100)
            }
            
            # Try to get job info
            try:
                job_response = requests.get(
                    f"http://{url}/api/job",
                    auth=auth,
                    timeout=5
                )
                if job_response.status_code == 200:
                    printer_info["job"] = job_response.json()
            except:
                printer_info["job"] = None
                
            printer_info["last_updated"] = datetime.utcnow().isoformat()
            
        else:
            printer_info["connected"] = False
            printer_info["state"] = {"text": "Offline", "flags": {"operational": False}}
            logger.warning(f"PrusaLink connection failed for {printer_info['id']}: {response.status_code}")
            
    except Exception as e:
        printer_info["connected"] = False
        printer_info["state"] = {"text": "Connection Error", "flags": {"operational": False}}
        logger.error(f"Error fetching PrusaLink data for {printer_info['id']}: {e}")
        
    return printer_info


# Background task to poll PrusaLink printers
async def poll_prusalink_printers():
    """Background task to poll all PrusaLink printers"""
    while True:
        try:
            for printer_id, printer_info in list(prusalink_printers.items()):
                # Fetch updated status
                updated_info = await fetch_prusalink_status(printer_info.copy())
                prusalink_printers[printer_id] = updated_info
                
                # Broadcast update via WebSocket
                await broadcast_printer_update(printer_id, updated_info)
                
            await asyncio.sleep(2)  # Poll every 2 seconds
            
        except Exception as e:
            logger.error(f"Polling error: {e}")
            await asyncio.sleep(5)


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
    global polling_task
    
    try:
        if request.connection_type == "prusalink":
            # PrusaLink connection
            if not request.url or not request.username or not request.password:
                raise HTTPException(
                    status_code=400,
                    detail="URL, username and password are required for PrusaLink"
                )
            
            # Store PrusaLink printer info
            printer_info = {
                "id": request.printer_id,
                "name": request.name,
                "connection_type": "prusalink",
                "url": request.url,
                "username": request.username,
                "password": request.password,
                "manufacturer": request.manufacturer or "Prusa",
                "model": request.model or "",
                "notes": request.notes or "",
                "connected": False,
                "state": {"text": "Connecting...", "flags": {"operational": False}},
                "telemetry": {},
                "added_at": datetime.utcnow().isoformat()
            }
            
            # Test connection and fetch initial status
            printer_info = await fetch_prusalink_status(printer_info)
            
            if printer_info["connected"]:
                prusalink_printers[request.printer_id] = printer_info
                
                # Start polling task if not already running
                if polling_task is None:
                    polling_task = asyncio.create_task(poll_prusalink_printers())
                
                return {
                    "status": "success",
                    "message": f"Connected to PrusaLink printer {request.name}"
                }
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Failed to connect to PrusaLink printer"
                )
                
        elif request.connection_type == "octoprint":
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
                
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported connection type: {request.connection_type}"
            )
            
        if request.connection_type != "prusalink" and success:
            logger.info(f"Added printer: {request.printer_id} via {request.connection_type}")
            return {
                "status": "success",
                "message": f"Printer {request.name} connected successfully"
            }
        elif request.connection_type != "prusalink":
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
    
    # PrusaLink printers with real data
    for printer_id, printer_info in prusalink_printers.items():
        # Ensure we have fresh data
        updated_info = await fetch_prusalink_status(printer_info.copy())
        prusalink_printers[printer_id] = updated_info
        printers.append(updated_info)
    
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
    """Get specific printer status with real data"""
    
    # Check PrusaLink printers
    if printer_id in prusalink_printers:
        # Fetch fresh data
        printer_info = prusalink_printers[printer_id]
        updated_info = await fetch_prusalink_status(printer_info.copy())
        prusalink_printers[printer_id] = updated_info
        return updated_info
    
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


# Delete printer
@router.delete("/printers/{printer_id}", response_model=Dict[str, str])
async def delete_printer(
    printer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a printer"""
    deleted = False
    
    # Check PrusaLink
    if printer_id in prusalink_printers:
        del prusalink_printers[printer_id]
        deleted = True
        
        # Stop polling if no more PrusaLink printers
        global polling_task
        if not prusalink_printers and polling_task:
            polling_task.cancel()
            polling_task = None
    
    # Check serial printers
    if printer_id in prusa_printers:
        await prusa_printers[printer_id].disconnect()
        del prusa_printers[printer_id]
        deleted = True
    
    # Check OctoPrint
    if octoprint_manager.get_printer(printer_id):
        # Remove from OctoPrint manager
        deleted = True
    
    if deleted:
        # Notify WebSocket clients
        await broadcast_printer_deletion(printer_id)
        
        return {
            "status": "success",
            "message": f"Printer {printer_id} deleted"
        }
    else:
        raise HTTPException(status_code=404, detail="Printer not found")


# Temperature control
@router.post("/printers/temperature", response_model=Dict[str, str])
async def set_temperature(
    request: TemperatureSetRequest,
    current_user: dict = Depends(get_current_user)
):
    """Set printer temperatures"""
    try:
        # PrusaLink temperature control
        if request.printer_id in prusalink_printers:
            printer_info = prusalink_printers[request.printer_id]
            url = printer_info["url"].replace("http://", "").replace("https://", "").strip("/")
            auth = HTTPDigestAuth(printer_info["username"], printer_info["password"])
            
            success = True
            
            # Set nozzle temperature
            if request.hotend is not None:
                response = requests.post(
                    f"http://{url}/api/printer/tool",
                    auth=auth,
                    json={"command": "target", "target": request.hotend},
                    timeout=5
                )
                success &= response.status_code in [200, 204]
            
            # Set bed temperature
            if request.bed is not None:
                response = requests.post(
                    f"http://{url}/api/printer/bed",
                    auth=auth,
                    json={"command": "target", "target": request.bed},
                    timeout=5
                )
                success &= response.status_code in [200, 204]
            
            if success:
                return {
                    "status": "success",
                    "message": "Temperature command sent"
                }
            else:
                raise HTTPException(status_code=400, detail="Failed to set temperature")
        
        # Serial printer temperature control
        elif request.printer_id in prusa_printers:
            printer = prusa_printers[request.printer_id]
            await printer.set_temperature(
                hotend=request.hotend,
                bed=request.bed,
                wait=request.wait
            )
            
        # OctoPrint temperature control
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


# Test printer connection
@router.post("/printers/test", response_model=Dict[str, Any])
async def test_printer_connection(request: PrinterTestRequest):
    """Test printer connection without adding it"""
    try:
        if request.connection_type == "prusalink":
            # Test PrusaLink connection with Digest auth
            if not request.url or not request.username or not request.password:
                return {
                    "success": False,
                    "message": "URL, username and password are required for PrusaLink"
                }
            
            # Clean up URL - remove http:// if present, add it back
            url = request.url.replace("http://", "").replace("https://", "").strip("/")
            
            auth = HTTPDigestAuth(request.username, request.password)
            response = requests.get(
                f"http://{url}/api/printer",
                auth=auth,
                timeout=5
            )
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "message": "Connection successful! PrusaLink is responding."
                }
            elif response.status_code == 401:
                return {
                    "success": False,
                    "message": "Authentication failed. Check your username and password."
                }
            else:
                return {
                    "success": False,
                    "message": f"Connection failed with status: {response.status_code}"
                }
                
        elif request.connection_type == "octoprint":
            # Test OctoPrint connection
            if not request.url or not request.api_key:
                return {
                    "success": False,
                    "message": "URL and API key are required for OctoPrint"
                }
                
            headers = {"X-Api-Key": request.api_key}
            response = requests.get(
                f"{request.url}/api/printer",
                headers=headers,
                timeout=5
            )
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "message": "Connection successful! OctoPrint is responding."
                }
            elif response.status_code == 401:
                return {
                    "success": False,
                    "message": "Authentication failed. Check your API key."
                }
            else:
                return {
                    "success": False,
                    "message": f"Connection failed with status: {response.status_code}"
                }
                
        elif request.connection_type == "serial":
            # For serial connections, just validate the port format
            if not request.port:
                return {
                    "success": False,
                    "message": "Serial port is required"
                }
                
            # Check if port looks valid
            if not request.port.startswith(("/dev/", "COM")):
                return {
                    "success": False,
                    "message": "Invalid serial port format"
                }
                
            return {
                "success": True,
                "message": "Serial port format is valid. Connection will be tested when adding printer."
            }
            
        else:
            return {
                "success": False,
                "message": f"Unknown connection type: {request.connection_type}"
            }
            
    except requests.exceptions.ConnectTimeout:
        return {
            "success": False,
            "message": "Connection timeout - is the printer powered on and connected to the network?"
        }
    except requests.exceptions.ConnectionError:
        return {
            "success": False,
            "message": "Connection error - check the IP address and network connection"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error: {str(e)}"
        }


# WebSocket for real-time updates
@router.websocket("/ws/printers")
async def websocket_printer_updates(websocket: WebSocket):
    """WebSocket for real-time printer updates"""
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        # Send initial printer list
        printers = await get_printers()
        await websocket.send_json({
            "type": "initial",
            "printers": printers
        })
        
        # Keep connection alive
        while True:
            await asyncio.sleep(30)  # Heartbeat every 30 seconds
            await websocket.send_json({"type": "ping"})
            
    except WebSocketDisconnect:
        active_connections.remove(websocket)
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if websocket in active_connections:
            active_connections.remove(websocket)


# Broadcast functions for WebSocket updates
async def broadcast_printer_update(printer_id: str, printer_data: Dict[str, Any]):
    """Broadcast printer update to all WebSocket clients"""
    if active_connections:
        message = {
            "type": "printer_update",
            "printer": printer_data
        }
        
        disconnected = []
        for connection in active_connections:
            try:
                await connection.send_json(message)
            except:
                disconnected.append(connection)
                
        # Remove disconnected clients
        for conn in disconnected:
            active_connections.remove(conn)


async def broadcast_printer_deletion(printer_id: str):
    """Broadcast printer deletion to all WebSocket clients"""
    if active_connections:
        message = {
            "type": "printer_deleted",
            "printer_id": printer_id
        }
        
        disconnected = []
        for connection in active_connections:
            try:
                await connection.send_json(message)
            except:
                disconnected.append(connection)
                
        # Remove disconnected clients
        for conn in disconnected:
            active_connections.remove(conn)


# Cleanup on shutdown
async def shutdown_equipment():
    """Disconnect all equipment on shutdown"""
    global polling_task
    
    logger.info("Shutting down equipment connections...")
    
    # Cancel polling task
    if polling_task:
        polling_task.cancel()
        try:
            await polling_task
        except asyncio.CancelledError:
            pass
    
    # Disconnect serial printers
    for printer_id, printer in prusa_printers.items():
        await printer.disconnect()
        
    # Disconnect OctoPrint
    await octoprint_manager.shutdown()
    
    # Clear connections
    prusa_printers.clear()
    prusalink_printers.clear()
    active_connections.clear()