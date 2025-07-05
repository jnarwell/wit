"""
W.I.T. Voice Processing Module with Claude API Integration

Simplified voice processing that uses Claude for intent recognition and command parsing.
Handles transcription (using speech_recognition) and Claude API for understanding.
"""

import asyncio
import numpy as np
import json
import logging
import os
from typing import Optional, Dict, Any, Tuple, List, Callable
from dataclasses import dataclass
from datetime import datetime
from collections import deque
from enum import Enum
import base64
import aiohttp

# Try importing speech recognition - we'll handle if not available
try:
    import speech_recognition as sr
    SPEECH_RECOGNITION_AVAILABLE = True
except ImportError:
    SPEECH_RECOGNITION_AVAILABLE = False
    sr = None

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
    claude_response: Optional[str] = None


@dataclass
class ProcessingConfig:
    """Voice processing configuration"""
    # Claude API configuration
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    claude_model: str = "claude-3-opus-20240229"  # or claude-3-sonnet-20240229 for faster/cheaper
    
    # Audio configuration
    language: str = "en"
    sample_rate: int = 16000
    energy_threshold: int = 4000  # For speech_recognition
    silence_duration: float = 1.0  # seconds
    max_recording_duration: float = 30.0  # seconds
    
    # Processing configuration
    enable_wake_word: bool = True
    wake_words: List[str] = None
    
    def __post_init__(self):
        if self.wake_words is None:
            self.wake_words = ["hey wit", "okay wit", "workshop", "computer"]


class ClaudeVoiceProcessor:
    """Voice processor using Claude API for understanding"""
    
    def __init__(self, config: ProcessingConfig):
        self.config = config
        self.state = VoiceState.IDLE
        
        # Initialize speech recognizer
        if SPEECH_RECOGNITION_AVAILABLE:
            self.recognizer = sr.Recognizer()
            self.recognizer.energy_threshold = config.energy_threshold
            self.microphone = None  # Will be initialized when needed
        else:
            self.recognizer = None
            logger.warning("speech_recognition not available - install with: pip install SpeechRecognition")
        
        # Audio buffer for streaming
        self.audio_buffer = deque(maxlen=int(config.sample_rate * 60))  # 1 minute
        self.recording_buffer = []
        
        # Command callbacks
        self.command_callbacks: Dict[str, Callable] = {}
        
        # Statistics
        self.stats = {
            "transcriptions": 0,
            "errors": 0,
            "commands_processed": 0,
            "api_calls": 0,
            "start_time": datetime.now()
        }
        
        # Claude API session
        self.session: Optional[aiohttp.ClientSession] = None
        
    async def start(self):
        """Start voice processor"""
        logger.info("Starting Claude-powered voice processor")
        self.state = VoiceState.LISTENING
        
        # Create aiohttp session
        self.session = aiohttp.ClientSession()
        
        # Initialize microphone if available
        if SPEECH_RECOGNITION_AVAILABLE:
            try:
                self.microphone = sr.Microphone()
                logger.info("Microphone initialized")
            except Exception as e:
                logger.error(f"Failed to initialize microphone: {e}")
                
    async def stop(self):
        """Stop voice processor"""
        logger.info("Stopping voice processor")
        self.state = VoiceState.IDLE
        
        if self.session:
            await self.session.close()
            
    def register_command_handler(self, intent: str, handler: Callable):
        """Register callback for specific intent"""
        self.command_callbacks[intent] = handler
        logger.info(f"Registered handler for intent: {intent}")
        
    async def process_audio_chunk(self, audio_chunk: np.ndarray, timestamp: float):
        """Process incoming audio chunk"""
        # Add to buffer
        self.audio_buffer.extend(audio_chunk.tolist())
        
        # For real-time processing, we'd implement VAD here
        # For now, we'll rely on the transcribe_audio method
        
    async def transcribe_audio(self, audio_data: bytes) -> Optional[str]:
        """Transcribe audio using speech_recognition"""
        if not SPEECH_RECOGNITION_AVAILABLE:
            logger.error("Speech recognition not available")
            return None
            
        try:
            # Convert bytes to AudioData
            audio = sr.AudioData(audio_data, self.config.sample_rate, 2)
            
            # Use Google's free speech recognition
            text = self.recognizer.recognize_google(audio)
            logger.info(f"Transcribed: {text}")
            
            self.stats["transcriptions"] += 1
            return text
            
        except sr.UnknownValueError:
            logger.info("Could not understand audio")
            return None
        except sr.RequestError as e:
            logger.error(f"Speech recognition error: {e}")
            self.stats["errors"] += 1
            return None
            
    async def understand_with_claude(self, text: str, context: Dict[str, Any] = None) -> VoiceCommand:
        """Use Claude to understand intent and extract entities"""
        if not self.config.anthropic_api_key:
            logger.error("No Anthropic API key configured")
            return self._create_error_command(text, "No API key")
            
        prompt = f"""You are an AI assistant for a workshop/makerspace. Analyze this voice command and respond with a JSON object.

Voice command: "{text}"

Context: {json.dumps(context or {}, indent=2)}

Respond with ONLY a valid JSON object in this exact format:
{{
    "intent": "one of: control_equipment, get_status, emergency_stop, project_help, unknown",
    "entities": {{
        "equipment": "name of equipment if mentioned (3d_printer, laser_cutter, cnc_mill, etc)",
        "action": "action to perform (start, stop, pause, resume, etc)",
        "parameters": {{}} // any additional parameters
    }},
    "confidence": 0.0-1.0,
    "response": "Natural language response to say back to the user",
    "needs_confirmation": true/false
}}

Examples:
- "Start the 3D printer" -> intent: control_equipment, equipment: 3d_printer, action: start
- "What's the status of the laser cutter?" -> intent: get_status, equipment: laser_cutter
- "Emergency stop everything" -> intent: emergency_stop
- "How do I level the print bed?" -> intent: project_help
"""
        
        try:
            # Call Claude API
            headers = {
                "X-API-Key": self.config.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            
            data = {
                "model": self.config.claude_model,
                "max_tokens": 1000,
                "messages": [{
                    "role": "user",
                    "content": prompt
                }]
            }
            
            async with self.session.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=data
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    claude_response = result["content"][0]["text"]
                    
                    # Parse JSON response
                    try:
                        parsed = json.loads(claude_response)
                        
                        command = VoiceCommand(
                            text=text,
                            intent=parsed.get("intent", "unknown"),
                            entities=parsed.get("entities", {}),
                            confidence=parsed.get("confidence", 0.5),
                            timestamp=datetime.now(),
                            audio_duration=0.0,  # Would be set by actual audio processing
                            claude_response=parsed.get("response", "")
                        )
                        
                        self.stats["commands_processed"] += 1
                        self.stats["api_calls"] += 1
                        
                        # Execute callbacks
                        await self._execute_command(command)
                        
                        return command
                        
                    except json.JSONDecodeError:
                        logger.error(f"Failed to parse Claude response: {claude_response}")
                        return self._create_error_command(text, "Invalid JSON response")
                        
                else:
                    error_text = await response.text()
                    logger.error(f"Claude API error {response.status}: {error_text}")
                    self.stats["errors"] += 1
                    return self._create_error_command(text, f"API error: {response.status}")
                    
        except Exception as e:
            logger.error(f"Error calling Claude API: {e}")
            self.stats["errors"] += 1
            return self._create_error_command(text, str(e))
            
    def _create_error_command(self, text: str, error: str) -> VoiceCommand:
        """Create an error command"""
        return VoiceCommand(
            text=text,
            intent="error",
            entities={"error": error},
            confidence=0.0,
            timestamp=datetime.now(),
            audio_duration=0.0
        )
        
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
            
    def get_statistics(self) -> Dict[str, Any]:
        """Get processing statistics"""
        uptime = (datetime.now() - self.stats["start_time"]).total_seconds()
        return {
            "state": self.state.value,
            "uptime_seconds": uptime,
            "transcriptions": self.stats["transcriptions"],
            "commands_processed": self.stats["commands_processed"],
            "api_calls": self.stats["api_calls"],
            "errors": self.stats["errors"],
            "error_rate": self.stats["errors"] / max(1, self.stats["transcriptions"])
        }
        
    async def listen_for_wake_word(self) -> bool:
        """Listen for wake word (simplified version)"""
        if not SPEECH_RECOGNITION_AVAILABLE or not self.microphone:
            return False
            
        try:
            with self.microphone as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
                audio = self.recognizer.listen(source, timeout=1, phrase_time_limit=2)
                
            text = self.recognizer.recognize_google(audio).lower()
            
            # Check for wake words
            for wake_word in self.config.wake_words:
                if wake_word.lower() in text:
                    logger.info(f"Wake word detected: {wake_word}")
                    return True
                    
        except sr.WaitTimeoutError:
            pass  # Normal - no speech detected
        except Exception as e:
            logger.debug(f"Wake word detection error: {e}")
            
        return False
        
    async def listen_and_process(self) -> Optional[VoiceCommand]:
        """Complete listen and process cycle"""
        if not SPEECH_RECOGNITION_AVAILABLE or not self.microphone:
            logger.error("Speech recognition not available")
            return None
            
        try:
            # Listen for command
            logger.info("Listening for command...")
            with self.microphone as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
                audio = self.recognizer.listen(
                    source, 
                    timeout=5, 
                    phrase_time_limit=self.config.max_recording_duration
                )
                
            # Convert to bytes
            audio_data = audio.get_wav_data()
            
            # Transcribe
            text = await self.transcribe_audio(audio_data)
            if not text:
                return None
                
            # Understand with Claude
            command = await self.understand_with_claude(text)
            return command
            
        except sr.WaitTimeoutError:
            logger.info("No speech detected")
            return None
        except Exception as e:
            logger.error(f"Error in listen_and_process: {e}")
            return None


class WorkshopVoiceAssistant:
    """High-level workshop assistant using voice"""
    
    def __init__(self, voice_processor: ClaudeVoiceProcessor):
        self.processor = voice_processor
        self._setup_handlers()
        
    def _setup_handlers(self):
        """Setup command handlers"""
        self.processor.register_command_handler("control_equipment", self._handle_equipment)
        self.processor.register_command_handler("get_status", self._handle_status)
        self.processor.register_command_handler("emergency_stop", self._handle_emergency)
        self.processor.register_command_handler("project_help", self._handle_help)
        
    async def _handle_equipment(self, command: VoiceCommand):
        """Handle equipment control commands"""
        equipment = command.entities.get("equipment", "unknown")
        action = command.entities.get("action", "unknown")
        
        logger.info(f"Equipment control: {equipment} - {action}")
        
        # Here you would integrate with actual equipment APIs
        # For now, just log the command
        
        if command.claude_response:
            logger.info(f"Response: {command.claude_response}")
            
    async def _handle_status(self, command: VoiceCommand):
        """Handle status requests"""
        equipment = command.entities.get("equipment", "all")
        logger.info(f"Status request for: {equipment}")
        
    async def _handle_emergency(self, command: VoiceCommand):
        """Handle emergency stop commands"""
        logger.critical("EMERGENCY STOP TRIGGERED!")
        # Would trigger actual emergency stop procedures
        
    async def _handle_help(self, command: VoiceCommand):
        """Handle help requests"""
        logger.info(f"Help request: {command.text}")
        if command.claude_response:
            logger.info(f"Help response: {command.claude_response}")


# Example usage
async def main():
    """Example usage"""
    # Configure with your API key
    config = ProcessingConfig(
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", "your-api-key-here"),
        claude_model="claude-3-5-sonnet-20241022"  # Faster and cheaper for voice commands
    )
    
    processor = ClaudeVoiceProcessor(config)
    assistant = WorkshopVoiceAssistant(processor)
    
    await processor.start()
    
    # Example: Process a voice command
    command = await processor.understand_with_claude(
        "Start the 3D printer and set the temperature to 220 degrees",
        context={"current_equipment": "ender3", "material": "PLA"}
    )
    
    if command:
        print(f"Intent: {command.intent}")
        print(f"Entities: {command.entities}")
        print(f"Response: {command.claude_response}")
    
    # Example: Listen for actual voice (if microphone available)
    if SPEECH_RECOGNITION_AVAILABLE:
        print("\nListening for voice commands...")
        voice_command = await processor.listen_and_process()
        if voice_command:
            print(f"Heard: {voice_command.text}")
            print(f"Claude says: {voice_command.claude_response}")
    
    await processor.stop()
    
    # Print statistics
    print("\nStatistics:")
    print(json.dumps(processor.get_statistics(), indent=2))


if __name__ == "__main__":
    # Make sure to set your API key:
    # export ANTHROPIC_API_KEY="your-key-here"
    asyncio.run(main())