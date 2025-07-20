#!/usr/bin/env python3
"""
W.I.T. Development Server with Real Printer Integration
This version connects to actual printers via Serial, PrusaLink, and OctoPrint
Updated with real PrusaLink data fetching
"""

from fastapi import FastAPI, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import uvicorn
import sys
import os
import secrets
import logging
import asyncio
import json
import aiohttp
import requests
from requests.auth import HTTPDigestAuth
import serial.tools.list_ports

# Suppress bcrypt warning
import warnings
warnings.filterwarnings("ignore", message=".*bcrypt.*")

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Try to import printer integrations
try:
    from software.integrations.octoprint_integration import (
        OctoPrintManager, OctoPrintConfig, PrinterState as OctoPrintState
    )
    from software.integrations.prusa_serial import (
        PrusaSerial, PrusaConfig, PrinterState as PrusaState
    )
    INTEGRATIONS_AVAILABLE = True
except ImportError as e:
    print(f"⚠️  Warning: Could not import printer integrations: {e}")
    print("   Using simulated printer connections")
    INTEGRATIONS_AVAILABLE = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="W.I.T. Terminal API with Real Printers")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============== AUTH CONFIGURATION ==============

SECRET_KEY = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

# ============== AUTH MODELS ==============

class Token(BaseModel):
    access_token: str
    token_type: str

class User(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    disabled: Optional[bool] = None

class UserInDB(User):
    hashed_password: str

class UserLogin(BaseModel):
    username: str
    password: str

# ============== USER DATABASE ==============

users_db = {
    "admin": {
        "username": "admin",
        "full_name": "Admin User",
        "email": "admin@wit.local",
        "hashed_password": pwd_context.hash("admin"),
        "disabled": False,
    },
    "maker": {
        "username": "maker",
        "full_name": "Maker User",
        "email": "maker@wit.local", 
        "hashed_password": pwd_context.hash("maker123"),
        "disabled": False,
    }
}

# ============== PRINTER STORAGE ==============

# Global printer managers
if INTEGRATIONS_AVAILABLE:
    octoprint_manager = OctoPrintManager()
    serial_printers: Dict[str, PrusaSerial] = {}
else:
    octoprint_manager = None
    serial_printers = {}

# Simulated printer storage (fallback)
simulated_printers: Dict[str, Any] = {}

# PrusaLink printer storage for real data
prusalink_printers: Dict[str, Dict[str, Any]] = {}

# WebSocket connections for real-time updates
active_websockets: List[WebSocket] = []

# ============== AUTH FUNCTIONS ==============

def authenticate_user(username: str, password: str):
    user = users_db.get(username)
    if not user:
        return False
    if not pwd_context.verify(password, user["hashed_password"]):
        return False
    return UserInDB(**user)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user_dict = users_db.get(username)
    if user_dict is None:
        raise credentials_exception
    return User(**user_dict)

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

# ============== AUTH ENDPOINTS ==============

@app.post("/api/v1/auth/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """OAuth2 compatible login endpoint"""
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/v1/auth/login", response_model=Token)
async def login_json(user_login: UserLogin):
    """JSON login endpoint for easier frontend integration"""
    user = authenticate_user(user_login.username, user_login.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/v1/auth/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Get current user info"""
    return current_user

# ============== EQUIPMENT MODELS ==============

class PrinterTestRequest(BaseModel):
    connection_type: str
    url: Optional[str] = None
    port: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    api_key: Optional[str] = None
    baudrate: Optional[int] = 115200

class PrinterAddRequest(BaseModel):
    printer_id: str
    name: str
    connection_type: str
    url: Optional[str] = None
    port: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    api_key: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    notes: Optional[str] = None
    baudrate: Optional[int] = 115200
    auto_connect: bool = True

# ============== PRINTER FUNCTIONS ==============

async def test_prusalink_connection(url: str, username: str, password: str) -> Dict[str, Any]:
    """Test PrusaLink connection"""
    try:
        # Clean up URL
        if not url.startswith('http'):
            url = f'http://{url}'
        
        # Test connection with digest auth
        test_url = f"{url}/api/version"
        response = requests.get(test_url, auth=HTTPDigestAuth(username, password), timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            return {
                "success": True,
                "message": f"Connected to PrusaLink v{data.get('api', 'unknown')}",
                "printer_info": data
            }
        elif response.status_code == 401:
            return {"success": False, "message": "Authentication failed. Check username and password."}
        else:
            return {"success": False, "message": f"Connection failed: HTTP {response.status_code}"}
            
    except requests.exceptions.ConnectionError:
        return {"success": False, "message": "Could not connect to printer. Check IP address."}
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}

async def test_octoprint_connection(url: str, api_key: str) -> Dict[str, Any]:
    """Test OctoPrint connection"""
    try:
        # Test connection
        test_url = f"{url}/api/version"
        headers = {"X-Api-Key": api_key}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(test_url, headers=headers, timeout=5) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        "success": True,
                        "message": f"Connected to OctoPrint v{data.get('server', 'unknown')}",
                        "printer_info": data
                    }
                elif response.status == 401 or response.status == 403:
                    return {"success": False, "message": "Authentication failed. Check API key."}
                else:
                    return {"success": False, "message": f"Connection failed: HTTP {response.status}"}
                    
    except aiohttp.ClientConnectionError:
        return {"success": False, "message": "Could not connect to OctoPrint. Check URL."}
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}

async def test_serial_connection(port: str, baudrate: int = 115200) -> Dict[str, Any]:
    """Test serial connection"""
    try:
        # List available ports
        available_ports = [p.device for p in serial.tools.list_ports.comports()]
        
        if port not in available_ports:
            return {
                "success": False, 
                "message": f"Port {port} not found. Available ports: {', '.join(available_ports)}"
            }
        
        # Try to open port (quick test)
        import serial
        test_serial = serial.Serial(port, baudrate, timeout=2)
        test_serial.close()
        
        return {
            "success": True,
            "message": f"Port {port} is available",
            "available_ports": available_ports
        }
        
    except serial.SerialException as e:
        return {"success": False, "message": f"Cannot open port: {str(e)}"}
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}

async def fetch_prusalink_data(printer_info: Dict[str, Any]) -> Dict[str, Any]:
    """Fetch real data from PrusaLink printer"""
    try:
        url = printer_info["url"].replace("http://", "").replace("https://", "").strip("/")
        auth = HTTPDigestAuth(printer_info.get("username", "maker"), printer_info["password"])
        
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
            
            return {
                "connected": True,
                "state": state,
                "telemetry": {
                    "temp-nozzle": telemetry.get("temp-nozzle", 0.0),
                    "temp-bed": telemetry.get("temp-bed", 0.0),
                    "temp-nozzle-target": telemetry.get("target-nozzle", 0.0),
                    "temp-bed-target": telemetry.get("target-bed", 0.0),
                },
                "job": data.get("job"),
                "last_updated": datetime.now().isoformat()
            }
        else:
            logger.warning(f"PrusaLink fetch failed for {printer_info['id']}: {response.status_code}")
            return {
                "connected": False,
                "state": {"text": "Offline"},
                "telemetry": {}
            }
            
    except Exception as e:
        logger.error(f"Error fetching PrusaLink data: {e}")
        return {
            "connected": False,
            "state": {"text": "Connection Error"},
            "telemetry": {}
        }

async def get_real_printer_status(printer_id: str) -> Dict[str, Any]:
    """Get real printer status from connected printer"""
    
    # Check OctoPrint printers
    if INTEGRATIONS_AVAILABLE and octoprint_manager:
        printer = octoprint_manager.get_printer(printer_id)
        if printer:
            status = printer.get_status()
            return {
                "connected": status.get("connected", False),
                "state": {"text": status.get("state", "unknown")},
                "telemetry": {
                    "temp-nozzle": status.get("temperatures", {}).get("extruder", {}).get("actual", 0),
                    "temp-bed": status.get("temperatures", {}).get("bed", {}).get("actual", 0),
                    "temp-nozzle-target": status.get("temperatures", {}).get("extruder", {}).get("target", 0),
                    "temp-bed-target": status.get("temperatures", {}).get("bed", {}).get("target", 0),
                },
                "job": status.get("job", None)
            }
    
    # Check serial printers
    if INTEGRATIONS_AVAILABLE and printer_id in serial_printers:
        printer = serial_printers[printer_id]
        status = printer.get_status()
        return {
            "connected": status.get("connected", False),
            "state": {"text": status.get("state", "unknown")},
            "telemetry": {
                "temp-nozzle": status.get("extruder_temp", 0),
                "temp-bed": status.get("bed_temp", 0),
                "temp-nozzle-target": status.get("extruder_target", 0),
                "temp-bed-target": status.get("bed_target", 0),
            },
            "position": status.get("position", {})
        }
    
    # Check PrusaLink printers - REAL DATA
    if printer_id in prusalink_printers:
        printer_info = prusalink_printers[printer_id]
        real_data = await fetch_prusalink_data(printer_info)
        return real_data
    
    # Return simulated data if no real printer
    if printer_id in simulated_printers:
        printer = simulated_printers[printer_id]
        # Check if it's a PrusaLink printer that should be real
        if printer.get("connection_type") == "prusalink" and printer.get("password"):
            # Move to real PrusaLink storage
            prusalink_printers[printer_id] = printer
            real_data = await fetch_prusalink_data(printer)
            return real_data
        
        # Otherwise return simulated data
        import random
        base_temp = printer.get("base_temp", 25)
        if printer.get("heating", False):
            base_temp = min(base_temp + random.uniform(0.5, 2), printer.get("target_temp", 200))
            printer["base_temp"] = base_temp
        
        return {
            "connected": True,
            "state": {"text": printer.get("state", "Ready")},
            "telemetry": {
                "temp-nozzle": round(base_temp + random.uniform(-0.5, 0.5), 1),
                "temp-bed": round(23 + random.uniform(-0.5, 0.5), 1),
            }
        }
    
    return None

# ============== PRINTER ENDPOINTS ==============

@app.get("/api/v1/equipment/printers/discover")
async def discover_printers():
    """Discover available printers (serial ports)"""
    ports = []
    
    try:
        for port in serial.tools.list_ports.comports():
            # Check for 3D printer identifiers
            is_printer = any(x in str(port.description).lower() for x in 
                           ["prusa", "arduino", "ch340", "ft232", "ultimaker", "rambo"])
            
            ports.append({
                "port": port.device,
                "description": port.description,
                "hwid": port.hwid,
                "likely_printer": is_printer
            })
    except Exception as e:
        logger.error(f"Port discovery error: {e}")
    
    return ports

@app.post("/api/v1/equipment/printers/test")
async def test_printer_connection(request: PrinterTestRequest):
    """Test printer connection - No auth required for better UX"""
    logger.info(f"Testing {request.connection_type} connection")
    
    if request.connection_type == "prusalink":
        result = await test_prusalink_connection(
            request.url or "",
            request.username or "maker",
            request.password or ""
        )
        return result
        
    elif request.connection_type == "octoprint":
        result = await test_octoprint_connection(
            request.url or "",
            request.api_key or ""
        )
        return result
        
    elif request.connection_type == "serial" or request.connection_type == "usb":
        result = await test_serial_connection(
            request.port or "/dev/ttyUSB0",
            request.baudrate or 115200
        )
        return result
        
    else:
        return {
            "success": True,
            "message": f"{request.connection_type} connection test passed (simulated)"
        }

@app.post("/api/v1/equipment/printers")
async def add_printer(
    request: PrinterAddRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Add a printer - Requires authentication"""
    logger.info(f"User {current_user.username} adding printer: {request.name}")
    
    success = False
    error_msg = None
    
    try:
        if request.connection_type == "octoprint" and INTEGRATIONS_AVAILABLE:
            # Add OctoPrint printer
            config = OctoPrintConfig(
                url=request.url,
                api_key=request.api_key,
                name=request.name,
                auto_connect=request.auto_connect
            )
            success = await octoprint_manager.add_printer(request.printer_id, config)
            
        elif request.connection_type == "serial" and INTEGRATIONS_AVAILABLE:
            # Add serial printer
            config = PrusaConfig(
                port=request.port,
                baudrate=request.baudrate,
                model=request.model or "Prusa"
            )
            printer = PrusaSerial(config)
            if await printer.connect():
                serial_printers[request.printer_id] = printer
                success = True
            else:
                error_msg = "Failed to connect to serial port"
                
        elif request.connection_type == "prusalink":
            # Store PrusaLink printer for real data fetching
            prusalink_printers[request.printer_id] = {
                "id": request.printer_id,
                "name": request.name,
                "connection_type": "prusalink",
                "url": request.url,
                "username": request.username or "maker",
                "password": request.password,
                "manufacturer": request.manufacturer,
                "model": request.model,
                "added_by": current_user.username,
                "added_at": datetime.now().isoformat()
            }
            
            # Also store in simulated for persistence
            simulated_printers[request.printer_id] = prusalink_printers[request.printer_id].copy()
            
            # Test connection immediately
            real_data = await fetch_prusalink_data(prusalink_printers[request.printer_id])
            if real_data["connected"]:
                logger.info(f"Successfully connected to PrusaLink printer {request.printer_id}")
            
            success = True
            
        else:
            # Fallback to simulated
            simulated_printers[request.printer_id] = {
                "id": request.printer_id,
                "name": request.name,
                "connection_type": request.connection_type,
                "state": "Ready",
                "base_temp": 25,
                "heating": False,
                "target_temp": 0,
                "manufacturer": request.manufacturer,
                "model": request.model,
                "added_by": current_user.username,
                "added_at": datetime.now().isoformat()
            }
            success = True
            
    except Exception as e:
        logger.error(f"Error adding printer: {e}")
        error_msg = str(e)
    
    if success:
        # Notify WebSocket clients
        await broadcast_printer_update(request.printer_id)
        
        return {
            "status": "success",
            "message": f"Printer {request.name} added successfully by {current_user.username}"
        }
    else:
        raise HTTPException(
            status_code=400,
            detail=error_msg or "Failed to add printer"
        )

@app.get("/api/v1/equipment/printers")
async def list_printers():
    """List all printers - No auth required for read access"""
    printers = []
    
    # Get OctoPrint printers
    if INTEGRATIONS_AVAILABLE and octoprint_manager:
        for printer_id, client in octoprint_manager.get_all_printers().items():
            status = await get_real_printer_status(printer_id)
            if status:
                printers.append({
                    "id": printer_id,
                    "connection_type": "octoprint",
                    **status
                })
    
    # Get serial printers
    if INTEGRATIONS_AVAILABLE:
        for printer_id in serial_printers:
            status = await get_real_printer_status(printer_id)
            if status:
                printers.append({
                    "id": printer_id,
                    "connection_type": "serial",
                    **status
                })
    
    # Get PrusaLink printers with real data
    for printer_id in prusalink_printers:
        status = await get_real_printer_status(printer_id)
        if status:
            printer_info = prusalink_printers[printer_id]
            printers.append({
                "id": printer_id,
                "name": printer_info.get("name"),
                "connection_type": "prusalink",
                "manufacturer": printer_info.get("manufacturer"),
                "model": printer_info.get("model"),
                **status
            })
    
    # Get simulated printers (excluding those already in PrusaLink)
    for printer_id, printer in simulated_printers.items():
        if printer_id not in prusalink_printers:
            status = await get_real_printer_status(printer_id)
            if status:
                printers.append({
                    "id": printer_id,
                    "name": printer.get("name"),
                    "connection_type": printer.get("connection_type"),
                    **status
                })
    
    return printers

@app.get("/api/v1/equipment/printers/{printer_id}")
async def get_printer_status(printer_id: str):
    """Get printer status - No auth required for read access"""
    status = await get_real_printer_status(printer_id)
    
    if status:
        # Get additional info from storage
        printer_info = prusalink_printers.get(printer_id) or simulated_printers.get(printer_id, {})
        
        return {
            "id": printer_id,
            "name": printer_info.get("name", "Unknown"),
            "manufacturer": printer_info.get("manufacturer", "Unknown"),
            "model": printer_info.get("model", "Unknown"),
            "connection_type": printer_info.get("connection_type", "unknown"),
            **status
        }
    else:
        raise HTTPException(status_code=404, detail="Printer not found")

@app.delete("/api/v1/equipment/printers/{printer_id}")
async def delete_printer(
    printer_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Delete a printer - Requires authentication"""
    deleted = False
    
    # Remove from OctoPrint
    if INTEGRATIONS_AVAILABLE and octoprint_manager:
        if await octoprint_manager.remove_printer(printer_id):
            deleted = True
    
    # Remove from serial printers
    if INTEGRATIONS_AVAILABLE and printer_id in serial_printers:
        printer = serial_printers[printer_id]
        await printer.disconnect()
        del serial_printers[printer_id]
        deleted = True
    
    # Remove from PrusaLink printers
    if printer_id in prusalink_printers:
        printer_name = prusalink_printers[printer_id].get("name", "Unknown")
        del prusalink_printers[printer_id]
        deleted = True
    
    # Remove from simulated
    if printer_id in simulated_printers:
        printer_name = simulated_printers[printer_id].get("name", "Unknown")
        del simulated_printers[printer_id]
        deleted = True
    
    if deleted:
        logger.info(f"User {current_user.username} deleted printer: {printer_id}")
        await broadcast_printer_update(printer_id, deleted=True)
        return {"message": f"Printer deleted successfully"}
    else:
        raise HTTPException(status_code=404, detail="Printer not found")

# ============== WEBSOCKET FOR REAL-TIME UPDATES ==============

@app.websocket("/ws/printers")
async def websocket_printer_updates(websocket: WebSocket):
    """WebSocket for real-time printer updates"""
    await websocket.accept()
    active_websockets.append(websocket)
    
    try:
        # Send initial printer list
        printers = await list_printers()
        await websocket.send_json({
            "type": "initial",
            "printers": printers
        })
        
        # Keep connection alive and send updates
        while True:
            # Wait for client messages (ping/pong)
            data = await websocket.receive_text()
            
            # Could handle commands here if needed
            if data == "ping":
                await websocket.send_text("pong")
                
    except WebSocketDisconnect:
        active_websockets.remove(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if websocket in active_websockets:
            active_websockets.remove(websocket)

async def broadcast_printer_update(printer_id: str, deleted: bool = False):
    """Broadcast printer update to all WebSocket clients"""
    if not active_websockets:
        return
    
    if deleted:
        message = {
            "type": "printer_deleted",
            "printer_id": printer_id
        }
    else:
        try:
            status = await get_printer_status(printer_id)
            message = {
                "type": "printer_update",
                "printer": status
            }
        except:
            return
    
    # Send to all connected clients
    disconnected = []
    for websocket in active_websockets:
        try:
            await websocket.send_json(message)
        except:
            disconnected.append(websocket)
    
    # Remove disconnected clients
    for ws in disconnected:
        active_websockets.remove(ws)

# ============== BACKGROUND TASKS ==============

async def printer_status_updater():
    """Background task to update printer statuses"""
    while True:
        try:
            # Update all printer statuses
            all_printer_ids = set()
            all_printer_ids.update(simulated_printers.keys())
            all_printer_ids.update(prusalink_printers.keys())
            
            for printer_id in all_printer_ids:
                await broadcast_printer_update(printer_id)
            
            # Wait before next update
            await asyncio.sleep(5)  # Update every 5 seconds
            
        except Exception as e:
            logger.error(f"Status updater error: {e}")
            await asyncio.sleep(10)

@app.on_event("startup")
async def startup_event():
    """Start background tasks"""
    asyncio.create_task(printer_status_updater())

# ============== ROOT ENDPOINTS ==============

@app.get("/")
async def root():
    """Root endpoint with system info"""
    return {
        "message": "W.I.T. Terminal API with Real Printer Support",
        "version": "1.1.0",
        "integrations_available": INTEGRATIONS_AVAILABLE,
        "auth_enabled": True,
        "websocket": "ws://localhost:8000/ws/printers",
        "endpoints": {
            "auth": {
                "login": "/api/v1/auth/login",
                "token": "/api/v1/auth/token",
                "me": "/api/v1/auth/me"
            },
            "equipment": {
                "discover": "/api/v1/equipment/printers/discover",
                "test": "/api/v1/equipment/printers/test (no auth)",
                "list": "/api/v1/equipment/printers (no auth)",
                "add": "/api/v1/equipment/printers (auth required)",
                "status": "/api/v1/equipment/printers/{id} (no auth)",
                "delete": "/api/v1/equipment/printers/{id} (auth required)"
            },
            "docs": "/docs"
        },
        "printer_types": [
            "serial (USB) - Direct connection",
            "prusalink - Network Prusa printers (REAL DATA)",
            "octoprint - OctoPrint servers"
        ],
        "updates": "PrusaLink now fetches REAL temperature data!"
    }

# ============== MAIN ==============

if __name__ == "__main__":
    print("\n" + "="*70)
    print("🚀 W.I.T. DEVELOPMENT SERVER WITH REAL PRINTER INTEGRATION")
    print("="*70)
    print(f"\n{'✅' if INTEGRATIONS_AVAILABLE else '⚠️ '} Printer Integrations: {'Available' if INTEGRATIONS_AVAILABLE else 'Not found - using simulation'}")
    print("\n✅ Authentication System Active")
    print("\n📌 Default Users:")
    print("   • admin / admin")
    print("   • maker / maker123")
    print("\n🖨️  Supported Printer Types:")
    print("   • Serial/USB - Direct connection to Prusa printers")
    print("   • PrusaLink - Network-enabled Prusa printers (XL, MK4, MINI+)")
    print("     ✨ NOW WITH REAL-TIME TEMPERATURE DATA!")
    print("   • OctoPrint - Any printer with OctoPrint")
    print("\n📡 Real-time Updates:")
    print("   • WebSocket: ws://localhost:8000/ws/printers")
    print("   • PrusaLink data updates every 5 seconds")
    print("\n📚 Documentation:")
    print("   • Swagger UI: http://localhost:8000/docs")
    print("\n💡 Quick Start:")
    print("   1. Login with admin/admin")
    print("   2. Click 'Add Machine'")
    print("   3. Select 'Network (PrusaLink)' connection type")
    print("   4. Enter your printer's IP and password")
    print("   5. Test connection before adding")
    print("   6. Watch real temperatures update live!")
    print("="*70 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)