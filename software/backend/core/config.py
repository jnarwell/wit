"""
W.I.T. Backend Configuration

Central configuration management using Pydantic settings.
"""

from pydantic_settings import BaseSettings
from typing import List, Optional
import os
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "W.I.T. Terminal"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True
    
    # API
    API_V1_PREFIX: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "postgresql://wit_user:password@localhost:5432/wit_db"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 40
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # MQTT
    MQTT_BROKER_URL: str = "mqtt://localhost:1883"
    MQTT_CLIENT_ID: str = "wit-backend"
    MQTT_KEEPALIVE: int = 60
    
    # Security
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
        "http://wit-terminal.local"
    ]
    
    # Voice Processing
    WHISPER_MODEL_SIZE: str = "base"
    WHISPER_DEVICE: str = "cuda"
    VOICE_SAMPLE_RATE: int = 16000
    VOICE_CHANNELS: int = 8
    
    # Computer Vision
    VISION_MODEL: str = "yolov8n"
    VISION_CONFIDENCE_THRESHOLD: float = 0.5
    VISION_MAX_CAMERAS: int = 8
    VISION_FPS: int = 30
    
    # Equipment Integration
    OCTOPRINT_URL: Optional[str] = "http://localhost:5000"
    OCTOPRINT_API_KEY: Optional[str] = None
    GRBL_SERIAL_PORT: str = "/dev/ttyUSB0"
    GRBL_BAUD_RATE: int = 115200
    
    # Safety
    EMERGENCY_STOP_GPIO: int = 17
    SAFETY_CHECK_INTERVAL: float = 0.1  # seconds
    MAX_TEMPERATURE_C: float = 85.0
    
    # File Storage
    UPLOAD_PATH: str = "/data/uploads"
    MAX_UPLOAD_SIZE_MB: int = 1000
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "/var/log/wit/backend.log"
    
    # Hardware
    NPU_ENABLED: bool = True
    NPU_DEVICE: str = "hailo"
    GPIO_MODE: str = "BCM"
    
    # Workshop Defaults
    DEFAULT_WORKSPACE_NAME: str = "Main Workshop"
    DEFAULT_TEMPERATURE_UNIT: str = "celsius"
    DEFAULT_MEASUREMENT_UNIT: str = "metric"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Create settings instance
settings = get_settings()


# Configuration validation
def validate_config():
    """Validate configuration on startup"""
    errors = []
    
    # Check database URL
    if not settings.DATABASE_URL:
        errors.append("DATABASE_URL is not set")
        
    # Check MQTT broker
    if not settings.MQTT_BROKER_URL:
        errors.append("MQTT_BROKER_URL is not set")
        
    # Check secret key
    if settings.SECRET_KEY == "your-secret-key-here-change-in-production":
        errors.append("SECRET_KEY must be changed from default")
        
    # Check file paths
    if not os.path.exists(settings.UPLOAD_PATH):
        try:
            os.makedirs(settings.UPLOAD_PATH, exist_ok=True)
        except Exception as e:
            errors.append(f"Cannot create upload directory: {e}")
            
    if errors:
        raise ValueError(f"Configuration errors: {', '.join(errors)}")
        
    return True


# Hardware configuration
HARDWARE_CONFIG = {
    "audio": {
        "microphone_array": {
            "type": "i2s",
            "channels": 8,
            "sample_rate": 16000,
            "bit_depth": 24,
            "mic_spacing_mm": 50,
            "array_type": "linear"
        },
        "speaker": {
            "type": "i2s",
            "channels": 2,
            "sample_rate": 48000,
            "amplifier_gpio": 23
        }
    },
    "vision": {
        "cameras": [
            {
                "id": 0,
                "type": "usb",
                "device": "/dev/video0",
                "resolution": [1920, 1080],
                "fps": 30
            },
            {
                "id": 1,
                "type": "csi",
                "device": "/dev/video1",
                "resolution": [1280, 720],
                "fps": 60
            }
        ]
    },
    "gpio": {
        "emergency_stop": 17,
        "status_led_r": 27,
        "status_led_g": 22,
        "status_led_b": 24,
        "buzzer": 25,
        "safety_relay": 5
    },
    "sensors": {
        "temperature": {
            "type": "i2c",
            "address": 0x48,
            "sensor": "tmp102"
        },
        "power_monitor": {
            "type": "i2c",
            "address": 0x40,
            "sensor": "ina219"
        }
    }
}


# Equipment profiles
EQUIPMENT_PROFILES = {
    "prusa_mk3": {
        "type": "3d_printer",
        "interface": "octoprint",
        "max_temp_hotend": 300,
        "max_temp_bed": 120,
        "build_volume": [250, 210, 210],
        "filament_diameter": 1.75
    },
    "shapeoko_3": {
        "type": "cnc_router",
        "interface": "grbl",
        "work_area": [425, 425, 95],
        "spindle_max_rpm": 30000,
        "max_feed_rate": 5000
    },
    "k40_laser": {
        "type": "laser_cutter",
        "interface": "grbl",
        "work_area": [300, 200],
        "max_power_watts": 40,
        "safety_interlock": True
    }
}


# Voice command patterns
VOICE_COMMANDS = {
    "print": {
        "patterns": ["print", "3d print", "fabricate", "make"],
        "parameters": ["filename", "material", "quality", "color"],
        "requires_confirmation": ["cancel", "delete"]
    },
    "machine_control": {
        "patterns": ["start", "stop", "pause", "resume", "home", "zero"],
        "safety_level": 2,
        "equipment_types": ["printer", "cnc", "laser", "mill"]
    },
    "emergency": {
        "patterns": ["emergency stop", "stop everything", "abort", "kill"],
        "priority": "critical",
        "broadcast": True
    },
    "query": {
        "patterns": ["status", "temperature", "progress", "time remaining"],
        "response_type": "voice",
        "cache_duration": 5
    }
}