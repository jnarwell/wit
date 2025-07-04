"""
W.I.T. Voice API with Claude Integration

FastAPI endpoints for voice processing using Claude API.
"""

from fastapi import APIRouter, WebSocket, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import asyncio
import numpy as np
import io
import json
import logging
import wave
from datetime import datetime
import base64
import os

# Import our Claude-based voice processor
try:
    from software.ai.voice.claude_voice_processor import (
        ClaudeVoiceProcessor, ProcessingConfig, VoiceCommand, 
        VoiceState, WorkshopVoiceAssistant
    )
    VOICE_AVAILABLE = True
except ImportError:
    # Try relative import
    try:
        from claude_voice_processor import (
            ClaudeVoiceProcessor, ProcessingConfig, VoiceCommand,
            VoiceState, WorkshopVoiceAssistant
        )
        VOICE_AVAILABLE = True
    except ImportError:
        VOICE_AVAILABLE = False
        print("Warning: Voice processor not available")
        # Create dummy classes
        class ClaudeVoiceProcessor: pass
        class ProcessingConfig: pass
        class VoiceCommand: pass
        class VoiceState: pass
        class WorkshopVoiceAssistant: pass

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/v1/voice", tags=["voice"])

# Global voice processor instance
voice_processor: Optional[ClaudeVoiceProcessor] = None
workshop_assistant: Optional[WorkshopVoiceAssistant] = None


# Request/Response Models
class VoiceConfig(BaseModel):
    """Voice configuration model"""
    anthropic_api_key: Optional[str] = Field(None, description="Anthropic API key")
    claude_model: str = Field(default="claude-3-sonnet-20240229", description="Claude model to use")
    language: str = Field(default="en", description="Language code")
    sample_rate: int = Field(default=16000, description="Audio sample rate")
    energy_threshold: int = Field(default=4000, description="Energy threshold for voice detection")
    enable_wake_word: bool = Field(default=True, description="Enable wake word detection")


class TranscriptionRequest(BaseModel):
    """Transcription request model"""
    audio_data: str = Field(..., description="Base64 encoded audio data")
    format: str = Field(default="wav", description="Audio format")
    include_intent: bool = Field(default=True, description="Include intent analysis")


class TranscriptionResponse(BaseModel):
    """Transcription response model"""
    text: str
    intent: Optional[str] = None
    entities: Optional[Dict[str, Any]] = None
    confidence: float
    timestamp: datetime
    claude_response: Optional[str] = None


class CommandRequest(BaseModel):
    """Voice command request"""
    text: str = Field(..., description="Command text")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)


class CommandResponse(BaseModel):
    """Command execution response"""
    success: bool
    command: str
    intent: str
    entities: Dict[str, Any]
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    response: Optional[str] = None


class VoiceStatus(BaseModel):
    """Voice system status"""
    state: str
    is_listening: bool
    api_key_configured: bool
    statistics: Dict[str, Any]


# Initialize on startup
@router.on_event("startup")
async def startup_event():
    """Initialize voice processor on startup"""
    global voice_processor, workshop_assistant
    
    try:
        # Get API key from environment or config
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        
        config = ProcessingConfig(
            anthropic_api_key=api_key,
            claude_model="claude-3-sonnet-20240229"  # Faster for voice
        )
        
        voice_processor = ClaudeVoiceProcessor(config)
        workshop_assistant = WorkshopVoiceAssistant(voice_processor)
        
        await voice_processor.start()
        logger.info("Claude voice processor initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize voice processor: {e}")
        # Don't raise - let the API work even without voice


@router.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    global voice_processor
    
    if voice_processor:
        await voice_processor.stop()
        logger.info("Voice processor shut down")


# API Endpoints
@router.get("/status", response_model=VoiceStatus)
async def get_voice_status():
    """Get voice system status"""
    if not voice_processor:
        return VoiceStatus(
            state="not_initialized",
            is_listening=False,
            api_key_configured=False,
            statistics={}
        )
        
    stats = voice_processor.get_statistics()
    
    return VoiceStatus(
        state=stats["state"],
        is_listening=stats["state"] == "listening",
        api_key_configured=bool(voice_processor.config.anthropic_api_key),
        statistics=stats
    )


@router.post("/configure", response_model=Dict[str, str])
async def configure_voice(config: VoiceConfig):
    """Update voice configuration"""
    global voice_processor, workshop_assistant
    
    try:
        # Stop current processor
        if voice_processor:
            await voice_processor.stop()
            
        # Create new configuration
        processing_config = ProcessingConfig(
            anthropic_api_key=config.anthropic_api_key or os.getenv("ANTHROPIC_API_KEY", ""),
            claude_model=config.claude_model,
            language=config.language,
            sample_rate=config.sample_rate,
            energy_threshold=config.energy_threshold,
            enable_wake_word=config.enable_wake_word
        )
        
        # Reinitialize
        voice_processor = ClaudeVoiceProcessor(processing_config)
        workshop_assistant = WorkshopVoiceAssistant(voice_processor)
        await voice_processor.start()
        
        return {"status": "configured", "message": "Voice configuration updated"}
        
    except Exception as e:
        logger.error(f"Configuration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(request: TranscriptionRequest):
    """Transcribe audio and optionally analyze intent"""
    if not voice_processor:
        raise HTTPException(status_code=503, detail="Voice processor not initialized")
        
    try:
        # Decode audio data
        audio_bytes = base64.b64decode(request.audio_data)
        
        # Transcribe
        text = await voice_processor.transcribe_audio(audio_bytes)
        if not text:
            raise HTTPException(status_code=400, detail="No speech detected")
            
        # Analyze intent if requested
        if request.include_intent:
            command = await voice_processor.understand_with_claude(text)
            
            return TranscriptionResponse(
                text=text,
                intent=command.intent,
                entities=command.entities,
                confidence=command.confidence,
                timestamp=command.timestamp,
                claude_response=command.claude_response
            )
        else:
            return TranscriptionResponse(
                text=text,
                confidence=1.0,
                timestamp=datetime.now()
            )
            
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/command", response_model=CommandResponse)
async def execute_command(request: CommandRequest):
    """Execute voice command"""
    if not voice_processor:
        raise HTTPException(status_code=503, detail="Voice processor not initialized")
        
    try:
        # Understand command with Claude
        command = await voice_processor.understand_with_claude(
            request.text,
            request.context
        )
        
        return CommandResponse(
            success=True,
            command=command.text,
            intent=command.intent,
            entities=command.entities,
            response=command.claude_response,
            result={"confidence": command.confidence}
        )
        
    except Exception as e:
        logger.error(f"Command execution error: {e}")
        return CommandResponse(
            success=False,
            command=request.text,
            intent="error",
            entities={},
            error=str(e)
        )


@router.websocket("/stream")
async def voice_stream(websocket: WebSocket):
    """WebSocket endpoint for real-time voice streaming"""
    await websocket.accept()
    
    if not voice_processor:
        await websocket.send_json({
            "type": "error",
            "message": "Voice processor not initialized"
        })
        await websocket.close()
        return
        
    client_id = id(websocket)
    logger.info(f"Voice stream client connected: {client_id}")
    
    try:
        while True:
            # Receive audio data
            data = await websocket.receive_json()
            
            if data.get("type") == "audio":
                # Process audio chunk
                audio_bytes = base64.b64decode(data["audio"])
                audio_array = np.frombuffer(audio_bytes, dtype=np.int16)
                
                await voice_processor.process_audio_chunk(
                    audio_array,
                    data.get("timestamp", 0)
                )
                
            elif data.get("type") == "command":
                # Process text command
                command = await voice_processor.understand_with_claude(
                    data["text"],
                    data.get("context", {})
                )
                
                await websocket.send_json({
                    "type": "command_result",
                    "intent": command.intent,
                    "entities": command.entities,
                    "response": command.claude_response,
                    "confidence": command.confidence
                })
                
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        
    finally:
        logger.info(f"Voice stream client disconnected: {client_id}")
        await websocket.close()


@router.post("/upload", response_model=TranscriptionResponse)
async def upload_audio_file(file: UploadFile = File(...)):
    """Upload and transcribe audio file"""
    if not voice_processor:
        raise HTTPException(status_code=503, detail="Voice processor not initialized")
        
    try:
        # Read file
        contents = await file.read()
        
        # Transcribe
        text = await voice_processor.transcribe_audio(contents)
        if not text:
            raise HTTPException(status_code=400, detail="No speech detected")
            
        # Analyze with Claude
        command = await voice_processor.understand_with_claude(text)
        
        return TranscriptionResponse(
            text=text,
            intent=command.intent,
            entities=command.entities,
            confidence=command.confidence,
            timestamp=command.timestamp,
            claude_response=command.claude_response
        )
        
    except Exception as e:
        logger.error(f"File upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/test")
async def test_voice_system():
    """Test the voice system with a sample command"""
    if not voice_processor:
        raise HTTPException(status_code=503, detail="Voice processor not initialized")
        
    # Test command
    test_command = "Start the 3D printer and set temperature to 220 degrees"
    
    try:
        command = await voice_processor.understand_with_claude(
            test_command,
            {"test": True, "equipment_available": ["3d_printer", "laser_cutter", "cnc_mill"]}
        )
        
        return {
            "test_command": test_command,
            "intent": command.intent,
            "entities": command.entities,
            "confidence": command.confidence,
            "claude_response": command.claude_response,
            "api_working": True
        }
        
    except Exception as e:
        return {
            "test_command": test_command,
            "error": str(e),
            "api_working": False
        }


# Health check
@router.get("/health")
async def health_check():
    """Voice system health check"""
    return {
        "status": "healthy" if voice_processor else "degraded",
        "voice_available": VOICE_AVAILABLE,
        "processor_initialized": voice_processor is not None,
        "api_key_configured": bool(os.getenv("ANTHROPIC_API_KEY")) if voice_processor else False
    }