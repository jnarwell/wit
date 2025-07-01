"""
W.I.T. Network API
Manages hub discovery and network configuration
"""
from fastapi import APIRouter, HTTPException, Depends, WebSocket
from fastapi.responses import FileResponse
from typing import List, Dict, Any
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/network", tags=["network"])

# Mock hub data for development
MOCK_HUBS = [
    {
        "hub_id": "hub_001",
        "name": "Workshop 3D Printer Hub",
        "ip_address": "192.168.1.101",
        "port": 8001,
        "device_type": "3d_printer",
        "capabilities": ["print", "monitor", "control"],
        "last_seen": datetime.now().isoformat(),
        "status": "online"
    },
    {
        "hub_id": "hub_002",
        "name": "CNC Controller Hub",
        "ip_address": "192.168.1.102",
        "port": 8002,
        "device_type": "cnc",
        "capabilities": ["mill", "route", "probe"],
        "last_seen": datetime.now().isoformat(),
        "status": "online"
    }
]

@router.get("/hubs", response_model=List[Dict[str, Any]])
async def get_discovered_hubs():
    """Get list of discovered W.I.T. hubs on local network"""
    return MOCK_HUBS

@router.get("/config")
async def get_network_config():
    """Get current network configuration"""
    return {
        "mode": "hybrid",
        "local_networks": ["192.168.0.0/16", "10.0.0.0/8"],
        "allowed_services": ["octoprint.org", "api.openai.com"],
        "hub_discovery_enabled": True
    }

@router.post("/hubs/{hub_id}/command")
async def send_hub_command(hub_id: str, command: Dict[str, Any]):
    """Send command to specific hub"""
    hub = next((h for h in MOCK_HUBS if h["hub_id"] == hub_id), None)
    if not hub:
        raise HTTPException(status_code=404, detail="Hub not found")
    
    # In real implementation, would send to actual hub
    return {
        "hub_id": hub_id,
        "command": command,
        "status": "sent",
        "response": {"status": "ok"}
    }

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for real-time updates"""
    await websocket.accept()
    try:
        while True:
            # Send periodic updates
            await asyncio.sleep(5)
            await websocket.send_json({
                "type": "hub_update",
                "hubs": MOCK_HUBS
            })
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await websocket.close()
