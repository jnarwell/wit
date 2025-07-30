"""
Files API
Handles file management and WebSocket connections for file updates
"""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import logging
import json

from services.database_services import get_session
from services.auth_services import get_current_user

router = APIRouter(tags=["files"])
logger = logging.getLogger(__name__)

# WebSocket connections for real-time updates
active_connections: List[WebSocket] = []

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Send message to all connected clients"""
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

@router.get("/user")
async def get_user_files(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    """Get files for the current user"""
    # Return empty structure for now
    return {
        "name": f"{current_user['username']}'s Files",
        "type": "directory",
        "path": "/",
        "children": [
            {
                "name": "Projects",
                "type": "directory",
                "path": "/projects",
                "children": []
            },
            {
                "name": "Documents",
                "type": "directory", 
                "path": "/documents",
                "children": []
            }
        ]
    }

@router.get("/projects")
async def get_project_files(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    """Get project files for the current user"""
    # Return empty structure for now
    return {
        "name": "Shared Projects",
        "type": "directory",
        "path": "/shared",
        "children": [
            {
                "name": "Team Projects",
                "type": "directory",
                "path": "/shared/team",
                "children": []
            }
        ]
    }

@router.websocket("/ws/files")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time file updates"""
    # For now, accept any connection without auth check
    await manager.connect(websocket)
    try:
        while True:
            # Wait for messages from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Echo back for now
            await websocket.send_json({
                "type": "ack",
                "message": f"Received: {message.get('type', 'unknown')}"
            })
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)