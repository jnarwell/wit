"""
System Router Router
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime

router = APIRouter(
    prefix="/api/v1/system",
    tags=["system"]
)

@router.get("/")
async def get_system():
    """Get system information"""
    return {
        "status": "operational",
        "timestamp": datetime.now().isoformat(),
        "message": "System API"
    }

@router.get("/status")
async def get_system_status():
    """Get system status"""
    return {
        "status": "online",
        "version": "1.0.0"
    }
