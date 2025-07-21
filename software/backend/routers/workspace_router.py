"""
Workspace Router Router
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime

router = APIRouter(
    prefix="/api/v1/workspace",
    tags=["workspace"]
)

@router.get("/")
async def get_workspace():
    """Get workspace information"""
    return {
        "status": "operational",
        "timestamp": datetime.now().isoformat(),
        "message": "Workspace API"
    }

@router.get("/status")
async def get_workspace_status():
    """Get workspace status"""
    return {
        "status": "online",
        "version": "1.0.0"
    }
