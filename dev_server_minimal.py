#!/usr/bin/env python3
"""
W.I.T. Minimal Development Server - No AI Dependencies
"""
import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Mock services
class MockDB:
    async def connect(self): logger.info("Mock DB connected")
    async def disconnect(self): pass
    async def create_tables(self): pass

class MockMQTT:
    async def connect(self): logger.info("Mock MQTT connected") 
    async def disconnect(self): pass

class MockEvents:
    async def publish_system_event(self, *args, **kwargs): pass

@asynccontextmanager
async def minimal_lifespan(app: FastAPI):
    """Minimal lifespan without external dependencies"""
    logger.info("Starting W.I.T. Minimal Server...")
    
    # Set mock services
    app.state.db = MockDB()
    app.state.mqtt = MockMQTT()
    app.state.events = MockEvents()
    
    yield
    
    logger.info("Shutting down...")

# Create minimal app
app = FastAPI(
    title="W.I.T. Terminal API - Minimal",
    version="1.0.0",
    lifespan=minimal_lifespan
)

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Basic routes
@app.get("/")
async def root():
    return {
        "message": "W.I.T. Terminal API - Minimal Mode",
        "status": "operational",
        "mode": "minimal (no AI dependencies)"
    }

@app.get("/health")
async def health():
    return {"status": "healthy", "mode": "minimal"}

@app.get("/api/v1/system/status")
async def system_status():
    return {
        "status": "running",
        "version": "1.0.0",
        "services": {
            "database": "mock",
            "mqtt": "mock",
            "voice": "disabled",
            "vision": "disabled"
        }
    }

# Equipment endpoints (no AI required)
@app.get("/api/v1/equipment")
async def list_equipment():
    return {
        "equipment": [
            {"id": "printer-1", "name": "3D Printer", "status": "idle"},
            {"id": "cnc-1", "name": "CNC Machine", "status": "offline"}
        ]
    }

@app.post("/api/v1/equipment/{equipment_id}/command")
async def send_equipment_command(equipment_id: str, command: dict):
    return {
        "equipment_id": equipment_id,
        "command": command,
        "status": "accepted",
        "message": "Command queued (mock mode)"
    }

if __name__ == "__main__":
    import uvicorn
    print("\n🚀 W.I.T. Terminal API - Minimal Mode (No AI Dependencies)")
    print("=" * 60)
    print("✅ No Whisper/YOLO required")
    print("✅ No database required")
    print("✅ No MQTT required") 
    print("✅ Basic endpoints available")
    print("\n📍 API URL: http://localhost:8000")
    print("📚 API Docs: http://localhost:8000/docs")
    print("=" * 60 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
