"""
W.I.T. Backend Configuration

File: software/backend/config.py

Central configuration for the backend service
"""

import os
from typing import Optional, List
from pydantic_settings import BaseSettings
from pydantic import Field, validator


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "W.I.T. Terminal"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = Field(default=False, env="WIT_DEBUG")
    
    # API
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "W.I.T. Terminal API"
    
    # Security
    SECRET_KEY: str = Field(default="your-secret-key-change-this", env="WIT_SECRET_KEY")
    JWT_SECRET_KEY: str = Field(default="your-jwt-secret-change-this", env="JWT_SECRET_KEY")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    DATABASE_URL: str = Field(
        default="postgresql://wit_user:wit_password@localhost/wit_db",
        env="DATABASE_URL"
    )
    DATABASE_POOL_SIZE: int = Field(default=20, env="WIT_DB_POOL_SIZE")
    DATABASE_MAX_OVERFLOW: int = Field(default=10, env="WIT_DB_MAX_OVERFLOW")
    
    # Alternative database settings for flexibility
    DB_HOST: str = Field(default="localhost", env="WIT_DB_HOST")
    DB_PORT: int = Field(default=5432, env="WIT_DB_PORT")
    DB_USER: str = Field(default="wit_user", env="WIT_DB_USER")
    DB_PASSWORD: str = Field(default="wit_password", env="WIT_DB_PASSWORD")
    DB_NAME: str = Field(default="wit_db", env="WIT_DB_NAME")
    
    # Storage mode (local, postgres, hybrid)
    STORAGE_MODE: str = Field(default="postgres", env="WIT_STORAGE_MODE")
    SQLITE_PATH: str = Field(default="data/wit_local.db", env="WIT_SQLITE_PATH")
    
    # File Storage
    FILE_STORAGE_PATH: str = Field(default="storage/files", env="WIT_FILE_STORAGE_PATH")
    MAX_FILE_SIZE: int = Field(default=100 * 1024 * 1024, env="WIT_MAX_FILE_SIZE")  # 100MB
    ALLOWED_FILE_EXTENSIONS: List[str] = [
        ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg",
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        ".txt", ".md", ".json", ".csv", ".xml",
        ".stl", ".obj", ".gcode", ".3mf", ".step", ".iges",
        ".mp4", ".avi", ".mov", ".webm",
        ".zip", ".tar", ".gz", ".7z"
    ]
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173"],
        env="WIT_CORS_ORIGINS"
    )
    
    # Redis (for caching and real-time features)
    REDIS_URL: str = Field(default="redis://localhost:6379", env="REDIS_URL")
    
    # MQTT (for IoT communication)
    MQTT_BROKER: str = Field(default="localhost", env="WIT_MQTT_BROKER")
    MQTT_PORT: int = Field(default=1883, env="WIT_MQTT_PORT")
    MQTT_USERNAME: Optional[str] = Field(default=None, env="WIT_MQTT_USERNAME")
    MQTT_PASSWORD: Optional[str] = Field(default=None, env="WIT_MQTT_PASSWORD")
    
    # External APIs
    ANTHROPIC_API_KEY: Optional[str] = Field(default=None, env="ANTHROPIC_API_KEY")
    OPENAI_API_KEY: Optional[str] = Field(default=None, env="OPENAI_API_KEY")
    
    # Hardware Configuration
    SERIAL_PORT: str = Field(default="/dev/ttyUSB0", env="WIT_SERIAL_PORT")
    NPU_DEVICE: str = Field(default="/dev/hailo0", env="WIT_NPU_DEVICE")
    
    # Feature Flags
    ENABLE_VOICE: bool = Field(default=True, env="WIT_ENABLE_VOICE")
    ENABLE_VISION: bool = Field(default=True, env="WIT_ENABLE_VISION")
    ENABLE_CLOUD_SYNC: bool = Field(default=False, env="WIT_ENABLE_CLOUD_SYNC")
    
    @validator("DATABASE_URL", pre=True)
    def build_database_url(cls, v: Optional[str], values: dict) -> str:
        """Build database URL from components if not provided"""
        if v:
            return v
        
        storage_mode = values.get("STORAGE_MODE", "postgres")
        
        if storage_mode == "local":
            sqlite_path = values.get("SQLITE_PATH", "data/wit_local.db")
            return f"sqlite:///{sqlite_path}"
        else:
            # Build PostgreSQL URL
            user = values.get("DB_USER", "wit_user")
            password = values.get("DB_PASSWORD", "wit_password")
            host = values.get("DB_HOST", "localhost")
            port = values.get("DB_PORT", 5432)
            db_name = values.get("DB_NAME", "wit_db")
            
            return f"postgresql://{user}:{password}@{host}:{port}/{db_name}"
    
    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str]:
        """Parse CORS origins from string or list"""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "allow"


# Create settings instance
settings = Settings()


# Create necessary directories
os.makedirs(settings.FILE_STORAGE_PATH, exist_ok=True)
os.makedirs(os.path.dirname(settings.SQLITE_PATH), exist_ok=True)


# Logging configuration
LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        },
        "detailed": {
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(pathname)s:%(lineno)d - %(message)s"
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "level": "INFO",
            "formatter": "default",
            "stream": "ext://sys.stdout"
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "DEBUG" if settings.DEBUG else "INFO",
            "formatter": "detailed",
            "filename": "logs/wit_backend.log",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5
        }
    },
    "loggers": {
        "": {
            "level": "DEBUG" if settings.DEBUG else "INFO",
            "handlers": ["console", "file"]
        },
        "sqlalchemy.engine": {
            "level": "WARNING",
            "handlers": ["file"]
        },
        "uvicorn.access": {
            "level": "INFO",
            "handlers": ["console"]
        }
    }
}


# Ensure log directory exists
os.makedirs("logs", exist_ok=True)