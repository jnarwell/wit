"""Mock Voice API - No Whisper Required"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

router = APIRouter(prefix="/api/v1/voice", tags=["voice"])

class VoiceCommand(BaseModel):
    text: str
    confidence: float = 0.95
    intent: Optional[str] = None

class VoiceStatus(BaseModel):
    active: bool = False
    mode: str = "mock"
    message: str = "Voice processing in mock mode"

@router.get("/status", response_model=VoiceStatus)
async def get_voice_status():
    """Get voice system status"""
    return VoiceStatus()

@router.post("/command", response_model=VoiceCommand)
async def process_voice_command(text: str):
    """Process a voice command (mock)"""
    # Simple intent detection
    intent = None
    if "start" in text.lower():
        intent = "control"
    elif "stop" in text.lower():
        intent = "control"
    elif "status" in text.lower():
        intent = "query"
    
    return VoiceCommand(
        text=text,
        confidence=0.95,
        intent=intent
    )

@router.get("/commands")
async def list_voice_commands():
    """List available voice commands"""
    return {
        "commands": [
            {
                "text": "start the printer",
                "intent": "control",
                "description": "Start 3D printer"
            },
            {
                "text": "stop all equipment",
                "intent": "control", 
                "description": "Emergency stop"
            },
            {
                "text": "what's the status",
                "intent": "query",
                "description": "Get system status"
            }
        ]
    }
