"""
W.I.T. Database Configuration

Flexible configuration for local, cloud, and edge deployment
"""
import os
from enum import Enum
from typing import Optional

class StorageMode(str, Enum):
    LOCAL = "local"          # SQLite for edge/terminal deployment
    POSTGRES = "postgres"    # PostgreSQL for development/cloud
    HYBRID = "hybrid"        # Local with cloud sync

class DatabaseConfig:
    def __init__(self):
        # Storage mode
        self.STORAGE_MODE = StorageMode(os.getenv("WIT_DB_STORAGE_MODE", "postgres"))
        
        # PostgreSQL settings (for development/cloud)
        self.POSTGRES_HOST = os.getenv("WIT_DB_POSTGRES_HOST", "localhost")
        self.POSTGRES_PORT = int(os.getenv("WIT_DB_POSTGRES_PORT", "5432"))
        self.POSTGRES_DB = os.getenv("WIT_DB_POSTGRES_DB", "wit_db")
        self.POSTGRES_USER = os.getenv("WIT_DB_POSTGRES_USER", "postgres")
        self.POSTGRES_PASSWORD = os.getenv("WIT_DB_POSTGRES_PASSWORD", "postgres")
        
        # SQLite settings (for edge deployment)
        self.SQLITE_PATH = os.getenv("WIT_DB_SQLITE_PATH", "data/wit_local.db")
        
        # Connection pool settings
        self.POOL_SIZE = int(os.getenv("WIT_DB_POOL_SIZE", "10"))
        self.MAX_OVERFLOW = int(os.getenv("WIT_DB_MAX_OVERFLOW", "20"))
        
        # Cloud sync settings (for hybrid mode)
        self.CLOUD_SYNC_ENABLED = os.getenv("WIT_DB_CLOUD_SYNC_ENABLED", "false").lower() == "true"
        self.CLOUD_SYNC_INTERVAL = int(os.getenv("WIT_DB_CLOUD_SYNC_INTERVAL", "300"))
        self.CLOUD_ENDPOINT = os.getenv("WIT_DB_CLOUD_ENDPOINT", "")
    
    @property
    def database_url(self) -> str:
        """Get database URL based on storage mode"""
        if self.STORAGE_MODE == StorageMode.LOCAL:
            return f"sqlite+aiosqlite:///{self.SQLITE_PATH}"
        elif self.STORAGE_MODE == StorageMode.POSTGRES:
            return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        else:  # HYBRID
            # Use local SQLite as primary
            return f"sqlite+aiosqlite:///{self.SQLITE_PATH}"

db_config = DatabaseConfig()
