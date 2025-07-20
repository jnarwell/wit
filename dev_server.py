#!/usr/bin/env python3
"""
W.I.T. Development Server - Full Version
Complete development server with all API routers
"""

import os
import sys
from datetime import datetime
from pathlib import Path
import logging

# Add project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import uvicorn

# Create FastAPI app
app = FastAPI(
    title="W.I.T. Terminal API",
    description="Workshop Integrated Terminal - Complete Development Server",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS - Allow everything for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Track loaded routers and services
routers_loaded = []
services_status = {}

# ============== IMPORT AND LOAD ROUTERS ==============

# 1. Auth Router
try:
    from software.backend.api.auth_api import router as auth_router
    app.include_router(auth_router)
    routers_loaded.append("auth")
    logger.info("✅ Loaded auth router")
except Exception as e:
    logger.error(f"❌ Could not load auth router: {e}")
    # Create mock auth endpoints if auth router fails
    class LoginRequest(BaseModel):
        username: str
        password: str

    @app.post("/api/v1/auth/token")
    async def mock_login(request: LoginRequest):
        """Mock login endpoint"""
        if request.username == "admin" and request.password == "admin":
            return {
                "access_token": "mock-dev-token-12345",
                "token_type": "bearer"
            }
        raise HTTPException(status_code=401, detail="Invalid credentials")

    @app.get("/api/v1/auth/me")
    async def mock_me():
        """Mock user info endpoint"""
        return {
            "username": "admin",
            "email": "admin@wit.local",
            "is_admin": True,
            "is_active": True
        }
    
    logger.info("✅ Created mock auth endpoints")

# 2. Equipment Router (MOST IMPORTANT)
try:
    from software.backend.api.equipment_api import router as equipment_router
    app.include_router(equipment_router)
    routers_loaded.append("equipment")
    logger.info("✅ Loaded equipment router")
except Exception as e:
    logger.error(f"❌ Could not load equipment router: {e}")
    
    # Create minimal equipment endpoints if router fails
    from pydantic import Field
    
    class PrinterTestRequest(BaseModel):
        connection_type: str
        url: Optional[str] = None
        port: Optional[str] = None
        username: Optional[str] = None
        password: Optional[str] = None
        api_key: Optional[str] = None

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
        auto_connect: bool = True

    # In-memory printer storage
    printers_storage = {}

    @app.post("/api/v1/equipment/printers/test")
    async def test_printer_connection(request: PrinterTestRequest):
        """Test printer connection"""
        if request.connection_type == "prusalink":
            if not request.username or not request.password:
                return {
                    "success": False,
                    "message": "Username and password are required for PrusaLink"
                }
            return {
                "success": True,
                "message": "Connection test successful (dev mode)"
            }
        elif request.connection_type == "octoprint":
            if not request.api_key:
                return {
                    "success": False,
                    "message": "API key is required for OctoPrint"
                }
            return {
                "success": True,
                "message": "Connection test successful (dev mode)"
            }
        return {
            "success": True,
            "message": "Connection test passed (dev mode)"
        }

    @app.post("/api/v1/equipment/printers")
    async def add_printer(request: PrinterAddRequest):
        """Add a printer"""
        printers_storage[request.printer_id] = {
            "id": request.printer_id,
            "name": request.name,
            "connection_type": request.connection_type,
            "connected": True,
            "state": {"text": "Ready"},
            "telemetry": {
                "temp-nozzle": 25.0,
                "temp-bed": 23.0
            }
        }
        return {
            "status": "success",
            "message": f"Printer {request.name} added successfully"
        }

    @app.get("/api/v1/equipment/printers")
    async def list_printers():
        """List all printers"""
        return list(printers_storage.values())

    @app.get("/api/v1/equipment/printers/{printer_id}")
    async def get_printer_status(printer_id: str):
        """Get printer status"""
        if printer_id not in printers_storage:
            raise HTTPException(status_code=404, detail="Printer not found")
        
        # Simulate some dynamic data
        printer = printers_storage[printer_id]
        import random
        printer["telemetry"]["temp-nozzle"] = round(20 + random.random() * 10, 1)
        printer["telemetry"]["temp-bed"] = round(20 + random.random() * 5, 1)
        
        return printer
    
    logger.info("✅ Created fallback equipment endpoints")
    routers_loaded.append("equipment-fallback")

# 3. Voice Router
try:
    from software.backend.api.voice_api import router as voice_router
    app.include_router(voice_router)
    routers_loaded.append("voice")
    logger.info("✅ Loaded voice router")
except Exception as e:
    logger.error(f"❌ Could not load voice router: {e}")

# 4. Vision Router
try:
    from software.backend.api.vision_api import router as vision_router
    app.include_router(vision_router)
    routers_loaded.append("vision")
    logger.info("✅ Loaded vision router")
except Exception as e:
    logger.error(f"❌ Could not load vision router: {e}")

# 5. System Router
try:
    from software.backend.api.system_api import router as system_router
    app.include_router(system_router)
    routers_loaded.append("system")
    logger.info("✅ Loaded system router")
except Exception as e:
    logger.error(f"❌ Could not load system router: {e}")

# 6. Workspace Router
try:
    from software.backend.api.workspace_api import router as workspace_router
    app.include_router(workspace_router)
    routers_loaded.append("workspace")
    logger.info("✅ Loaded workspace router")
except Exception as e:
    logger.error(f"❌ Could not load workspace router: {e}")

# 7. Network Router
try:
    from software.backend.api.network_api import router as network_router
    app.include_router(network_router)
    routers_loaded.append("network")
    logger.info("✅ Loaded network router")
except Exception as e:
    logger.error(f"❌ Could not load network router: {e}")

# ============== ROOT ENDPOINTS ==============

@app.get("/")
async def root():
    """Root endpoint with system info"""
    return {
        "message": "W.I.T. Terminal API",
        "version": "1.0.0",
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "routers_loaded": routers_loaded,
        "equipment_api": "loaded" if any("equipment" in r for r in routers_loaded) else "NOT LOADED",
        "endpoints": {
            "docs": "/docs",
            "redoc": "/redoc",
            "health": "/health",
            "debug": "/debug/info"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "api": "running",
            "routers": len(routers_loaded),
            "equipment": any("equipment" in r for r in routers_loaded)
        }
    }

@app.get("/api/v1/system/health")
async def system_health():
    """Detailed system health"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "voice": "voice" in routers_loaded,
            "vision": "vision" in routers_loaded,
            "equipment": any("equipment" in r for r in routers_loaded),
            "mqtt": False,  # Not implemented in dev
            "database": False  # Not implemented in dev
        }
    }

# ============== DEBUG ENDPOINTS ==============

@app.get("/debug/info")
async def debug_info():
    """Debug information"""
    routes = []
    for route in app.routes:
        if hasattr(route, "path") and hasattr(route, "methods"):
            routes.append({
                "path": route.path,
                "methods": list(route.methods),
                "name": route.name
            })
    
    return {
        "routers_loaded": routers_loaded,
        "total_routes": len(routes),
        "routes": sorted(routes, key=lambda x: x["path"]),
        "python_path": sys.path[:3],
        "working_directory": os.getcwd()
    }

@app.get("/debug/routes")
async def list_routes():
    """List all available routes"""
    routes = []
    for route in app.routes:
        if hasattr(route, "path"):
            routes.append({
                "path": route.path,
                "methods": list(getattr(route, "methods", ["GET"])),
                "name": getattr(route, "name", "unknown")
            })
    
    # Group by API section
    grouped = {
        "auth": [r for r in routes if "/auth" in r["path"]],
        "equipment": [r for r in routes if "/equipment" in r["path"]],
        "voice": [r for r in routes if "/voice" in r["path"]],
        "system": [r for r in routes if "/system" in r["path"]],
        "other": [r for r in routes if not any(x in r["path"] for x in ["/auth", "/equipment", "/voice", "/system"])]
    }
    
    return grouped

# ============== ERROR HANDLERS ==============

@app.exception_handler(404)
async def not_found_handler(request: Request, exc: HTTPException):
    """Custom 404 handler"""
    return JSONResponse(
        status_code=404,
        content={
            "detail": "Endpoint not found",
            "path": str(request.url.path),
            "available_docs": "/docs",
            "debug_routes": "/debug/routes"
        }
    )

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc: Exception):
    """Custom 500 handler"""
    logger.error(f"Internal error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "type": type(exc).__name__,
            "path": str(request.url.path)
        }
    )

# ============== STARTUP MESSAGE ==============

def print_startup_info():
    """Print detailed startup information"""
    print("\n" + "="*70)
    print("🚀 W.I.T. DEVELOPMENT SERVER - FULL VERSION")
    print("="*70)
    
    print(f"\n📡 Server Status:")
    print(f"   • Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   • CORS: Enabled for all origins")
    print(f"   • Auth: {'Loaded' if 'auth' in routers_loaded else 'Mock endpoints'}")
    
    print(f"\n🔌 Loaded Routers ({len(routers_loaded)}):")
    for router in routers_loaded:
        status = "✅" if "fallback" not in router else "⚠️"
        print(f"   {status} {router}")
    
    if any("equipment" in r for r in routers_loaded):
        print(f"\n🖨️  Equipment API Status: ✅ READY")
        print(f"   • Test endpoint: /api/v1/equipment/printers/test")
        print(f"   • Add printer: /api/v1/equipment/printers")
        print(f"   • List printers: /api/v1/equipment/printers")
        print(f"   • Get printer: /api/v1/equipment/printers/{{id}}")
    else:
        print(f"\n🖨️  Equipment API Status: ❌ NOT LOADED")
    
    print(f"\n📚 Documentation:")
    print(f"   • Swagger UI: http://localhost:8000/docs")
    print(f"   • ReDoc: http://localhost:8000/redoc")
    print(f"   • Debug Info: http://localhost:8000/debug/info")
    print(f"   • All Routes: http://localhost:8000/debug/routes")
    
    print(f"\n🔧 Default Credentials:")
    print(f"   • Username: admin")
    print(f"   • Password: admin")
    
    print("="*70 + "\n")

# ============== MAIN ==============

if __name__ == "__main__":
    print_startup_info()
    
    # Run the server
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )