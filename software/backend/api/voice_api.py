"""
W.I.T. Voice API

FastAPI endpoints for voice processing and control.
"""

from fastapi import APIRouter, WebSocket, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import asyncio
import numpy as np
import io
import json
import logging
import wave
from datetime import datetime
from enum import Enum
import base64

# Import voice processor (from ai/voice module)
import sys
sys.path.append('../../ai/voice')
from voice_processor import (
    VoiceProcessor, ProcessingConfig, VoiceCommand, 
    VoiceState, WorkshopVoiceAssistant
)

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/v1/voice", tags=["voice"])

# Global voice processor instance
voice_processor: Optional[VoiceProcessor] = None
workshop_assistant: Optional[WorkshopVoiceAssistant] = None


# Request/Response Models
class VoiceConfig(BaseModel):
    """Voice configuration model"""
    model_size: str = Field(default="base", description="Whisper model size")
    language: str = Field(default="en", description="Language code")
    sample_rate: int = Field(default=16000, description="Audio sample rate")
    vad_aggressiveness: int = Field(default=3, ge=0, le=3)
    energy_threshold: float = Field(default=-30.0, description="Energy threshold in dBFS")
    enable_npu: bool = Field(default=True, description="Enable NPU acceleration")


class TranscriptionRequest(BaseModel):
    """Transcription request model"""
    audio_data: str = Field(..., description="Base64 encoded audio data")
    format: str = Field(default="wav", description="Audio format")
    real_time: bool = Field(default=False, description="Real-time processing mode")


class TranscriptionResponse(BaseModel):
    """Transcription response model"""
    text: str
    confidence: float
    duration: float
    timestamp: datetime
    intent: Optional[str] = None
    entities: Optional[Dict[str, Any]] = None


class CommandRequest(BaseModel):
    """Voice command request"""
    text: str = Field(..., description="Command text")
    audio_data: Optional[str] = Field(None, description="Optional audio data")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)


class CommandResponse(BaseModel):
    """Command execution response"""
    success: bool
    command: str
    intent: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class VoiceStatus(BaseModel):
    """Voice system status"""
    state: str
    is_listening: bool
    model_loaded: bool
    statistics: Dict[str, Any]
    active_sessions: int


class WakeWordConfig(BaseModel):
    """Wake word configuration"""
    word: str
    threshold: float = Field(default=0.5, ge=0.0, le=1.0)
    enabled: bool = True


# API Endpoints

@router.on_event("startup")
async def startup_event():
    """Initialize voice processor on startup"""
    global voice_processor, workshop_assistant
    
    try:
        config = ProcessingConfig()
        voice_processor = VoiceProcessor(config)
        workshop_assistant = WorkshopVoiceAssistant(voice_processor)
        
        await voice_processor.start()
        logger.info("Voice processor initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize voice processor: {e}")
        raise


@router.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    global voice_processor
    
    if voice_processor:
        await voice_processor.stop()
        logger.info("Voice processor shut down")


@router.get("/status", response_model=VoiceStatus)
async def get_voice_status():
    """Get voice system status"""
    if not voice_processor:
        raise HTTPException(status_code=503, detail="Voice processor not initialized")
        
    stats = voice_processor.get_statistics()
    
    return VoiceStatus(
        state=stats["state"],
        is_listening=stats["state"] == "listening",
        model_loaded=True,
        statistics=stats,
        active_sessions=1  # TODO: Track actual sessions
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
            model_size=config.model_size,
            language=config.language,
            sample_rate=config.sample_rate,
            vad_aggressiveness=config.vad_aggressiveness,
            energy_threshold=config.energy_threshold,
            enable_npu=config.enable_npu
        )
        
        # Reinitialize
        voice_processor = VoiceProcessor(processing_config)
        workshop_assistant = WorkshopVoiceAssistant(voice_processor)
        await voice_processor.start()
        
        return {"status": "configured", "message": "Voice configuration updated"}
        
    except Exception as e:
        logger.error(f"Configuration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(request: TranscriptionRequest):
    """Transcribe audio data"""
    if not voice_processor:
        raise HTTPException(status_code=503, detail="Voice processor not initialized")
        
    try:
        # Decode audio data
        audio_bytes = base64.b64decode(request.audio_data)
        
        # Parse audio format
        if request.format == "wav":
            with io.BytesIO(audio_bytes) as wav_io:
                with wave.open(wav_io, 'rb') as wav_file:
                    frames = wav_file.readframes(wav_file.getnframes())
                    audio_data = np.frombuffer(frames, dtype=np.int16)
                    sample_rate = wav_file.getframerate()
        else:
            # Assume raw int16 PCM
            audio_data = np.frombuffer(audio_bytes, dtype=np.int16)
            sample_rate = 16000
            
        # Process audio
        timestamp = datetime.now().timestamp()
        
        if request.real_time:
            # Process in chunks for real-time
            chunk_size = int(sample_rate * 0.1)  # 100ms chunks
            for i in range(0, len(audio_data), chunk_size):
                chunk = audio_data[i:i + chunk_size]
                await voice_processor.process_audio_chunk(chunk, timestamp + i/sample_rate)
        else:
            # Process entire audio at once
            audio_float = audio_data.astype(np.float32) / 32768.0
            result = await voice_processor._process_recording(audio_float, timestamp)
            
            if result:
                return TranscriptionResponse(
                    text=result.text,
                    confidence=result.confidence,
                    duration=result.audio_duration,
                    timestamp=result.timestamp,
                    intent=result.intent,
                    entities=result.entities
                )
            else:
                raise HTTPException(status_code=400, detail="No speech detected")
                
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/command", response_model=CommandResponse)
async def execute_command(request: CommandRequest):
    """Execute voice command"""
    if not workshop_assistant:
        raise HTTPException(status_code=503, detail="Workshop assistant not initialized")
        
    try:
        # Create command from text
        command = VoiceCommand(
            text=request.text,
            intent="",  # Will be parsed
            entities={},
            confidence=1.0,
            timestamp=datetime.now(),
            audio_duration=0.0
        )
        
        # Parse intent
        intent, entities, confidence = await voice_processor._parse_intent(request.text)
        command.intent = intent
        command.entities = entities
        command.confidence = confidence
        
        # Add context
        if request.context:
            command.entities.update(request.context)
            
        # Execute command
        await workshop_assistant._execute_command(command)
        
        return CommandResponse(
            success=True,
            command=command.text,
            intent=command.intent,
            result={"entities": command.entities}
        )
        
    except Exception as e:
        logger.error(f"Command execution error: {e}")
        return CommandResponse(
            success=False,
            command=request.text,
            intent="error",
            error=str(e)
        )


@router.websocket("/stream")
async def voice_stream(websocket: WebSocket):
    """WebSocket endpoint for real-time voice streaming"""
    await websocket.accept()
    
    if not voice_processor:
        await websocket.close(code=1003, reason="Voice processor not initialized")
        return
        
    client_id = id(websocket)
    logger.info(f"Voice stream client connected: {client_id}")
    
    # Command queue for this client
    command_queue = asyncio.Queue()
    
    # Register callback for commands
    async def command_callback(command: VoiceCommand):
        await command_queue.put(command)
        
    voice_processor.register_command_handler("*", command_callback)
    
    try:
        # Create tasks for bidirectional communication
        async def receive_audio():
            """Receive audio from client"""
            while True:
                try:
                    data = await websocket.receive_bytes()
                    
                    # Parse message
                    if len(data) > 4:
                        # First 4 bytes are timestamp
                        timestamp = int.from_bytes(data[:4], 'little') / 1000.0
                        audio_data = np.frombuffer(data[4:], dtype=np.int16)
                        
                        # Process audio chunk
                        await voice_processor.process_audio_chunk(audio_data, timestamp)
                        
                except Exception as e:
                    logger.error(f"Error receiving audio: {e}")
                    break
                    
        async def send_results():
            """Send results to client"""
            while True:
                try:
                    # Wait for command with timeout
                    command = await asyncio.wait_for(
                        command_queue.get(), 
                        timeout=1.0
                    )
                    
                    # Send result
                    result = {
                        "type": "transcription",
                        "text": command.text,
                        "intent": command.intent,
                        "entities": command.entities,
                        "confidence": command.confidence,
                        "timestamp": command.timestamp.isoformat()
                    }
                    
                    await websocket.send_json(result)
                    
                except asyncio.TimeoutError:
                    # Send heartbeat
                    await websocket.send_json({"type": "heartbeat"})
                    
                except Exception as e:
                    logger.error(f"Error sending results: {e}")
                    break
                    
        # Run both tasks
        receive_task = asyncio.create_task(receive_audio())
        send_task = asyncio.create_task(send_results())
        
        # Wait for either task to complete
        done, pending = await asyncio.wait(
            [receive_task, send_task],
            return_when=asyncio.FIRST_COMPLETED
        )
        
        # Cancel pending tasks
        for task in pending:
            task.cancel()
            
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
        
        # Save temporarily
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=file.filename) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
            
        # Transcribe file
        result = await voice_processor.transcribe_file(tmp_path)
        
        # Clean up
        import os
        os.unlink(tmp_path)
        
        if result:
            return TranscriptionResponse(
                text=result.text,
                confidence=result.confidence,
                duration=result.audio_duration,
                timestamp=result.timestamp,
                intent=result.intent,
                entities=result.entities
            )
        else:
            raise HTTPException(status_code=400, detail="Transcription failed")
            
    except Exception as e:
        logger.error(f"File upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/wake-words", response_model=List[WakeWordConfig])
async def get_wake_words():
    """Get configured wake words"""
    # TODO: Implement wake word management
    return [
        WakeWordConfig(word="hey wit", threshold=0.5, enabled=True),
        WakeWordConfig(word="workshop", threshold=0.6, enabled=True),
        WakeWordConfig(word="computer", threshold=0.7, enabled=False)
    ]


@router.put("/wake-words/{word}", response_model=Dict[str, str])
async def update_wake_word(word: str, config: WakeWordConfig):
    """Update wake word configuration"""
    # TODO: Implement wake word update
    return {"status": "updated", "word": word}


@router.get("/commands", response_model=List[Dict[str, Any]])
async def get_available_commands():
    """Get list of available voice commands"""
    commands = [
        {
            "intent": "print",
            "description": "3D printing commands",
            "examples": ["start printing", "pause the print", "cancel print job"],
            "parameters": ["filename", "layer_height", "infill"]
        },
        {
            "intent": "design",
            "description": "CAD and design commands",
            "examples": ["create a cube", "rotate 45 degrees", "save design"],
            "parameters": ["shape", "dimensions", "operation"]
        },
        {
            "intent": "control",
            "description": "Equipment control",
            "examples": ["start the CNC", "stop all machines", "emergency stop"],
            "parameters": ["equipment", "action"]
        },
        {
            "intent": "query",
            "description": "Information queries",
            "examples": ["what's the print status", "show temperature", "list materials"],
            "parameters": ["subject", "property"]
        },
        {
            "intent": "safety",
            "description": "Safety commands",
            "examples": ["emergency stop", "alert", "safety check"],
            "parameters": ["action", "severity"]
        }
    ]
    
    return commands


@router.get("/audio/test", response_model=Dict[str, Any])
async def test_audio_system():
    """Test audio capture system"""
    # TODO: Implement audio system test
    return {
        "microphones": 8,
        "channels_active": [True] * 8,
        "sample_rate": 16000,
        "latency_ms": 25.3,
        "noise_floor_db": -45.2
    }


# Health check
@router.get("/health")
async def health_check():
    """Health check endpoint"""
    if not voice_processor:
        raise HTTPException(status_code=503, detail="Voice processor not initialized")
        
    return {
        "status": "healthy",
        "service": "voice",
        "timestamp": datetime.now().isoformat()
    }