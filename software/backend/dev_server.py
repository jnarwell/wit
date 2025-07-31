#!/usr/bin/env python3
"""
W.I.T. Development Server with Real Printer Integration
This version connects to actual printers via Serial, PrusaLink, and OctoPrint
Enhanced with detailed status parsing and real-time updates
"""

from fastapi import FastAPI, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

# Import routers from main.py
from routers import (
    projects, tasks, teams, materials, files_router,
    auth_router, voice_router, vision_router, 
    equipment_router, workspace_router, system_router,
    network_router, accounts_router
)
# Use simplified admin router for development
from admin_dev import router as admin_router
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
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env file
# Try multiple locations for .env file
possible_env_paths = [
    Path(__file__).parent / '.env',  # Same directory as dev_server.py
    Path(__file__).parent.parent.parent / '.env',  # Project root
    Path.cwd() / '.env'  # Current working directory
]

env_loaded = False
for env_path in possible_env_paths:
    if env_path.exists():
        load_dotenv(env_path)
        print(f"Loaded .env from: {env_path}")
        env_loaded = True
        break

if not env_loaded:
    print("Warning: No .env file found, using default values")

# Set the RUNNING_IN_DEV_SERVER environment variable
os.environ["RUNNING_IN_DEV_SERVER"] = "true"

# Suppress bcrypt warning
import warnings
warnings.filterwarnings("ignore", message=".*bcrypt.*")

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set dev server environment variable for admin API
os.environ["RUNNING_IN_DEV_SERVER"] = "true"


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

# Include all routers from main.py
# Commented out to use dev_server's built-in projects endpoints
# app.include_router(projects, prefix="/api/v1/projects", tags=["projects"])
app.include_router(tasks, prefix="/api/v1/tasks", tags=["tasks"])
app.include_router(teams, prefix="/api/v1/teams", tags=["teams"])
app.include_router(materials, prefix="/api/v1/materials", tags=["materials"])
app.include_router(files_router, prefix="/api/v1/files", tags=["files"])
# Commented out to use dev_server's built-in auth instead of database auth
# app.include_router(auth_router)
app.include_router(voice_router)
app.include_router(vision_router)
app.include_router(equipment_router)
app.include_router(workspace_router)
app.include_router(system_router)
app.include_router(network_router)
app.include_router(accounts_router)
app.include_router(admin_router)


# ============== AUTH CONFIGURATION ==============

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)


# ============== AUTH MODELS ==============

class Token(BaseModel):
    access_token: str
    token_type: str

class User(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    disabled: Optional[bool] = None
    is_admin: Optional[bool] = False
    is_active: Optional[bool] = True

class UserInDB(User):
    hashed_password: str

class UserLogin(BaseModel):
    username: str
    password: str

class SetTemperatureRequest(BaseModel):
    temperature: float
    target: str  # "nozzle" or "bed"
class PrusaConnectCommand(BaseModel):
    command: str
    kwargs: Dict[str, Any] = {}
    

# ============== USER DATABASE ==============

# In-memory storage for projects (for development)
projects_db = []

# In-memory storage for tasks (for development)
tasks_db = []

users_db = {
    "admin": {
        "username": "admin",
        "full_name": "Admin User",
        "email": "admin@wit.local",
        "hashed_password": pwd_context.hash("admin"),
        "disabled": False,
        "is_admin": True,
        "is_active": True,
    },
    "maker": {
        "username": "maker",
        "full_name": "Maker User",
        "email": "maker@wit.local", 
        "hashed_password": pwd_context.hash("maker123"),
        "disabled": False,
        "is_admin": False,
        "is_active": True,
    },
    "jamie": {
        "username": "jamie",
        "full_name": "Jamie User",
        "email": "jamie@example.com",
        "hashed_password": pwd_context.hash("test123"),
        "disabled": False,
        "is_admin": False,
        "is_active": True,
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

# ============== PROJECT & TASK STORAGE ==============

# In-memory storage for projects (for development)
projects_db = []

# In-memory storage for tasks (for development)
tasks_db = []

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
    logger.info(f"Creating token with data: {data}")
    logger.info(f"Using SECRET_KEY: {SECRET_KEY[:20]}...")
    encoded_token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_token

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

async def get_current_user_optional(token: str = Depends(oauth2_scheme_optional)):
    """Get current user if token provided, otherwise return None"""
    if not token:
        return None
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
    except JWTError:
        return None
    
    user = get_user(fake_users_db, username=username)
    return user

# Also add this optional OAuth2 scheme
async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

# ============== AUTH ENDPOINTS ==============

# Helper function to add new users dynamically
def add_user(username: str, password: str, email: str, is_admin: bool = False):
    """Add a new user to the users_db"""
    users_db[username] = {
        "username": username,
        "full_name": f"{username.title()} User",
        "email": email,
        "hashed_password": pwd_context.hash(password),
        "disabled": False,
        "is_admin": is_admin,
        "is_active": True,
    }
    logger.info(f"Added user {username} to users_db")

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
    logger.info(f"Login attempt for user: {user_login.username}")
    user = authenticate_user(user_login.username, user_login.password)
    if not user:
        logger.warning(f"Authentication failed for user: {user_login.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    logger.info(f"Authentication successful for user: {user.username}")
    access_token = create_access_token(data={"sub": user.username})
    logger.info(f"Token created for user: {user.username}")
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

# ============== STATUS PARSING FUNCTIONS ==============

# Replace the parse_printer_state function in dev_server.py with this version

def parse_printer_state(state_text: str, job_data: Dict[str, Any] = None) -> str:
    """Parse printer state to display format, preserving actual states"""
    if not state_text:
        return "Unknown"
        
    state_lower = state_text.lower()
    
    # Special handling for printing state with progress
    if "printing" in state_lower and job_data:
        progress = job_data.get("progress", {}).get("completion", 0)
        if progress is not None and progress > 0:
            return f"Printing {int(progress)}%"
    
    # Map states to more user-friendly terms
    state_map = {
        "idle": "Idle",
        "ready": "Idle",  # Map ready to idle for consistency
        "operational": "Idle",  # Map operational to idle for clarity
        "busy": "Busy",
        "printing": "Printing",
        "paused": "Paused",
        "pausing": "Pausing",
        "cancelling": "Cancelling",
        "finished": "Finished",
        "stopped": "Stopped",
        "error": "Error",
        "attention": "Attention Required",
        "offline": "Offline",
        "finishing": "Finishing",
        "changing": "Changing Filament",
        "connecting": "Connecting",
        "disconnected": "Disconnected",
        "closed": "Connection Closed",
        "transferring file": "Transferring File",
        "maintenance": "Maintenance Mode",
        "calibrating": "Calibrating",
        "heating": "Heating",
        "cooling": "Cooling",
        "sd_ready": "SD Card Ready",
        "sd_printing": "Printing from SD",
        "loading filament": "Loading Filament",
        "unloading filament": "Unloading Filament"
    }
    
    # Return mapped state or original with title case
    return state_map.get(state_lower, state_text.title())
# Keep the get_status_color function the same but update it to handle more states
def get_status_color(state: str) -> str:
    """Determine status color based on printer state"""
    state_lower = state.lower()
    
    # Green states - printer is ready
    if any(s in state_lower for s in ["ready", "idle", "operational", "finished", "sd_ready"]):
        return "green"
    
    # Yellow states - printer is active or needs attention  
    elif any(s in state_lower for s in ["printing", "busy", "paused", "pausing", "attention", 
                                        "heating", "cooling", "calibrating", "changing", 
                                        "loading", "unloading", "maintenance", "finishing",
                                        "transferring"]):
        return "yellow"
    
    # Red states - printer has error or is offline
    elif any(s in state_lower for s in ["error", "offline", "stopped", "disconnected", 
                                        "closed", "cancelling"]):
        return "red"
    
    # Gray states - printer is in transition
    elif any(s in state_lower for s in ["connecting", "detecting"]):
        return "gray"
    
    # Default to yellow for unknown states
    return "yellow"
def get_status_color(state: str) -> str:
    """Determine status color based on printer state"""
    state_lower = state.lower()
    
    # Green states - printer is ready or successfully completed
    if any(s in state_lower for s in ["ready", "idle", "operational", "finished", "sd_ready"]):
        return "green"
    
    # Yellow states - printer is active or needs attention
    elif any(s in state_lower for s in ["printing", "busy", "paused", "pausing", "attention", 
                                        "heating", "cooling", "calibrating", "changing", 
                                        "loading", "unloading", "maintenance", "finishing",
                                        "transferring"]):
        return "yellow"
    
    # Red states - printer has error or is offline
    elif any(s in state_lower for s in ["error", "offline", "stopped", "disconnected", 
                                        "closed", "cancelling"]):
        return "red"
    
    # Gray states - printer is in transition
    elif any(s in state_lower for s in ["connecting", "detecting"]):
        return "gray"
    
    # Default to yellow for unknown states
    return "yellow"

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
    """Fetch real data from PrusaLink printer with enhanced status and safety checks"""
    try:
        # Comprehensive safety checks
        if printer_info is None:
            logger.error("printer_info is None in fetch_prusalink_data")
            return {
                "connected": False,
                "state": {"text": "Invalid Configuration", "color": "red"},
                "telemetry": {
                    "temp-nozzle": 0,
                    "temp-bed": 0,
                    "temp-nozzle-target": 0,
                    "temp-bed-target": 0
                },
                "error": "No printer configuration"
            }
        
        if not isinstance(printer_info, dict):
            logger.error(f"printer_info is not a dict: {type(printer_info)}")
            return {
                "connected": False,
                "state": {"text": "Invalid Configuration Type", "color": "red"},
                "telemetry": {
                    "temp-nozzle": 0,
                    "temp-bed": 0,
                    "temp-nozzle-target": 0,
                    "temp-bed-target": 0
                },
                "error": "Invalid configuration type"
            }
        
        # Check required fields
        url = printer_info.get("url")
        if not url:
            logger.error("No URL in printer_info")
            return {
                "connected": False,
                "state": {"text": "No URL Configured", "color": "red"},
                "telemetry": {
                    "temp-nozzle": 0,
                    "temp-bed": 0,
                    "temp-nozzle-target": 0,
                    "temp-bed-target": 0
                },
                "error": "Missing printer URL"
            }
            
        password = printer_info.get("password")
        if not password:
            logger.warning("No password in printer_info")
            return {
                "connected": False,
                "state": {"text": "No Password Configured", "color": "red"},
                "telemetry": {
                    "temp-nozzle": 0,
                    "temp-bed": 0,
                    "temp-nozzle-target": 0,
                    "temp-bed-target": 0
                },
                "error": "Missing printer password"
            }
        
        # Clean up URL
        url = url.replace("http://", "").replace("https://", "").strip("/")
        username = printer_info.get("username", "maker")
        auth = HTTPDigestAuth(username, password)
        
        logger.info(f"Connecting to PrusaLink at http://{url}/api/printer")
        
        # Fetch printer status
        printer_response = requests.get(
            f"http://{url}/api/printer",
            auth=auth,
            timeout=5
        )
        
        # Fetch job status
        job_data = None
        try:
            job_response = requests.get(
                f"http://{url}/api/job",
                auth=auth,
                timeout=5
            )
            if job_response.status_code == 200:
                job_data = job_response.json()
        except:
            pass
        
        if printer_response.status_code == 200:
            data = printer_response.json()
            
            # Validate response data
            if data is None:
                logger.error("Printer API returned None")
                return {
                    "connected": False,
                    "state": {"text": "Invalid API Response", "color": "red"},
                    "telemetry": {
                        "temp-nozzle": 0,
                        "temp-bed": 0,
                        "temp-nozzle-target": 0,
                        "temp-bed-target": 0
                    },
                    "error": "API returned None"
                }
            
            if not isinstance(data, dict):
                logger.error(f"Printer API returned non-dict: {type(data)}")
                return {
                    "connected": False,
                    "state": {"text": "Invalid API Response Type", "color": "red"},
                    "telemetry": {
                        "temp-nozzle": 0,
                        "temp-bed": 0,
                        "temp-nozzle-target": 0,
                        "temp-bed-target": 0
                    },
                    "error": f"API returned {type(data).__name__}"
                }
            
            # Safely extract data with defaults
            telemetry = data.get("telemetry", {})
            if not isinstance(telemetry, dict):
                telemetry = {}
                
            state = data.get("state", {})
            if not isinstance(state, dict):
                state = {"text": "Unknown"}
            
            # Parse state with job info
            state_text = state.get("text", "Unknown")
            parsed_state = parse_printer_state(state_text, job_data)
            state_color = get_status_color(parsed_state)
            
            # Build comprehensive status
            status = {
                "connected": True,
                "state": {
                    "text": parsed_state,
                    "flags": state.get("flags", {}),
                    "color": state_color
                },
                "telemetry": {
                    "temp-nozzle": float(telemetry.get("temp-nozzle", 0.0)),
                    "temp-bed": float(telemetry.get("temp-bed", 0.0)),
                    "temp-nozzle-target": float(telemetry.get("target-nozzle", 0.0)),
                    "temp-bed-target": float(telemetry.get("target-bed", 0.0)),
                    "print-speed": int(telemetry.get("print-speed", 100)),
                    "flow": int(telemetry.get("flow", 100)),
                    "axis-x": float(telemetry.get("axis-x", 0.0)),
                    "axis-y": float(telemetry.get("axis-y", 0.0)),
                    "axis-z": float(telemetry.get("axis-z", 0.0)),
                },
                "last_updated": datetime.now().isoformat()
            }
            
            # Add job info if available
            if job_data and isinstance(job_data, dict):
                job_info = job_data.get("job", {})
                progress_info = job_data.get("progress", {})
                
                if isinstance(job_info, dict) and isinstance(progress_info, dict):
                    status["job"] = {
                        "name": job_info.get("file", {}).get("display", job_info.get("file", {}).get("name", "Unknown")),
                        "progress": float(progress_info.get("completion", 0.0)),
                        "time_elapsed": int(progress_info.get("printTime", 0)),
                        "time_remaining": int(progress_info.get("printTimeLeft", 0)),
                        "file_size": int(job_info.get("file", {}).get("size", 0)),
                        "estimated_print_time": int(job_info.get("estimatedPrintTime", 0))
                    }
            
            return status
            
        elif printer_response.status_code == 401:
            logger.warning(f"Authentication failed for {printer_info.get('id', 'unknown')}")
            return {
                "connected": False,
                "state": {"text": "Authentication Failed", "color": "red"},
                "telemetry": {
                    "temp-nozzle": 0,
                    "temp-bed": 0,
                    "temp-nozzle-target": 0,
                    "temp-bed-target": 0
                },
                "error": "Invalid username or password"
            }
        else:
            logger.warning(f"PrusaLink fetch failed for {printer_info.get('id', 'unknown')}: {printer_response.status_code}")
            return {
                "connected": False,
                "state": {"text": "Offline", "color": "red"},
                "telemetry": {
                    "temp-nozzle": 0,
                    "temp-bed": 0,
                    "temp-nozzle-target": 0,
                    "temp-bed-target": 0
                },
                "error": f"HTTP {printer_response.status_code}"
            }
            
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Connection error for {printer_info.get('id', 'unknown')}: {e}")
        return {
            "connected": False,
            "state": {"text": "Connection Failed", "color": "red"},
            "telemetry": {
                "temp-nozzle": 0,
                "temp-bed": 0,
                "temp-nozzle-target": 0,
                "temp-bed-target": 0
            },
            "error": "Cannot reach printer"
        }
    except Exception as e:
        # Enhanced error handling
        printer_id = "unknown"
        try:
            if printer_info and isinstance(printer_info, dict):
                printer_id = printer_info.get('id', 'unknown')
        except:
            pass
            
        error_msg = str(e)
        logger.error(f"Error fetching PrusaLink data for {printer_id}: {error_msg}")
        logger.error(f"Exception type: {type(e).__name__}")
        
        # Safe error response
        return {
            "connected": False,
            "state": {"text": f"Error: {type(e).__name__}", "color": "red"},
            "telemetry": {
                "temp-nozzle": 0,
                "temp-bed": 0,
                "temp-nozzle-target": 0,
                "temp-bed-target": 0
            },
            "error": error_msg[:100]  # Limit error message length
        }
    
async def get_real_printer_status(printer_id: str) -> Dict[str, Any]:
    """Get real printer status from connected printer with better error handling"""
    
    try:
        # Check OctoPrint printers
        if INTEGRATIONS_AVAILABLE and octoprint_manager:
            printer = octoprint_manager.get_printer(printer_id)
            if printer:
                status = printer.get_status()
                if status is None:
                    logger.error(f"OctoPrint printer {printer_id} returned None status")
                    status = {}
                
                state_text = status.get("state", "unknown")
                parsed_state = parse_printer_state(state_text)
                
                return {
                    "connected": status.get("connected", False),
                    "state": {
                        "text": parsed_state,
                        "color": get_status_color(parsed_state)
                    },
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
            if status is None:
                logger.error(f"Serial printer {printer_id} returned None status")
                status = {}
                
            state_text = status.get("state", "unknown")
            parsed_state = parse_printer_state(state_text)
            
            return {
                "connected": status.get("connected", False),
                "state": {
                    "text": parsed_state,
                    "color": get_status_color(parsed_state)
                },
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
            printer_info = prusalink_printers.get(printer_id)
            if printer_info is None:
                logger.error(f"Printer info is None for {printer_id}")
                return {
                    "connected": False,
                    "state": {"text": "Configuration Error", "color": "red"},
                    "telemetry": {
                        "temp-nozzle": 0,
                        "temp-bed": 0,
                        "temp-nozzle-target": 0,
                        "temp-bed-target": 0
                    }
                }
            real_data = await fetch_prusalink_data(printer_info)
            return real_data
        
        # Check simulated printers
        if printer_id in simulated_printers:
            printer = simulated_printers.get(printer_id)
            if printer is None:
                logger.error(f"Simulated printer {printer_id} is None")
                return {
                    "connected": False,
                    "state": {"text": "Configuration Error", "color": "red"},
                    "telemetry": {
                        "temp-nozzle": 0,
                        "temp-bed": 0,
                        "temp-nozzle-target": 0,
                        "temp-bed-target": 0
                    }
                }
                
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
            
            state_text = printer.get("state", "Idle")
            
            
            return {
                "connected": True,
                "state": {
                    "text": state_text,
                    "color": get_status_color(state_text)
                },
                "telemetry": {
                    "temp-nozzle": round(base_temp + random.uniform(-0.5, 0.5), 1),
                    "temp-bed": round(23 + random.uniform(-0.5, 0.5), 1),
                    "temp-nozzle-target": 0,
                    "temp-bed-target": 0
                }
            }
        if printer_id in simulated_printers:
            sim_data = simulated_printers[printer_id]
            
            # Update telemetry with target temps if they exist
            if "target_nozzle" in sim_data:
                status["telemetry"]["temp-nozzle-target"] = sim_data["target_nozzle"]
            if "target_bed" in sim_data:
                status["telemetry"]["temp-bed-target"] = sim_data["target_bed"]
                
            return status
        # Return a safe default status instead of None
        logger.warning(f"Printer {printer_id} not found in any storage")
        return {
            "connected": False,
            "state": {"text": "Not Found", "color": "red"},
            "telemetry": {
                "temp-nozzle": 0,
                "temp-bed": 0,
                "temp-nozzle-target": 0,
                "temp-bed-target": 0
            },
            "error": f"Printer {printer_id} not found"
        }
        
    except Exception as e:
        logger.error(f"Exception in get_real_printer_status for {printer_id}: {e}")
        return {
            "connected": False,
            "state": {"text": "Error", "color": "red"},
            "telemetry": {
                "temp-nozzle": 0,
                "temp-bed": 0,
                "temp-nozzle-target": 0,
                "temp-bed-target": 0
            },
            "error": str(e)
        }
    
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
            logger.info(f"Testing connection for newly added printer {request.printer_id}")
            real_data = await fetch_prusalink_data(prusalink_printers[request.printer_id])
            if real_data["connected"]:
                logger.info(f"Successfully connected to PrusaLink printer {request.printer_id}")
            else:
                logger.warning(f"Failed initial connection to {request.printer_id}: {real_data.get('error', 'Unknown error')}")
            
            success = True
            
        else:
            # Fallback to simulated
            simulated_printers[request.printer_id] = {
    "id": request.printer_id,
    "name": request.name,
    "connection_type": request.connection_type,
    "state": "Idle",  # Changed from "Ready" to "Idle"
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
    try:
        status = await get_real_printer_status(printer_id)
        
        # Ensure status is never None
        if status is None:
            logger.error(f"get_real_printer_status returned None for {printer_id}")
            status = {
                "connected": False,
                "state": {"text": "Not Found", "color": "red"},
                "telemetry": {
                    "temp-nozzle": 0,
                    "temp-bed": 0,
                    "temp-nozzle-target": 0,
                    "temp-bed-target": 0
                },
                "error": "Printer not found"
            }
        
        # Ensure all required fields exist
        if not isinstance(status, dict):
            logger.error(f"Status is not a dict for {printer_id}: {type(status)}")
            status = {
                "connected": False,
                "state": {"text": "Invalid Status", "color": "red"},
                "telemetry": {
                    "temp-nozzle": 0,
                    "temp-bed": 0,
                    "temp-nozzle-target": 0,
                    "temp-bed-target": 0
                },
                "error": "Invalid status format"
            }
            
        # Get additional info from storage
        printer_info = None
        
        # Try to get printer info from various sources
        if printer_id in prusalink_printers:
            printer_info = prusalink_printers.get(printer_id)
        elif printer_id in simulated_printers:
            printer_info = simulated_printers.get(printer_id)
        
        # Ensure printer_info is always a dict
        if printer_info is None:
            logger.warning(f"No printer_info found for {printer_id}")
            printer_info = {}
        elif not isinstance(printer_info, dict):
            logger.error(f"printer_info is not a dict for {printer_id}: {type(printer_info)}")
            printer_info = {}
        
        # Safely get state information
        state_info = status.get("state", {})
        if not isinstance(state_info, dict):
            state_info = {"text": str(state_info), "color": "yellow"}
        
        # Safely get telemetry
        telemetry = status.get("telemetry", {})
        if not isinstance(telemetry, dict):
            telemetry = {
                "temp-nozzle": 0,
                "temp-bed": 0,
                "temp-nozzle-target": 0,
                "temp-bed-target": 0
            }
        
        # Build the proper response for the frontend
        response = {
            "id": printer_id,
            "name": printer_info.get("name", f"Printer {printer_id}"),
            "manufacturer": printer_info.get("manufacturer", "Unknown"),
            "model": printer_info.get("model", "Unknown"),
            "connection_type": printer_info.get("connection_type", "unknown"),
            "connected": status.get("connected", False),
            "state": state_info.get("text", "Unknown"),
            "state_color": state_info.get("color", "red"),
            "temperatures": {
                "nozzle": {
                    "current": telemetry.get("temp-nozzle", 0),
                    "target": telemetry.get("temp-nozzle-target", 0)
                },
                "bed": {
                    "current": telemetry.get("temp-bed", 0),
                    "target": telemetry.get("temp-bed-target", 0)
                }
            },
            "position": {
                "x": telemetry.get("axis-x", 0),
                "y": telemetry.get("axis-y", 0),
                "z": telemetry.get("axis-z", 0)
            }
        }
        
        # Add job info if available
        if status.get("job") and isinstance(status.get("job"), dict):
            response["job"] = status["job"]
        
        # Add error if present
        if status.get("error"):
            response["error"] = status["error"]
        
        # Add raw telemetry for debugging
        response["raw_telemetry"] = telemetry
        
        return response
        
    except Exception as e:
        logger.error(f"Error getting printer status for {printer_id}: {e}", exc_info=True)
        # Return a valid error response
        return {
            "id": printer_id,
            "name": f"Printer {printer_id}",
            "manufacturer": "Unknown",
            "model": "Unknown", 
            "connection_type": "unknown",
            "connected": False,
            "state": "Error",
            "state_color": "red",
            "temperatures": {
                "nozzle": {"current": 0, "target": 0},
                "bed": {"current": 0, "target": 0}
            },
            "position": {"x": 0, "y": 0, "z": 0},
            "error": str(e)
        }
    
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
    
@app.post("/api/v1/equipment/printers/{printer_id}/commands")
@app.post("/api/v1/equipment/printers/{printer_id}/commands/sync")  # Support both URLs
async def send_printer_command(
    printer_id: str,
    command: PrusaConnectCommand,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Send command to printer using PrusaConnect-style API"""
    
    logger.info(f"Received command: {command.command} with kwargs: {command.kwargs}")
    
    # Check if printer exists
    if printer_id not in prusalink_printers and printer_id not in simulated_printers:
        raise HTTPException(status_code=404, detail="Printer not found")
    
    # Handle temperature commands with CORRECT kwargs names
    if command.command == "SET_NOZZLE_TEMPERATURE":
        temp = command.kwargs.get("nozzle_temperature", 0)
        
        # Validate temperature
        if temp < 0 or temp > 250:
            raise HTTPException(status_code=400, detail="Nozzle temperature must be between 0 and 250°C")
        
        # Store target temp for display
        if printer_id not in simulated_printers:
            simulated_printers[printer_id] = {}
        
        simulated_printers[printer_id]["target_nozzle"] = temp
        simulated_printers[printer_id]["heating_nozzle"] = temp > 0
        
        logger.info(f"Set nozzle temperature to {temp}°C for printer {printer_id}")
        
        # If it's a real PrusaLink printer, try to forward command
        if printer_id in prusalink_printers:
            # Note: Local PrusaLink doesn't have commands API, so we simulate
            # In a real implementation, you might forward to PrusaConnect cloud
            pass
        
        return {
            "status": "success",
            "command": command.command,
            "kwargs": command.kwargs,
            "message": f"Setting nozzle to {temp}°C"
        }
    
    elif command.command == "SET_HEATBED_TEMPERATURE":
        temp = command.kwargs.get("bed_temperature", 0)
        
        # Validate temperature  
        if temp < 0 or temp > 80:
            raise HTTPException(status_code=400, detail="Bed temperature must be between 0 and 80°C")
        
        # Store target temp
        if printer_id not in simulated_printers:
            simulated_printers[printer_id] = {}
            
        simulated_printers[printer_id]["target_bed"] = temp
        simulated_printers[printer_id]["heating_bed"] = temp > 0
        
        logger.info(f"Set bed temperature to {temp}°C for printer {printer_id}")
        
        return {
            "status": "success",
            "command": command.command,
            "kwargs": command.kwargs,
            "message": f"Setting bed to {temp}°C"
        }
    
    elif command.command == "HOME":
        axis = command.kwargs.get("axis", "XYZ")
        logger.info(f"Homing axis: {axis}")
        
        return {
            "status": "success",
            "command": command.command,
            "kwargs": command.kwargs,
            "message": f"Homing {axis} axis"
        }
    
    elif command.command == "MOVE":
        # Handle movement commands
        x = command.kwargs.get("x", 0)
        y = command.kwargs.get("y", 0)
        z = command.kwargs.get("z", 0)
        feedrate = command.kwargs.get("feedrate", 3000)
        
        return {
            "status": "success",
            "command": command.command,
            "kwargs": command.kwargs,
            "message": f"Moving to X:{x} Y:{y} Z:{z} at F{feedrate}"
        }
    
    elif command.command == "SET_FLOW":
        flow = command.kwargs.get("flow", 100)
        
        return {
            "status": "success",
            "command": command.command,
            "kwargs": command.kwargs,
            "message": f"Setting flow to {flow}%"
        }
    
    elif command.command == "SET_SPEED":
        speed = command.kwargs.get("speed", 100)
        
        return {
            "status": "success",
            "command": command.command,
            "kwargs": command.kwargs,
            "message": f"Setting speed to {speed}%"
        }
    
    # Other commands
    else:
        logger.warning(f"Unknown command: {command.command}")
        return {
            "status": "unknown",
            "command": command.command,
            "kwargs": command.kwargs,
            "message": f"Command '{command.command}' not implemented"
        }

# ============== WEBSOCKET FOR REAL-TIME UPDATES ==============

@app.websocket("/api/v1/equipment/ws/printers")
async def websocket_equipment_printer_updates(websocket: WebSocket):
    """WebSocket for real-time printer updates - equipment API path"""
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
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if websocket in active_websockets:
            active_websockets.remove(websocket)

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

@app.websocket("/ws/printers/{printer_id}")
async def websocket_printer_endpoint(websocket: WebSocket, printer_id: str):
    """WebSocket endpoint for real-time printer updates with better error handling"""
    await websocket.accept()
    logger.info(f"WebSocket connected for printer {printer_id}")
    
    try:
        while True:
            try:
                # Get printer status
                status = await get_real_printer_status(printer_id)
                
                # Ensure status is never None
                if status is None:
                    logger.error(f"get_real_printer_status returned None for {printer_id}")
                    status = {
                        "connected": False,
                        "state": {"text": "Error", "color": "red"},
                        "telemetry": {
                            "temp-nozzle": 0,
                            "temp-bed": 0,
                            "temp-nozzle-target": 0,
                            "temp-bed-target": 0
                        },
                        "error": "Unable to retrieve printer status"
                    }
                
                # Send status update
                await websocket.send_json({
                    "type": "status_update",
                    "printer_id": printer_id,
                    "data": status
                })
                
            except Exception as e:
                logger.error(f"Error getting status for printer {printer_id}: {e}")
                # Send error status
                await websocket.send_json({
                    "type": "status_update", 
                    "printer_id": printer_id,
                    "data": {
                        "connected": False,
                        "state": {"text": "Connection Error", "color": "red"},
                        "telemetry": {
                            "temp-nozzle": 0,
                            "temp-bed": 0,
                            "temp-nozzle-target": 0,
                            "temp-bed-target": 0
                        },
                        "error": str(e)
                    }
                })
            
            # Wait before next update
            await asyncio.sleep(2)
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for printer {printer_id}")
    except Exception as e:
        logger.error(f"WebSocket error for printer {printer_id}: {e}")
        try:
            await websocket.close()
        except:
            pass
        
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

# Add this endpoint to dev_server.py after the other printer endpoints
@app.post("/api/v1/equipment/printers/{printer_id}/temperature")
async def set_printer_temperature(
    printer_id: str,
    request: SetTemperatureRequest,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Set target temperature for nozzle or bed - Auth optional for development"""
    
    # Log who is making the request
    if current_user:
        logger.info(f"User {current_user.username} setting temperature")
    else:
        logger.warning("Temperature set without authentication")
    
    # Validate temperature ranges
    if request.target == "nozzle":
        if request.temperature < 0 or request.temperature > 250:
            raise HTTPException(
                status_code=400,
                detail="Nozzle temperature must be between 0 and 250°C"
            )
    elif request.target == "bed":
        if request.temperature < 0 or request.temperature > 80:
            raise HTTPException(
                status_code=400,
                detail="Bed temperature must be between 0 and 80°C"
            )
    else:
        raise HTTPException(
            status_code=400,
            detail="Target must be 'nozzle' or 'bed'"
        )
    
    # Check if printer exists
    printer_exists = False
    
    if printer_id in prusalink_printers:
        printer_info = prusalink_printers[printer_id]
        printer_exists = True
        
        try:
            # Send temperature command to PrusaLink printer
            url = printer_info.get("url", "")
            if not url.startswith('http'):
                url = f'http://{url}'
            
            # PrusaLink uses different API endpoints
            # For PrusaLink, we need to use the correct endpoint structure
            auth = HTTPDigestAuth(
                printer_info.get("username", "maker"),
                printer_info.get("password", "")
            )
            
            # First, let's check printer status to ensure it's connected
            status_response = requests.get(
                f"{url}/api/v1/status",
                auth=auth,
                timeout=5
            )
            
            if status_response.status_code != 200:
                logger.error(f"Printer not accessible: {status_response.status_code}")
                raise HTTPException(
                    status_code=502,
                    detail=f"Cannot connect to printer: HTTP {status_response.status_code}"
                )
            
            # PrusaLink temperature setting endpoints
            if request.target == "nozzle":
                # For nozzle/tool temperature
                endpoint = f"{url}/api/v1/printer/tools/0/target"
                data = {"target": request.temperature}
            else:  # bed
                # For bed temperature  
                endpoint = f"{url}/api/v1/printer/bed/target"
                data = {"target": request.temperature}
            
            # Send PUT request (PrusaLink uses PUT for temperature)
            response = requests.put(
                endpoint,
                json=data,
                auth=auth,
                timeout=5
            )
            
            # Alternative: Try POST if PUT fails
            if response.status_code not in [200, 201, 204]:
                logger.warning(f"PUT failed with {response.status_code}, trying POST")
                response = requests.post(
                    endpoint,
                    json=data,
                    auth=auth,
                    timeout=5
                )
            
            # Also try the OctoPrint-style API if both fail
            if response.status_code not in [200, 201, 204]:
                logger.warning(f"Trying OctoPrint-style API")
                if request.target == "nozzle":
                    endpoint = f"{url}/api/printer/tool"
                    data = {
                        "command": "target",
                        "targets": {"tool0": request.temperature}
                    }
                else:
                    endpoint = f"{url}/api/printer/bed"
                    data = {
                        "command": "target",
                        "target": request.temperature
                    }
                
                response = requests.post(
                    endpoint,
                    json=data,
                    auth=auth,
                    timeout=5
                )
            
            if response.status_code in [200, 201, 204]:
                logger.info(f"Set {request.target} temperature to {request.temperature}°C for printer {printer_id}")
                
                return {
                    "status": "success",
                    "message": f"Setting {request.target} temperature to {request.temperature}°C",
                    "printer_id": printer_id,
                    "target": request.target,
                    "temperature": request.temperature
                }
            else:
                logger.error(f"Failed to set temperature: HTTP {response.status_code}, Response: {response.text}")
                
                # If it's a 404, the printer might not support temperature control via API
                if response.status_code == 404:
                    raise HTTPException(
                        status_code=501,
                        detail="This printer may not support temperature control via API. Try using the printer's web interface."
                    )
                else:
                    raise HTTPException(
                        status_code=502,
                        detail=f"Printer returned error: HTTP {response.status_code}"
                    )
                
        except requests.exceptions.ConnectionError:
            logger.error(f"Cannot connect to printer at {url}")
            raise HTTPException(
                status_code=502,
                detail="Cannot connect to printer. Check if printer is online."
            )
        except requests.exceptions.Timeout:
            logger.error("Printer request timed out")
            raise HTTPException(
                status_code=504,
                detail="Printer request timed out"
            )
        except HTTPException:
            raise  # Re-raise HTTP exceptions
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Unexpected error: {str(e)}"
            )
    
    # Check simulated printers
    elif printer_id in simulated_printers:
        printer_exists = True
        
        # Update simulated printer state
        if request.target == "nozzle":
            simulated_printers[printer_id]["target_temp"] = request.temperature
            simulated_printers[printer_id]["heating"] = request.temperature > 0
        # Note: for bed temperature, you'd need to add bed_temp tracking to simulated printers
        
        logger.info(f"Set {request.target} temperature to {request.temperature}°C for simulated printer {printer_id}")
        
        return {
            "status": "success",
            "message": f"Setting {request.target} temperature to {request.temperature}°C (simulated)",
            "printer_id": printer_id,
            "target": request.target,
            "temperature": request.temperature
        }
    
    if not printer_exists:
        raise HTTPException(
            status_code=404,
            detail=f"Printer {printer_id} not found"
        )
    
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

# ============== MISSING ENDPOINTS ==============

# Terminal endpoints
@app.post("/api/v1/terminal/command")
async def terminal_command(command: dict, current_user: User = Depends(get_current_user)):
    """Execute terminal command with AI assistant"""
    user_command = command.get('command', '')
    
    # Simulate AI responses for common commands
    ai_responses = {
        "hi": "Hello! I'm W.I.T., your Workshop Intelligence Terminal. How can I assist you today?",
        "hello": "Hello! I'm W.I.T., your Workshop Intelligence Terminal. How can I assist you today?",
        "help": "I can help you with:\n• Managing projects and tasks\n• Controlling 3D printers and equipment\n• File management and organization\n• Workshop automation\n\nTry commands like 'list projects', 'check printers', or ask me anything!",
        "how are you": "I'm functioning optimally! Ready to help you manage your workshop. What would you like to work on today?",
        "list projects": "You currently have no active projects. Use 'create project <name>' to start a new one.",
        "check printers": "No printers are currently connected. Use the Equipment page to add printers.",
        "whoami": f"You are logged in as: {current_user.username}",
        "date": f"Current date and time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "clear": "Terminal cleared.",
    }
    
    # Check for exact matches first
    command_lower = user_command.lower().strip()
    if command_lower in ai_responses:
        response = ai_responses[command_lower]
    # Check for partial matches
    elif "project" in command_lower:
        if "create" in command_lower or "new" in command_lower:
            # Extract project name from command
            import re
            match = re.search(r'(?:create|new)\s+project\s+(.+)', command_lower)
            if match:
                project_name = match.group(1).strip()
                # Create the project
                import uuid
                project_id = str(uuid.uuid4())
                project_code = f"PROJ-{len(projects_db) + 1:04d}"
                new_project = {
                    "id": project_id,
                    "project_id": project_code,
                    "name": project_name.title(),
                    "description": f"Created via WIT terminal",
                    "type": "general",
                    "status": "not_started",
                    "priority": "medium",
                    "owner_id": current_user.username,
                    "created_at": datetime.now().isoformat(),
                    "updated_at": datetime.now().isoformat(),
                    "extra_data": {}
                }
                projects_db.append(new_project)
                response = f"✅ Project '{project_name.title()}' created successfully! Project ID: {project_code}"
            else:
                response = "To create a project, use: 'create project <name>' or 'new project <name>'"
        elif "list" in command_lower or "show" in command_lower:
            if len(projects_db) == 0:
                response = "You currently have no active projects. Use 'create project <name>' to start one."
            else:
                response = "📋 Your projects:\n"
                for proj in projects_db:
                    response += f"• {proj['project_id']}: {proj['name']} ({proj['status']})\n"
        else:
            response = "I can help you manage projects. Try 'list projects' or 'create project <name>'"
    elif "printer" in command_lower:
        response = "No printers are currently connected. Visit the Equipment page to add and manage printers."
    elif "task" in command_lower:
        response = "No tasks found. Tasks are usually associated with projects. Create a project first!"
    elif "file" in command_lower:
        response = "File operations are available through the File Browser in the sidebar."
    elif any(greeting in command_lower for greeting in ["hi", "hello", "hey"]):
        response = "Hello! I'm W.I.T., your Workshop Intelligence Terminal. How can I assist you today?"
    else:
        # Default AI-like response for unknown commands
        response = f"I understand you said '{user_command}'. I'm still learning and expanding my capabilities. Try 'help' to see what I can do, or rephrase your request."
    
    return {
        "response": response,
        "status": "success"
    }

@app.post("/api/v1/log-ai-message")
async def log_ai_message(message: dict):
    """Log AI message"""
    logger.info(f"AI message: {message}")
    return {"status": "logged"}

# Projects endpoints
@app.get("/api/v1/projects/")
async def list_projects(current_user: User = Depends(get_current_user)):
    """Get all projects"""
    return projects_db

@app.post("/api/v1/projects/")
async def create_project(project: dict, current_user: User = Depends(get_current_user)):
    """Create a new project"""
    import uuid
    project_id = str(uuid.uuid4())
    project_code = f"PROJ-{len(projects_db) + 1:04d}"
    
    new_project = {
        "id": project_id,
        "project_id": project_code,
        "name": project.get("name", "New Project"),
        "description": project.get("description", ""),
        "type": project.get("type", "general"),
        "status": project.get("status", "not_started"),
        "priority": project.get("priority", "medium"),
        "owner_id": current_user.username,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "extra_data": project.get("extra_data", {})
    }
    
    projects_db.append(new_project)
    logger.info(f"Created project: {new_project['name']} ({project_code})")
    
    return new_project

@app.get("/api/v1/projects/{project_id}")
async def get_project(project_id: str, current_user: User = Depends(get_current_user)):
    """Get individual project details"""
    # Search by both id and project_id fields
    for project in projects_db:
        if project["id"] == project_id or project["project_id"] == project_id:
            return project
    
    raise HTTPException(
        status_code=404,
        detail=f"Project {project_id} not found"
    )

@app.put("/api/v1/projects/{project_id}")
async def update_project(project_id: str, updates: dict, current_user: User = Depends(get_current_user)):
    """Update project details"""
    for i, project in enumerate(projects_db):
        if project["id"] == project_id or project["project_id"] == project_id:
            # Update allowed fields
            if "name" in updates:
                project["name"] = updates["name"]
            if "description" in updates:
                project["description"] = updates["description"]
            if "status" in updates:
                project["status"] = updates["status"]
            if "priority" in updates:
                project["priority"] = updates["priority"]
            if "type" in updates:
                project["type"] = updates["type"]
            if "extra_data" in updates:
                project["extra_data"].update(updates["extra_data"])
            
            project["updated_at"] = datetime.now().isoformat()
            projects_db[i] = project
            logger.info(f"Updated project: {project['name']} ({project['project_id']})")
            return project
    
    raise HTTPException(
        status_code=404,
        detail=f"Project {project_id} not found"
    )

@app.patch("/api/v1/projects/{project_id}")
async def patch_project(project_id: str, updates: dict, current_user: User = Depends(get_current_user)):
    """Partially update project details"""
    for i, project in enumerate(projects_db):
        if project["id"] == project_id or project["project_id"] == project_id:
            # Update allowed fields
            if "name" in updates:
                project["name"] = updates["name"]
            if "description" in updates:
                project["description"] = updates["description"]
            if "status" in updates:
                project["status"] = updates["status"]
            if "priority" in updates:
                project["priority"] = updates["priority"]
            if "type" in updates:
                project["type"] = updates["type"]
            if "extra_data" in updates:
                project["extra_data"].update(updates["extra_data"])
            
            project["updated_at"] = datetime.now().isoformat()
            projects_db[i] = project
            logger.info(f"Updated project: {project['name']} ({project['project_id']})")
            return project
    
    raise HTTPException(
        status_code=404,
        detail=f"Project {project_id} not found"
    )

@app.delete("/api/v1/projects/{project_id}")
async def delete_project(project_id: str, current_user: User = Depends(get_current_user)):
    """Delete a project"""
    for i, project in enumerate(projects_db):
        if project["id"] == project_id or project["project_id"] == project_id:
            deleted_project = projects_db.pop(i)
            logger.info(f"Deleted project: {deleted_project['name']} ({deleted_project['project_id']})")
            return {"message": f"Project {deleted_project['name']} deleted successfully"}
    
    raise HTTPException(
        status_code=404,
        detail=f"Project {project_id} not found"
    )

# Tasks endpoints
@app.get("/api/v1/tasks/incomplete")
async def get_incomplete_tasks(current_user: User = Depends(get_current_user)):
    """Get incomplete tasks for the current user"""
    incomplete_tasks = [
        task for task in tasks_db 
        if task["status"] != "completed" and task["owner_id"] == current_user.username
    ]
    return incomplete_tasks

@app.get("/api/v1/projects/{project_id}/tasks")
async def get_project_tasks(project_id: str, current_user: User = Depends(get_current_user)):
    """Get all tasks for a project"""
    # Check if project exists and get the actual project
    project = None
    for p in projects_db:
        if p["id"] == project_id or p.get("project_id") == project_id:
            project = p
            break
    
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    # Return tasks for this project (search by both id and project_id)
    project_tasks = []
    for task in tasks_db:
        if task["project_id"] == project["id"] or task["project_id"] == project.get("project_id", project["id"]):
            project_tasks.append(task)
    
    return project_tasks

@app.post("/api/v1/projects/{project_id}/tasks")
async def create_project_task(project_id: str, task: dict, current_user: User = Depends(get_current_user)):
    """Create a new task for a project"""
    # Check if project exists
    project_exists = any(p["id"] == project_id or p["project_id"] == project_id for p in projects_db)
    if not project_exists:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    import uuid
    task_id = str(uuid.uuid4())
    task_code = f"TASK-{len(tasks_db) + 1:04d}"
    new_task = {
        "id": task_id,
        "task_id": task_code,
        "project_id": project_id,
        "name": task.get("name", task.get("title", "New Task")),
        "description": task.get("description", ""),
        "status": task.get("status", "not_started"),
        "priority": task.get("priority", "medium"),
        "assigned_to": task.get("assigned_to", task.get("assignee")),
        "owner_id": current_user.username,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "due_date": task.get("due_date"),
        "tags": task.get("tags", [])
    }
    
    tasks_db.append(new_task)
    logger.info(f"Created task: {new_task['name']} for project {project_id}")
    return new_task

@app.get("/api/v1/tasks/{task_id}")
async def get_task(task_id: str, current_user: User = Depends(get_current_user)):
    """Get individual task details"""
    for task in tasks_db:
        if task["id"] == task_id or task.get("task_id") == task_id:
            return task
    
    raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

@app.put("/api/v1/tasks/{task_id}")
async def update_task(task_id: str, updates: dict, current_user: User = Depends(get_current_user)):
    """Update task details"""
    for i, task in enumerate(tasks_db):
        if task["id"] == task_id or task.get("task_id") == task_id:
            # Update allowed fields
            if "name" in updates:
                task["name"] = updates["name"]
            if "title" in updates:  # Support both name and title
                task["name"] = updates["title"]
            if "description" in updates:
                task["description"] = updates["description"]
            if "status" in updates:
                task["status"] = updates["status"]
            if "priority" in updates:
                task["priority"] = updates["priority"]
            if "assigned_to" in updates:
                task["assigned_to"] = updates["assigned_to"]
            if "assignee" in updates:  # Support both assigned_to and assignee
                task["assigned_to"] = updates["assignee"]
            if "due_date" in updates:
                task["due_date"] = updates["due_date"]
            if "tags" in updates:
                task["tags"] = updates["tags"]
            
            task["updated_at"] = datetime.now().isoformat()
            tasks_db[i] = task
            logger.info(f"Updated task: {task['name']}")
            return task
    
    raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

@app.patch("/api/v1/tasks/{task_id}")
async def patch_task(task_id: str, updates: dict, current_user: User = Depends(get_current_user)):
    """Partially update task details (PATCH)"""
    return await update_task(task_id, updates, current_user)

@app.delete("/api/v1/tasks/{task_id}")
async def delete_task(task_id: str, current_user: User = Depends(get_current_user)):
    """Delete a task"""
    for i, task in enumerate(tasks_db):
        if task["id"] == task_id or task.get("task_id") == task_id:
            deleted_task = tasks_db.pop(i)
            logger.info(f"Deleted task: {deleted_task['name']}")
            return {"message": f"Task {deleted_task['name']} deleted successfully"}
    
    raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

# Project members endpoints
@app.get("/api/v1/projects/{project_id}/members")
async def get_project_members(project_id: str, current_user: User = Depends(get_current_user)):
    """Get project members"""
    # Check if project exists
    project_exists = any(p["id"] == project_id or p["project_id"] == project_id for p in projects_db)
    if not project_exists:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    # Return mock members for development
    members = [
        {
            "id": "member1",
            "user_id": "admin",
            "username": "admin",
            "role": "owner",
            "joined_at": datetime.now().isoformat()
        },
        {
            "id": "member2", 
            "user_id": "maker",
            "username": "maker",
            "role": "member",
            "joined_at": datetime.now().isoformat()
        }
    ]
    return members

@app.delete("/api/v1/projects/{project_id}/members/{user_id}")
async def remove_project_member(project_id: str, user_id: str, current_user: User = Depends(get_current_user)):
    """Remove a member from project"""
    # Check if project exists
    project_exists = any(p["id"] == project_id or p["project_id"] == project_id for p in projects_db)
    if not project_exists:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    logger.info(f"Removed user {user_id} from project {project_id}")
    return {"message": f"User {user_id} removed from project"}

# Project files endpoints
@app.get("/api/v1/projects/{project_id}/files")
async def get_project_files(project_id: str, current_user: User = Depends(get_current_user)):
    """Get files for a specific project"""
    # Check if project exists
    project_exists = any(p["id"] == project_id or p["project_id"] == project_id for p in projects_db)
    if not project_exists:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    # Return mock files for development
    files = [
        {
            "id": "file1",
            "name": "README.md",
            "path": f"projects/{project_id}/README.md",
            "size": 1024,
            "type": "text/markdown",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "id": "file2",
            "name": "main.py",
            "path": f"projects/{project_id}/main.py",
            "size": 2048,
            "type": "text/x-python",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    ]
    return files

# Auth registration endpoint
@app.post("/api/v1/auth/register")
async def register_user(user_data: dict):
    """Register a new user"""
    username = user_data.get("username")
    password = user_data.get("password")
    email = user_data.get("email", f"{username}@wit.local")
    
    if not username or not password:
        raise HTTPException(
            status_code=400,
            detail="Username and password are required"
        )
    
    if username in users_db:
        raise HTTPException(
            status_code=400,
            detail="Username already exists"
        )
    
    # Add user to users_db
    add_user(username, password, email, is_admin=False)
    
    # Create access token
    access_token = create_access_token(data={"sub": username})
    
    logger.info(f"Registered new user: {username}")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": username,
            "email": email,
            "is_admin": False,
            "is_active": True
        }
    }

# Google OAuth callback endpoint (simplified for dev)
@app.get("/api/v1/auth/google/callback")
async def google_oauth_callback(code: str = None, state: str = None):
    """Handle Google OAuth callback in dev mode"""
    if not code:
        raise HTTPException(status_code=400, detail="No authorization code provided")
    
    # In dev mode, we'll just create a success response
    # In production, this would exchange the code for tokens with Google
    logger.info(f"Google OAuth callback received with code: {code[:10]}...")
    
    # Redirect to frontend with success message
    frontend_url = "http://localhost:5173"  # Adjust if your frontend runs on a different port
    return RedirectResponse(
        url=f"{frontend_url}/auth/callback?status=success&provider=google",
        status_code=302
    )

# Microcontroller ports endpoint
@app.get("/api/v1/microcontrollers/ports")
async def get_microcontroller_ports(current_user: User = Depends(get_current_user)):
    """Get available serial ports"""
    try:
        import serial.tools.list_ports
        ports = []
        for port in serial.tools.list_ports.comports():
            ports.append({
                "device": port.device,
                "name": port.name,
                "description": port.description,
                "hwid": port.hwid,
                "vid": port.vid,
                "pid": port.pid,
                "serial_number": port.serial_number,
                "manufacturer": port.manufacturer,
                "product": port.product
            })
        return ports
    except ImportError:
        # If pyserial not installed, return mock data
        return [
            {
                "device": "/dev/ttyUSB0",
                "name": "ttyUSB0",
                "description": "USB Serial Port",
                "hwid": "USB VID:PID=1234:5678",
                "vid": 0x1234,
                "pid": 0x5678,
                "serial_number": "12345",
                "manufacturer": "Arduino",
                "product": "Arduino Uno"
            }
        ]

@app.on_event("startup")
async def startup_event():
    """Start background tasks"""
    asyncio.create_task(printer_status_updater())
    logger.info(f"Started with {len(prusalink_printers)} PrusaLink printers")

# ============== ROOT ENDPOINTS ==============

@app.get("/")
async def root():
    """Root endpoint with system info"""
    return {
        "message": "W.I.T. Terminal API with Real Printer Support",
        "version": "1.2.0",
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
        "features": {
            "enhanced_status": "Print progress in status text",
            "color_coding": "Automatic status color determination",
            "job_tracking": "Real-time print job information",
            "position_tracking": "X/Y/Z position for serial printers"
        },
        "printer_types": [
            "serial (USB) - Direct connection",
            "prusalink - Network Prusa printers (REAL DATA)",
            "octoprint - OctoPrint servers"
        ]
    }

# ============== MAIN ==============

if __name__ == "__main__":
    print("\n" + "="*70)
    print("🚀 W.I.T. DEVELOPMENT SERVER WITH ENHANCED STATUS")
    print("="*70)
    print(f"\n{'✅' if INTEGRATIONS_AVAILABLE else '⚠️ '} Printer Integrations: {'Available' if INTEGRATIONS_AVAILABLE else 'Not found - using simulation'}")
    print("\n✅ Authentication System Active")
    print("\n📌 Default Users:")
    print("   • admin / admin")
    print("   • maker / maker123")
    print("\n🖨️  Supported Printer Types:")
    print("   • Serial/USB - Direct connection to Prusa printers")
    print("   • PrusaLink - Network-enabled Prusa printers (XL, MK4, MINI+)")
    print("   • OctoPrint - Any printer with OctoPrint")
    print("\n✨ NEW FEATURES:")
    print("   • Print progress shown in status (Printing 45%)")
    print("   • Automatic status color coding")
    print("   • Enhanced job information")
    print("   • Position tracking for serial printers")
    print("\n📡 Real-time Updates:")
    print("   • WebSocket: ws://localhost:8000/ws/printers")
    print("   • Updates every 5 seconds")
    print("\n📚 Documentation:")
    print("   • Swagger UI: http://localhost:8000/docs")
    print("\n💡 Quick Start:")
    print("   1. Login with admin/admin")
    print("   2. Click 'Add Machine'")
    print("   3. Select 'Network (PrusaLink)' connection type")
    print("   4. Enter your printer's IP and password")
    print("   5. Test connection before adding")
    print("   6. Watch real status with progress updates!")
    print("="*70 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)