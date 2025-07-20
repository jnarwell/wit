#!/bin/bash
# W.I.T. Quick Fix All Script

echo "🔧 W.I.T. Quick Fix Script"
echo "=========================="

# Create the minimal working dev server
echo "Creating minimal dev server with equipment endpoints..."

cat > dev_server_minimal_equipment.py << 'EOF'
#!/usr/bin/env python3
"""Minimal dev server with equipment endpoints"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
import uvicorn

app = FastAPI(title="W.I.T. Minimal Equipment API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class PrinterTestRequest(BaseModel):
    connection_type: str
    url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    api_key: Optional[str] = None

class PrinterAddRequest(BaseModel):
    printer_id: str
    name: str
    connection_type: str
    url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    api_key: Optional[str] = None

# In-memory storage
printers = {}

@app.get("/")
async def root():
    return {
        "message": "W.I.T. Equipment API",
        "routers_loaded": ["equipment"],
        "endpoints": {
            "test": "/api/v1/equipment/printers/test",
            "add": "/api/v1/equipment/printers",
            "list": "/api/v1/equipment/printers"
        }
    }

@app.post("/api/v1/equipment/printers/test")
async def test_connection(request: PrinterTestRequest):
    """Test printer connection"""
    if request.connection_type == "prusalink":
        if not request.username or not request.password:
            return {"success": False, "message": "Username and password required"}
        return {"success": True, "message": "PrusaLink test successful (simulated)"}
    
    elif request.connection_type == "octoprint":
        if not request.api_key:
            return {"success": False, "message": "API key required"}
        return {"success": True, "message": "OctoPrint test successful (simulated)"}
    
    return {"success": True, "message": "Connection test passed"}

@app.post("/api/v1/equipment/printers")
async def add_printer(request: PrinterAddRequest):
    """Add printer"""
    printers[request.printer_id] = {
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
    return {"status": "success", "message": f"Printer {request.name} added"}

@app.get("/api/v1/equipment/printers")
async def list_printers():
    """List all printers"""
    return list(printers.values())

@app.get("/api/v1/equipment/printers/{printer_id}")
async def get_printer(printer_id: str):
    """Get printer status"""
    if printer_id not in printers:
        raise HTTPException(status_code=404, detail="Printer not found")
    return printers[printer_id]

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🚀 W.I.T. Minimal Equipment Server")
    print("="*60)
    print("✅ All equipment endpoints available")
    print("📍 API Docs: http://localhost:8000/docs")
    print("="*60 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
EOF

chmod +x dev_server_minimal_equipment.py

echo "✅ Created dev_server_minimal_equipment.py"
echo ""
echo "Next steps:"
echo "1. Stop any running dev_server.py (Ctrl+C)"
echo "2. Run: python3 dev_server_minimal_equipment.py"
echo "3. Run: python3 patch_frontend.py"
echo "4. Start frontend: cd software/frontend/web && npm run dev"
echo ""
echo "This minimal server includes all the equipment endpoints needed!"