"""
W.I.T. Voice Processing Module

High-level voice processing using Whisper and other AI models.
Handles transcription, intent recognition, and command parsing.
"""

import asyncio
import numpy as np
import torch
import whisper
import webrtcvad
import json
import logging
from typing import Optional, Dict, Any, Tuple, List, Callable
from dataclasses import dataclass
from datetime import datetime
from collections import deque
import soundfile as sf
import io
from enum import Enum
import onnxruntime as ort

# Configure logging
logger = logging.getLogger(__name__)


class VoiceState(Enum):
    """Voice processing states"""
    IDLE = "idle"
    LISTENING = "listening"
    PROCESSING = "processing"
    RESPONDING = "responding"
    ERROR = "error"


@dataclass
class VoiceCommand:
    """Parsed voice command"""
    text: str
    intent: str
    entities: Dict[str, Any]
    confidence: float
    timestamp: datetime
    audio_duration: float


@dataclass
class ProcessingConfig:
    """Voice processing configuration"""
    model_size: str = "base"  # tiny, base, small, medium, large
    device: str = "cuda" if torch.cuda.is_available() else "cpu"
    language: str = "en"
    sample_rate: int = 16000
    vad_aggressiveness: int = 3  # 0-3, higher = more aggressive
    energy_threshold: float = -30.0  # dBFS
    silence_duration: float = 1.0  # seconds
    max_recording_duration: float = 30.0  # seconds
    enable_npu: bool = True
    batch_size: int = 1


class VoiceProcessor:
    """Main voice processing class"""
    
    def __init__(self, config: ProcessingConfig):
        self.config = config
        self.state = VoiceState.IDLE
        
        # Initialize models
        logger.info(f"Loading Whisper model: {config.model_size}")
        self.whisper_model = whisper.load_model(
            config.model_size, 
            device=config.device
        )
        
        # VAD for voice activity detection
        self.vad = webrtcvad.Vad(config.vad_aggressiveness)
        
        # Audio buffer for streaming
        self.audio_buffer = deque(maxlen=int(config.sample_rate * 60))  # 1 minute
        self.recording_buffer = []
        
        # Intent recognition model (placeholder)
        self.intent_model = None
        self._load_intent_model()
        
        # Command callbacks
        self.command_callbacks: Dict[str, Callable] = {}
        
        # Statistics
        self.stats = {
            "transcriptions": 0,
            "avg_latency": 0.0,
            "total_audio_processed": 0.0,
            "errors": 0
        }
        
        # Processing queue
        self.processing_queue = asyncio.Queue()
        self.processing_task = None
        
    async def start(self):
        """Start voice processing"""
        logger.info("Starting voice processor")
        self.processing_task = asyncio.create_task(self._processing_loop())
        self.state = VoiceState.LISTENING
        
    async def stop(self):
        """Stop voice processing"""
        logger.info("Stopping voice processor")
        self.state = VoiceState.IDLE
        if self.processing_task:
            self.processing_task.cancel()
            await asyncio.gather(self.processing_task, return_exceptions=True)
            
    async def process_audio_chunk(self, audio_data: np.ndarray, 
                                  timestamp: float) -> Optional[VoiceCommand]:
        """
        Process incoming audio chunk
        
        Args:
            audio_data: Audio samples (int16)
            timestamp: Timestamp in seconds
            
        Returns:
            VoiceCommand if complete utterance detected
        """
        # Convert to float32
        audio_float = audio_data.astype(np.float32) / 32768.0
        
        # Add to buffer
        self.audio_buffer.extend(audio_float)
        
        # Check VAD
        is_speech = self._is_speech(audio_data)
        
        if is_speech:
            self.recording_buffer.extend(audio_float)
            
        elif len(self.recording_buffer) > 0:
            # End of speech detected
            if len(self.recording_buffer) > self.config.sample_rate * 0.5:
                # Process if recording is longer than 0.5 seconds
                recording = np.array(self.recording_buffer)
                self.recording_buffer = []
                
                # Queue for processing
                await self.processing_queue.put((recording, timestamp))
                
        return None
        
    async def _processing_loop(self):
        """Background processing loop"""
        while self.state != VoiceState.IDLE:
            try:
                # Get audio from queue
                audio_data, timestamp = await asyncio.wait_for(
                    self.processing_queue.get(), 
                    timeout=1.0
                )
                
                # Process audio
                command = await self._process_recording(audio_data, timestamp)
                
                if command:
                    # Execute callbacks
                    await self._execute_command(command)
                    
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Processing error: {e}")
                self.stats["errors"] += 1
                
    async def _process_recording(self, audio_data: np.ndarray, 
                                timestamp: float) -> Optional[VoiceCommand]:
        """Process complete recording"""
        start_time = asyncio.get_event_loop().time()
        
        try:
            self.state = VoiceState.PROCESSING
            
            # Transcribe with Whisper
            result = await self._transcribe_audio(audio_data)
            
            if not result or not result["text"].strip():
                return None
                
            # Parse intent and entities
            intent, entities, confidence = await self._parse_intent(result["text"])
            
            # Create command
            command = VoiceCommand(
                text=result["text"].strip(),
                intent=intent,
                entities=entities,
                confidence=confidence,
                timestamp=datetime.fromtimestamp(timestamp),
                audio_duration=len(audio_data) / self.config.sample_rate
            )
            
            # Update statistics
            latency = asyncio.get_event_loop().time() - start_time
            self.stats["transcriptions"] += 1
            self.stats["avg_latency"] = (
                (self.stats["avg_latency"] * (self.stats["transcriptions"] - 1) + latency) /
                self.stats["transcriptions"]
            )
            self.stats["total_audio_processed"] += command.audio_duration
            
            logger.info(f"Processed command: {command.text} (intent: {command.intent})")
            
            return command
            
        except Exception as e:
            logger.error(f"Error processing recording: {e}")
            self.stats["errors"] += 1
            return None
        finally:
            self.state = VoiceState.LISTENING
            
    async def _transcribe_audio(self, audio_data: np.ndarray) -> Dict[str, Any]:
        """Transcribe audio using Whisper"""
        # Run in executor to avoid blocking
        loop = asyncio.get_event_loop()
        
        def transcribe():
            # Whisper expects float32 audio
            return self.whisper_model.transcribe(
                audio_data,
                language=self.config.language,
                fp16=self.config.device == "cuda",
                verbose=False
            )
            
        return await loop.run_in_executor(None, transcribe)
        
    async def _parse_intent(self, text: str) -> Tuple[str, Dict[str, Any], float]:
        """
        Parse intent and entities from text
        
        Returns:
            (intent, entities, confidence)
        """
        # Placeholder implementation - replace with real NLU model
        text_lower = text.lower()
        
        # Simple rule-based parsing for demo
        intents = {
            "print": ["print", "3d print", "fabricate", "make"],
            "design": ["design", "create", "model", "cad"],
            "control": ["start", "stop", "pause", "resume", "cancel"],
            "query": ["what", "where", "when", "how", "status"],
            "help": ["help", "assist", "guide", "tutorial"],
            "safety": ["emergency", "stop", "alert", "warning"]
        }
        
        detected_intent = "unknown"
        confidence = 0.0
        
        for intent, keywords in intents.items():
            for keyword in keywords:
                if keyword in text_lower:
                    detected_intent = intent
                    confidence = 0.8  # Placeholder confidence
                    break
                    
        # Extract entities (simplified)
        entities = {}
        
        # Extract numbers
        import re
        numbers = re.findall(r'\d+(?:\.\d+)?', text)
        if numbers:
            entities["numbers"] = [float(n) for n in numbers]
            
        # Extract quoted strings
        quotes = re.findall(r'"([^"]*)"', text)
        if quotes:
            entities["quoted"] = quotes
            
        return detected_intent, entities, confidence
        
    async def _execute_command(self, command: VoiceCommand):
        """Execute command callbacks"""
        # Global callback
        if "*" in self.command_callbacks:
            await self._call_handler(self.command_callbacks["*"], command)
            
        # Intent-specific callback
        if command.intent in self.command_callbacks:
            await self._call_handler(self.command_callbacks[command.intent], command)
            
    async def _call_handler(self, handler: Callable, command: VoiceCommand):
        """Call command handler"""
        try:
            if asyncio.iscoroutinefunction(handler):
                await handler(command)
            else:
                await asyncio.get_event_loop().run_in_executor(
                    None, handler, command
                )
        except Exception as e:
            logger.error(f"Error in command handler: {e}")
            
    def _is_speech(self, audio_chunk: np.ndarray) -> bool:
        """Check if audio chunk contains speech"""
        # Convert to bytes for VAD
        audio_bytes = audio_chunk.astype(np.int16).tobytes()
        
        # VAD expects specific frame sizes
        frame_duration_ms = 30  # 10, 20, or 30 ms
        frame_size = int(self.config.sample_rate * frame_duration_ms / 1000)
        
        if len(audio_chunk) < frame_size:
            return False
            
        # Check first frame
        frame = audio_bytes[:frame_size * 2]  # 2 bytes per sample
        
        try:
            return self.vad.is_speech(frame, self.config.sample_rate)
        except:
            # Fallback to energy-based detection
            energy = 20 * np.log10(np.sqrt(np.mean(audio_chunk**2)) + 1e-10)
            return energy > self.config.energy_threshold
            
    def _load_intent_model(self):
        """Load intent recognition model"""
        # Placeholder - would load actual model
        # Could use ONNX model for NPU acceleration
        model_path = "models/intent_recognition.onnx"
        
        try:
            if self.config.enable_npu:
                # Configure for Hailo NPU
                providers = ['HailoExecutionProvider', 'CPUExecutionProvider']
            else:
                providers = ['CPUExecutionProvider']
                
            # self.intent_model = ort.InferenceSession(model_path, providers=providers)
            logger.info("Intent model loaded (placeholder)")
        except Exception as e:
            logger.warning(f"Could not load intent model: {e}")
            
    def register_command_handler(self, intent: str, handler: Callable):
        """Register handler for specific intent"""
        self.command_callbacks[intent] = handler
        logger.info(f"Registered handler for intent: {intent}")
        
    def get_statistics(self) -> Dict[str, Any]:
        """Get processing statistics"""
        return {
            **self.stats,
            "state": self.state.value,
            "buffer_size": len(self.audio_buffer),
            "recording_size": len(self.recording_buffer)
        }
        
    async def transcribe_file(self, file_path: str) -> Optional[VoiceCommand]:
        """Transcribe audio file"""
        try:
            # Load audio file
            audio_data, sample_rate = sf.read(file_path)
            
            # Resample if needed
            if sample_rate != self.config.sample_rate:
                import librosa
                audio_data = librosa.resample(
                    audio_data, 
                    orig_sr=sample_rate, 
                    target_sr=self.config.sample_rate
                )
                
            # Process
            return await self._process_recording(
                audio_data, 
                datetime.now().timestamp()
            )
            
        except Exception as e:
            logger.error(f"Error transcribing file: {e}")
            return None


class VoiceStreamProcessor:
    """Process continuous audio stream"""
    
    def __init__(self, processor: VoiceProcessor):
        self.processor = processor
        self.is_active = False
        self.stream_task = None
        
    async def start_stream(self, audio_source):
        """Start processing audio stream"""
        self.is_active = True
        self.stream_task = asyncio.create_task(
            self._process_stream(audio_source)
        )
        
    async def stop_stream(self):
        """Stop processing stream"""
        self.is_active = False
        if self.stream_task:
            await self.stream_task
            
    async def _process_stream(self, audio_source):
        """Process audio stream"""
        chunk_size = int(self.processor.config.sample_rate * 0.1)  # 100ms chunks
        
        while self.is_active:
            try:
                # Get audio chunk from source
                chunk = await audio_source.read(chunk_size)
                if chunk is None:
                    break
                    
                # Process chunk
                timestamp = asyncio.get_event_loop().time()
                await self.processor.process_audio_chunk(chunk, timestamp)
                
            except Exception as e:
                logger.error(f"Stream processing error: {e}")
                await asyncio.sleep(0.1)


class WorkshopVoiceAssistant:
    """High-level workshop voice assistant"""
    
    def __init__(self, voice_processor: VoiceProcessor):
        self.processor = voice_processor
        self.workshop_context = {}
        
        # Register command handlers
        self._register_handlers()
        
    def _register_handlers(self):
        """Register workshop-specific command handlers"""
        self.processor.register_command_handler("print", self._handle_print)
        self.processor.register_command_handler("design", self._handle_design)
        self.processor.register_command_handler("control", self._handle_control)
        self.processor.register_command_handler("query", self._handle_query)
        self.processor.register_command_handler("safety", self._handle_safety)
        self.processor.register_command_handler("*", self._handle_unknown)
        
    async def _handle_print(self, command: VoiceCommand):
        """Handle 3D printing commands"""
        logger.info(f"Print command: {command.text}")
        
        # Parse print parameters
        if "numbers" in command.entities:
            # Could be dimensions, layer height, etc.
            numbers = command.entities["numbers"]
            
        # Example responses
        responses = {
            "print": "Starting 3D print job",
            "pause": "Pausing print",
            "resume": "Resuming print",
            "cancel": "Cancelling print job"
        }
        
        # Would interface with actual printer here
        
    async def _handle_design(self, command: VoiceCommand):
        """Handle CAD/design commands"""
        logger.info(f"Design command: {command.text}")
        
        # Would interface with CAD software
        
    async def _handle_control(self, command: VoiceCommand):
        """Handle equipment control commands"""
        logger.info(f"Control command: {command.text}")
        
        # Parse control action
        actions = ["start", "stop", "pause", "resume", "cancel"]
        text_lower = command.text.lower()
        
        for action in actions:
            if action in text_lower:
                # Execute control action
                logger.info(f"Executing {action} command")
                break
                
    async def _handle_query(self, command: VoiceCommand):
        """Handle information queries"""
        logger.info(f"Query command: {command.text}")
        
        # Would query workshop status, documentation, etc.
        
    async def _handle_safety(self, command: VoiceCommand):
        """Handle safety-critical commands"""
        logger.warning(f"SAFETY command: {command.text}")
        
        # Immediate response for safety
        if "stop" in command.text.lower() or "emergency" in command.text.lower():
            logger.critical("EMERGENCY STOP TRIGGERED")
            # Would trigger emergency stop on all equipment
            
    async def _handle_unknown(self, command: VoiceCommand):
        """Handle unknown commands"""
        if command.intent == "unknown":
            logger.info(f"Unknown command: {command.text}")
            # Could ask for clarification or suggest commands


# Example usage
async def main():
    """Example usage"""
    config = ProcessingConfig(
        model_size="base",
        device="cuda" if torch.cuda.is_available() else "cpu",
        enable_npu=True
    )
    
    processor = VoiceProcessor(config)
    assistant = WorkshopVoiceAssistant(processor)
    
    await processor.start()
    
    # Simulate audio input
    sample_rate = 16000
    duration = 5  # seconds
    t = np.linspace(0, duration, int(sample_rate * duration))
    audio = np.sin(2 * np.pi * 440 * t) * 0.3  # 440 Hz tone
    audio = (audio * 32767).astype(np.int16)
    
    # Process in chunks
    chunk_size = int(sample_rate * 0.1)  # 100ms chunks
    for i in range(0, len(audio), chunk_size):
        chunk = audio[i:i + chunk_size]
        await processor.process_audio_chunk(chunk, i / sample_rate)
        await asyncio.sleep(0.1)
        
    await processor.stop()
    
    # Print statistics
    print(json.dumps(processor.get_statistics(), indent=2))


if __name__ == "__main__":
    asyncio.run(main())