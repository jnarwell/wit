#!/usr/bin/env python3
"""
W.I.T. Minimal Backend Server
Quick standalone server for development
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import asyncio
import json

# Create FastAPI app
app = FastAPI(
    title="W.I.T. Terminal API",
    description="Workshop Integrated Terminal - Development Server",
    version="1.0.0"
)

# Configure CORS properly - including port 3001
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:3001", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class Equipment(BaseModel):
    id: str
    name: str
    type: str
    status: str  # 'online', 'offline', 'busy'
    current_job: Optional[str] = None

class VoiceCommand(BaseModel):
    text: str
    timestamp: datetime = None

class SystemHealth(BaseModel):
    status: str
    timestamp: datetime
    services: Dict[str, Any]

# Mock data
mock_equipment = [
    Equipment(id="1", name="Prusa MK3S", type="3D Printer", status="online"),
    Equipment(id="2", name="CNC Router", type="CNC Machine", status="offline"),
    Equipment(id="3", name="Laser Cutter", type="Laser", status="online", current_job="Acrylic Panel Cut"),
    Equipment(id="4", name="Resin Printer", type="3D Printer", status="online"),
]

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "W.I.T. Terminal API",
        "status": "running",
        "docs": "/docs",
        "health": "/health"
    }

# Health check endpoint - This is what the frontend is looking for
@app.get("/health")
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

# System health endpoint with more details
@app.get("/api/v1/system/health")
async def get_system_health():
    """Get detailed system health"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "voice": True,
            "vision": True,
            "equipment": len([e for e in mock_equipment if e.status != "offline"]),
            "mqtt": False,
            "database": False
        }
    }

# Equipment endpoints
@app.get("/api/v1/equipment", response_model=List[Equipment])
async def get_equipment():
    """Get all equipment status"""
    return mock_equipment

@app.get("/api/v1/equipment/{equipment_id}")
async def get_equipment_by_id(equipment_id: str):
    """Get specific equipment details"""
    for eq in mock_equipment:
        if eq.id == equipment_id:
            return eq
    raise HTTPException(status_code=404, detail="Equipment not found")

@app.post("/api/v1/equipment/{equipment_id}/control")
async def control_equipment(equipment_id: str, action: str):
    """Control equipment (start/stop/pause)"""
    for eq in mock_equipment:
        if eq.id == equipment_id:
            if action == "start":
                eq.status = "busy"
            elif action == "stop":
                eq.status = "online"
                eq.current_job = None
            return {"message": f"Equipment {eq.name} {action} successful"}
    raise HTTPException(status_code=404, detail="Equipment not found")

# Voice control endpoints
@app.post("/api/v1/voice/start")
async def start_voice_control():
    """Start voice control session"""
    return {"status": "listening", "session_id": "mock_session_123"}

@app.post("/api/v1/voice/stop")
async def stop_voice_control():
    """Stop voice control session"""
    return {"status": "stopped"}

@app.post("/api/v1/voice/command")
async def process_voice_command(command: VoiceCommand):
    """Process a voice command"""
    if command.timestamp is None:
        command.timestamp = datetime.now()
    
    text_lower = command.text.lower()
    
    if "start" in text_lower:
        return {
            "intent": "control",
            "action": "start",
            "confidence": 0.95,
            "response": "Starting equipment"
        }
    elif "stop" in text_lower:
        return {
            "intent": "control", 
            "action": "stop",
            "confidence": 0.95,
            "response": "Stopping equipment"
        }
    elif "status" in text_lower:
        return {
            "intent": "query",
            "action": "status",
            "confidence": 0.90,
            "response": f"{len([e for e in mock_equipment if e.status == 'online'])} devices online"
        }
    else:
        return {
            "intent": "unknown",
            "confidence": 0.0,
            "response": "Command not recognized"
        }

# Emergency stop
@app.post("/api/v1/emergency/stop")
async def emergency_stop():
    """Emergency stop all equipment"""
    for eq in mock_equipment:
        if eq.status == "busy":
            eq.status = "online"
            eq.current_job = None
    return {"message": "Emergency stop activated - all equipment halted"}

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for real-time updates"""
    await websocket.accept()
    try:
        while True:
            await websocket.send_json({
                "type": "status_update",
                "timestamp": datetime.now().isoformat(),
                "equipment_count": len(mock_equipment),
                "active_jobs": len([e for e in mock_equipment if e.current_job])
            })
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        print("WebSocket disconnected")

# Simple dashboard
@app.get("/dashboard/", response_class=HTMLResponse)
async def dashboard():
    return HTMLResponse(content="""
    <!DOCTYPE html>
    <html>
    <head>
        <title>W.I.T. Simple Dashboard</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                margin: 40px;
                background: #1a1a1a;
                color: #fff;
            }
            .status { 
                padding: 20px; 
                background: #2a2a2a; 
                border-radius: 8px;
                margin: 10px 0;
            }
            .online { color: #4ade80; }
            .offline { color: #f87171; }
        </style>
    </head>
    <body>
        <h1>W.I.T. Terminal Dashboard</h1>
        <div class="status">
            <h3>System Status: <span class="online">ONLINE</span></h3>
            <p>Backend is running successfully!</p>
        </div>
        <div class="status">
            <h3>API Endpoints</h3>
            <ul>
                <li>Health: <a href="/health" style="color: #60a5fa;">/health</a></li>
                <li>API Docs: <a href="/docs" style="color: #60a5fa;">/docs</a></li>
                <li>Equipment: <a href="/api/v1/equipment" style="color: #60a5fa;">/api/v1/equipment</a></li>
            </ul>
        </div>
        <div class="status">
            <h3>Web Interface</h3>
            <p>Access the React interface at: <a href="http://localhost:3000" style="color: #60a5fa;">http://localhost:3000</a></p>
        </div>
    </body>
    </html>
    """)

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting W.I.T. Minimal Backend")
    print("📡 API: http://localhost:8000")
    print("📚 Docs: http://localhost:8000/docs")
    print("🎨 Dashboard: http://localhost:8000/dashboard/")
    print("🔧 Health: http://localhost:8000/health")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)