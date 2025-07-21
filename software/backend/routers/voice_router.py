"""
Voice Router Router
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime

router = APIRouter(
    prefix="/api/v1/voice",
    tags=["voice"]
)

@router.get("/")
async def get_voice():
    """Get voice information"""
    return {
        "status": "operational",
        "timestamp": datetime.now().isoformat(),
        "message": "Voice API"
    }

@router.get("/status")
async def get_voice_status():
    """Get voice status"""
    return {
        "status": "online",
        "version": "1.0.0"
    }
