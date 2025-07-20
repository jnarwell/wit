#!/usr/bin/env python3
"""
Simple PrusaLink backend for testing
Save as: simple_prusalink_backend.py
Run: python3 simple_prusalink_backend.py
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import requests
from requests.auth import HTTPDigestAuth
from typing import Dict, Any
import asyncio
from datetime import datetime

# Create FastAPI app
app = FastAPI()

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage for printers
printers = {}

# Background update task
update_task = None


async def update_printer_status(printer_id: str):
    """Fetch real data from PrusaLink"""
    if printer_id not in printers:
        return
        
    printer = printers[printer_id]
    
    try:
        url = printer["url"].replace("http://", "").replace("https://", "").strip("/")
        auth = HTTPDigestAuth(printer["username"], printer["password"])
        
        # Fetch printer status
        response = requests.get(
            f"http://{url}/api/printer",
            auth=auth,
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            telemetry = data.get("telemetry", {})
            
            # Update with real data
            printer["connected"] = True
            printer["state"] = data.get("state", {})
            printer["telemetry"] = {
                "temp-nozzle": telemetry.get("temp-nozzle", 0),
                "temp-bed": telemetry.get("temp-bed", 0),
                "temp-nozzle-target": telemetry.get("target-nozzle", 0),
                "temp-bed-target": telemetry.get("target-bed", 0)
            }
            print(f"✅ Updated {printer_id}: Nozzle={telemetry.get('temp-nozzle')}°C, Bed={telemetry.get('temp-bed')}°C")
        else:
            printer["connected"] = False
            print(f"❌ Failed to update {printer_id}: {response.status_code}")
            
    except Exception as e:
        printer["connected"] = False
        print(f"❌ Error updating {printer_id}: {e}")


async def update_loop():
    """Background task to update all printers"""
    while True:
        for printer_id in list(printers.keys()):
            await update_printer_status(printer_id)
        await asyncio.sleep(2)


@app.post("/api/v1/equipment/printers")
async def add_printer(request: dict):
    """Add a printer"""
    printer_id = request["printer_id"]
    
    # Store printer
    printers[printer_id] = {
        "id": printer_id,
        "name": request["name"],
        "connection_type": request["connection_type"],
        "url": request["url"],
        "username": request.get("username", "maker"),
        "password": request["password"],
        "connected": False,
        "state": {"text": "Connecting..."},
        "telemetry": {}
    }
    
    # Get initial status
    await update_printer_status(printer_id)
    
    # Start update loop if not running
    global update_task
    if update_task is None:
        update_task = asyncio.create_task(update_loop())
    
    print(f"✅ Added printer: {printer_id}")
    return {"status": "success", "message": f"Added {request['name']}"}


@app.get("/api/v1/equipment/printers")
async def list_printers():
    """List all printers"""
    return list(printers.values())


@app.get("/api/v1/equipment/printers/{printer_id}")
async def get_printer(printer_id: str):
    """Get specific printer"""
    if printer_id not in printers:
        raise HTTPException(status_code=404, detail="Printer not found")
    
    # Update before returning
    await update_printer_status(printer_id)
    return printers[printer_id]


@app.delete("/api/v1/equipment/printers/{printer_id}")
async def delete_printer(printer_id: str):
    """Delete a printer"""
    if printer_id in printers:
        del printers[printer_id]
        print(f"🗑️ Deleted printer: {printer_id}")
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Printer not found")


@app.post("/api/v1/equipment/printers/test")
async def test_connection(request: dict):
    """Test printer connection"""
    if request["connection_type"] == "prusalink":
        try:
            url = request["url"].replace("http://", "").replace("https://", "").strip("/")
            auth = HTTPDigestAuth(request["username"], request["password"])
            
            response = requests.get(f"http://{url}/api/printer", auth=auth, timeout=5)
            
            if response.status_code == 200:
                return {"success": True, "message": "PrusaLink connection successful!"}
            elif response.status_code == 401:
                return {"success": False, "message": "Authentication failed"}
            else:
                return {"success": False, "message": f"HTTP {response.status_code}"}
                
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    return {"success": False, "message": "Only PrusaLink supported in test server"}


# Dummy auth endpoint
@app.get("/api/v1/auth/me")
async def get_me():
    return {"username": "test", "id": 1}


# Root endpoint
@app.get("/")
async def root():
    return {"message": "PrusaLink Test Server Running"}


if __name__ == "__main__":
    print("\n" + "="*60)
    print("🚀 Minimal PrusaLink Test Server")
    print("="*60)
    print("This server ONLY handles PrusaLink printers")
    print("It will fetch REAL data from your printer")
    print("="*60)
    print("\nStarting server on http://localhost:8000")
    print("Press Ctrl+C to stop\n")
    
    # Run without reload
    uvicorn.run(app, host="0.0.0.0", port=8000)