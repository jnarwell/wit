"""
Equipment Router Router
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime

router = APIRouter(
    prefix="/api/v1/equipment",
    tags=["equipment"]
)

@router.get("/")
async def get_equipment():
    """Get equipment information"""
    return {
        "status": "operational",
        "timestamp": datetime.now().isoformat(),
        "message": "Equipment API"
    }

@router.get("/status")
async def get_equipment_status():
    """Get equipment status"""
    return {
        "status": "online",
        "version": "1.0.0"
    }
