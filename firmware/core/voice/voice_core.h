#!/usr/bin/env python3
"""
W.I.T. Voice Processing Core
Real-time voice processing pipeline for the W.I.T. Terminal
"""

import asyncio
import json
import time
from dataclasses import dataclass, asdict
from typing import Optional, List, Callable, Dict, Any
from enum import Enum
import numpy as np
from collections import deque
import logging

# Audio processing
import pyaudio
import webrtcvad
import speech_recognition as sr

# For production, these would use local models
# import whisper  # For transcription
# import pvporcupine  # For wake word detection

# Message queue
import asyncio_mqtt as aiomqtt


class CommandType(Enum):
    """Types of commands the system can handle"""
    EQUIPMENT_CONTROL = "equipment_control"
    STATUS_QUERY = "status_query"
    SYSTEM_CONTROL = "system_control"
    SAFETY = "safety"
    UNKNOWN = "unknown"


@dataclass
class VoiceCommand:
    """Represents a processed voice command"""
    text: str
    confidence: float
    command_type: CommandType
    timestamp: float
    latency_ms: float
    parameters: Dict[str, Any]


@dataclass
class AudioMetrics:
    """Real-time audio metrics"""
    noise_level_db: float
    signal_quality: float
    is_speech: bool
    vad_confidence: float


class WITVoiceProcessor:
    """
    Core voice processing engine for W.I.T. Terminal
    Handles wake word detection, speech recognition, and command routing
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger("WIT.Voice")
        
        # Audio configuration
        self.sample_rate = config.get("sample_rate", 16000)
        self.chunk_size = config.get("chunk_size", 480)  # 30ms at 16kHz
        self.channels = config.get("channels", 1)
        
        # Wake word configuration
        self.wake_word = config.get("wake_word", "wit")
        self.wake_sensitivity = config.get("wake_sensitivity", 0.5)
        
        # Processing state
        self.is_running = False
        self.is_listening = False
        self.wake_word_detected = False
        self.command_timeout = config.get("command_timeout", 5.0)
        
        # Audio components
        self.audio = pyaudio.PyAudio()
        self.stream = None
        self.vad = webrtcvad.Vad(2)  # Aggressiveness level 0-3
        self.recognizer = sr.Recognizer()
        
        # Buffers
        self.audio_buffer = deque(maxlen=int(self.sample_rate * 10))  # 10 second buffer
        self.command_buffer = []
        
        # Metrics
        self.metrics = AudioMetrics(0, 0, False, 0)
        self.total_commands = 0
        self.avg_latency = 0
        
        # Command handlers
        self.command_handlers: Dict[CommandType, List[Callable]] = {
            cmd_type: [] for cmd_type in CommandType
        }
        
        # MQTT client for system communication
        self.mqtt_client = None
        
    async def initialize(self):
        """Initialize the voice processing system"""
        self.logger.info("Initializing W.I.T. Voice Processor")
        
        try:
            # Initialize audio stream
            self.stream = self.audio.open(
                format=pyaudio.paInt16,
                channels=self.channels,
                rate=self.sample_rate,
                input=True,
                frames_per_buffer=self.chunk_size,
                stream_callback=self._audio_callback
            )
            
            # Initialize MQTT connection
            await self._connect_mqtt()
            
            # Load wake word model (in production)
            # self.wake_word_engine = pvporcupine.create(keywords=[self.wake_word])
            
            # Load speech recognition model (in production)
            # self.whisper_model = whisper.load_model("base")
            
            self.is_running = True
            self.logger.info("Voice processor initialized successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to initialize voice processor: {e}")
            raise
    
    def _audio_callback(self, in_data, frame_count, time_info, status):
        """Callback for audio stream processing"""
        if status:
            self.logger.warning(f"Audio stream status: {status}")
        
        # Convert byte data to numpy array
        audio_data = np.frombuffer(in_data, dtype=np.int16)
        
        # Add to buffer for processing
        self.audio_buffer.extend(audio_data)
        
        # Update metrics
        self._update_metrics(audio_data)
        
        return (in_data, pyaudio.paContinue)
    
    def _update_metrics(self, audio_data: np.ndarray):
        """Update real-time audio metrics"""
        # Calculate RMS for noise level
        rms = np.sqrt(np.mean(audio_data**2))
        self.metrics.noise_level_db = 20 * np.log10(rms + 1e-10)
        
        # Check for speech using VAD
        try:
            is_speech = self.vad.is_speech(
                audio_data.tobytes(), 
                self.sample_rate
            )
            self.metrics.is_speech = is_speech
            self.metrics.vad_confidence = 1.0 if is_speech else 0.0
        except:
            pass
        
        # Signal quality (simplified)
        self.metrics.signal_quality = min(1.0, rms / 10000)
    
    async def start(self):
        """Start the voice processing system"""
        if not self.is_running:
            await self.initialize()
        
        self.logger.info("Starting voice processing")
        self.stream.start_stream()
        
        # Start processing tasks
        tasks = [
            asyncio.create_task(self._wake_word_detection_loop()),
            asyncio.create_task(self._command_processing_loop()),
            asyncio.create_task(self._metrics_broadcast_loop()),
        ]
        
        try:
            await asyncio.gather(*tasks)
        except Exception as e:
            self.logger.error(f"Error in voice processing: {e}")
            await self.stop()
    
    async def stop(self):
        """Stop the voice processing system"""
        self.logger.info("Stopping voice processor")
        self.is_running = False
        
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
        
        if self.mqtt_client:
            await self.mqtt_client.disconnect()
        
        self.audio.terminate()
    
    async def _wake_word_detection_loop(self):
        """Continuously monitor for wake word"""
        while self.is_running:
            if not self.is_listening and len(self.audio_buffer) >= self.chunk_size:
                # Get audio chunk
                audio_chunk = np.array(list(self.audio_buffer)[-self.chunk_size:])
                
                # Detect wake word (simulated for demo)
                if self._detect_wake_word(audio_chunk):
                    self.wake_word_detected = True
                    self.is_listening = True
                    self.logger.info("Wake word detected!")
                    
                    # Notify system
                    await self._publish_event("wake_word_detected", {
                        "timestamp": time.time(),
                        "confidence": 0.95
                    })
                    
                    # Start listening timeout
                    asyncio.create_task(self._listening_timeout())
            
            await asyncio.sleep(0.1)  # Check every 100ms
    
    def _detect_wake_word(self, audio_chunk: np.ndarray) -> bool:
        """
        Detect wake word in audio chunk
        In production, this would use Porcupine or similar
        """
        # Simulated detection based on audio energy
        energy = np.sum(audio_chunk**2) / len(audio_chunk)
        return energy > 1000000 and np.random.random() < 0.1  # 10% chance for demo
    
    async def _listening_timeout(self):
        """Handle listening timeout"""
        await asyncio.sleep(self.command_timeout)
        if self.is_listening:
            self.is_listening = False
            self.logger.info("Listening timeout - returning to wake word detection")
            await self._publish_event("listening_timeout", {})
    
    async def _command_processing_loop(self):
        """Process voice commands when listening"""
        while self.is_running:
            if self.is_listening and len(self.audio_buffer) >= self.sample_rate * 2:
                # Get last 2 seconds of audio
                audio_data = np.array(list(self.audio_buffer)[-(self.sample_rate * 2):])
                
                # Process command
                command = await self._process_voice_command(audio_data)
                
                if command:
                    self.total_commands += 1
                    self.avg_latency = (
                        (self.avg_latency * (self.total_commands - 1) + command.latency_ms) 
                        / self.total_commands
                    )
                    
                    # Route command
                    await self._route_command(command)
                    
                    # Reset listening state
                    self.is_listening = False
            
            await asyncio.sleep(0.1)
    
    async def _process_voice_command(self, audio_data: np.ndarray) -> Optional[VoiceCommand]:
        """
        Process audio data into a voice command
        In production, this would use Whisper or similar
        """
        start_time = time.time()
        
        try:
            # Simulate speech recognition
            # In production: text = self.whisper_model.transcribe(audio_data)
            
            # Demo command simulation
            commands = [
                ("start printer", CommandType.EQUIPMENT_CONTROL, {"device": "printer", "action": "start"}),
                ("emergency stop", CommandType.SAFETY, {"action": "emergency_stop"}),
                ("check temperature", CommandType.STATUS_QUERY, {"query": "temperature"}),
                ("pause job", CommandType.EQUIPMENT_CONTROL, {"device": "printer", "action": "pause"}),
            ]
            
            text, cmd_type, params = commands[np.random.randint(0, len(commands))]
            confidence = np.random.uniform(0.8, 0.99)
            
            latency_ms = (time.time() - start_time) * 1000
            
            command = VoiceCommand(
                text=text,
                confidence=confidence,
                command_type=cmd_type,
                timestamp=time.time(),
                latency_ms=latency_ms,
                parameters=params
            )
            
            self.logger.info(f"Recognized command: {text} (confidence: {confidence:.2f})")
            return command
            
        except Exception as e:
            self.logger.error(f"Error processing voice command: {e}")
            return None
    
    async def _route_command(self, command: VoiceCommand):
        """Route command to appropriate handlers"""
        # Publish to MQTT
        await self._publish_event("command_recognized", asdict(command))
        
        # Call registered handlers
        handlers = self.command_handlers.get(command.command_type, [])
        for handler in handlers:
            try:
                await handler(command)
            except Exception as e:
                self.logger.error(f"Error in command handler: {e}")
    
    def register_command_handler(self, command_type: CommandType, handler: Callable):
        """Register a handler for specific command types"""
        self.command_handlers[command_type].append(handler)
    
    async def _metrics_broadcast_loop(self):
        """Broadcast metrics periodically"""
        while self.is_running:
            metrics_data = {
                "noise_level_db": self.metrics.noise_level_db,
                "signal_quality": self.metrics.signal_quality,
                "is_speech": self.metrics.is_speech,
                "vad_confidence": self.metrics.vad_confidence,
                "total_commands": self.total_commands,
                "avg_latency_ms": self.avg_latency,
                "is_listening": self.is_listening,
                "timestamp": time.time()
            }
            
            await self._publish_event("voice_metrics", metrics_data)
            await asyncio.sleep(1.0)  # Broadcast every second
    
    async def _connect_mqtt(self):
        """Connect to MQTT broker for system communication"""
        try:
            self.mqtt_client = aiomqtt.Client(
                hostname=self.config.get("mqtt_host", "localhost"),
                port=self.config.get("mqtt_port", 1883)
            )
            await self.mqtt_client.connect()
            self.logger.info("Connected to MQTT broker")
        except Exception as e:
            self.logger.error(f"Failed to connect to MQTT: {e}")
    
    async def _publish_event(self, event_type: str, data: Dict[str, Any]):
        """Publish event to MQTT"""
        if self.mqtt_client:
            try:
                topic = f"wit/voice/{event_type}"
                payload = json.dumps(data)
                await self.mqtt_client.publish(topic, payload)
            except Exception as e:
                self.logger.error(f"Failed to publish MQTT event: {e}")


# Example usage and handlers
async def handle_equipment_command(command: VoiceCommand):
    """Handle equipment control commands"""
    device = command.parameters.get("device")
    action = command.parameters.get("action")
    print(f"Equipment command: {action} on {device}")


async def handle_safety_command(command: VoiceCommand):
    """Handle safety-critical commands"""
    action = command.parameters.get("action")
    if action == "emergency_stop":
        print("EMERGENCY STOP TRIGGERED!")
        # Implement emergency stop logic


async def main():
    """Main entry point for voice processor"""
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Configuration
    config = {
        "sample_rate": 16000,
        "chunk_size": 480,
        "channels": 1,
        "wake_word": "wit",
        "wake_sensitivity": 0.5,
        "command_timeout": 5.0,
        "mqtt_host": "localhost",
        "mqtt_port": 1883
    }
    
    # Create processor
    processor = WITVoiceProcessor(config)
    
    # Register command handlers
    processor.register_command_handler(
        CommandType.EQUIPMENT_CONTROL, 
        handle_equipment_command
    )
    processor.register_command_handler(
        CommandType.SAFETY, 
        handle_safety_command
    )
    
    # Start processing
    try:
        await processor.start()
    except KeyboardInterrupt:
        print("\nShutting down...")
        await processor.stop()


if __name__ == "__main__":
    asyncio.run(main())