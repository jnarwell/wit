from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from datetime import datetime
import json

app = FastAPI(title="W.I.T. Terminal API")

# Enable CORS for web development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Basic routes
@app.get("/")
def read_root():
    return {"message": "W.I.T. Terminal API", "version": "1.0.0"}

@app.get("/api/v1/system/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "voice": "ready",
            "vision": "disabled",
            "equipment": "ready",
            "database": "mock"
        }
    }

@app.get("/api/v1/voice/status")
def voice_status():
    return {
        "status": "ready",
        "engine": "whisper",
        "model": "tiny",
        "supported_commands": [
            "start printer",
            "stop printer", 
            "emergency stop",
            "status report"
        ]
    }

@app.get("/api/v1/equipment/status")
def equipment_status():
    return {
        "connected_devices": [
            {
                "id": "printer-001",
                "name": "Prusa MK3",
                "type": "3d_printer",
                "status": "idle"
            },
            {
                "id": "cnc-001",
                "name": "Shapeoko 4",
                "type": "cnc_router",
                "status": "running"
            }
        ]
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_json({
        "type": "connection",
        "message": "Connected to W.I.T. Terminal"
    })
    
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({
                "type": "echo",
                "message": f"Received: {data}",
                "timestamp": datetime.now().isoformat()
            })
    except:
        pass

@app.get("/dashboard/")
def dashboard():
    return HTMLResponse("""
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
            <h3>Web Interface</h3>
            <p>Access the new web interface at: <a href="http://localhost:3000" style="color: #60a5fa;">http://localhost:3000</a></p>
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
    
    # Remove reload=True to fix the issue
    uvicorn.run(app, host="0.0.0.0", port=8000)