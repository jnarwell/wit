"""
W.I.T. Database Service

File: software/backend/services/database_service_complete.py

Complete database initialization and session management
"""

import os
import logging
from typing import AsyncGenerator, Optional
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import (
    create_async_engine, AsyncSession, async_sessionmaker, AsyncEngine
)
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from sqlalchemy import text, event
import asyncpg
from datetime import datetime

logger = logging.getLogger(__name__)


class DatabaseService:
    """Main database service for W.I.T."""
    
    def __init__(self):
        self.engine: Optional[AsyncEngine] = None
        self.async_session: Optional[async_sessionmaker] = None
        self._initialized = False
    
    async def initialize(self, database_url: str, echo: bool = False):
        """Initialize database connection"""
        if self._initialized:
            logger.warning("Database already initialized")
            return
        
        try:
            # Convert URL for async
            if database_url.startswith("postgresql://"):
                database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
            elif database_url.startswith("sqlite://"):
                database_url = database_url.replace("sqlite://", "sqlite+aiosqlite://")
            
            # Create engine with appropriate settings
            if "sqlite" in database_url:
                # SQLite settings
                self.engine = create_async_engine(
                    database_url,
                    echo=echo,
                    connect_args={
                        "check_same_thread": False,
                        "timeout": 30
                    }
                )
            else:
                # PostgreSQL settings
                self.engine = create_async_engine(
                    database_url,
                    echo=echo,
                    pool_size=20,
                    max_overflow=10,
                    pool_pre_ping=True,
                    pool_recycle=3600,
                    connect_args={
                        "server_settings": {
                            "application_name": "wit_backend",
                            "jit": "off"
                        },
                        "command_timeout": 60,
                        "timeout": 30
                    }
                )
            
            # Create session factory
            self.async_session = async_sessionmaker(
                self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
            
            self._initialized = True
            logger.info(f"Database initialized successfully with {database_url.split('://')[0]}")
            
            # Create tables
            await self.create_tables()
            
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise
    
    async def create_tables(self):
        """Create all tables if they don't exist"""
        try:
            from ..models.database_models_extended import Base
            
            async with self.engine.begin() as conn:
                # Enable extensions for PostgreSQL
                if "postgresql" in str(self.engine.url):
                    await conn.execute(text("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"))
                    await conn.execute(text("CREATE EXTENSION IF NOT EXISTS \"pg_trgm\";"))
                
                # Create all tables
                await conn.run_sync(Base.metadata.create_all)
                
            logger.info("Database tables created successfully")
            
            # Create initial data
            await self.create_initial_data()
            
        except Exception as e:
            logger.error(f"Error creating tables: {e}")
            raise
    
    async def create_initial_data(self):
        """Create initial data like default admin user"""
        try:
            async with self.get_session() as session:
                from models.database_models_extended import User, Tag
                from auth.security import get_password_hash
                
                # Check if admin exists
                admin_query = await session.execute(
                    text("SELECT COUNT(*) FROM users WHERE username = :username"),
                    {"username": "admin"}
                )
                admin_exists = admin_query.scalar() > 0
                
                if not admin_exists:
                    # Create admin user
                    admin = User(
                        username="admin",
                        email="admin@wit.local",
                        hashed_password=get_password_hash("admin123"),
                        is_admin=True,
                        is_active=True
                    )
                    session.add(admin)
                    
                    # Create default tags
                    default_tags = [
                        {"name": "urgent", "color": "#FF0000"},
                        {"name": "bug", "color": "#D73A49"},
                        {"name": "feature", "color": "#0E8A16"},
                        {"name": "documentation", "color": "#0052CC"},
                        {"name": "hardware", "color": "#FBCA04"},
                        {"name": "software", "color": "#5319E7"}
                    ]
                    
                    for tag_data in default_tags:
                        tag = Tag(**tag_data)
                        session.add(tag)
                    
                    await session.commit()
                    logger.info("Initial data created successfully")
                    
        except Exception as e:
            logger.error(f"Error creating initial data: {e}")
    
    async def get_session(self) -> AsyncSession:
        """Get a database session"""
        if not self._initialized:
            raise RuntimeError("Database not initialized")
        return self.async_session()
    
    @asynccontextmanager
    async def session(self) -> AsyncGenerator[AsyncSession, None]:
        """Context manager for database session"""
        async with self.async_session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
    
    async def health_check(self) -> bool:
        """Check database health"""
        try:
            async with self.get_session() as session:
                result = await session.execute(text("SELECT 1"))
                return result.scalar() == 1
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False
    
    async def close(self):
        """Close database connections"""
        if self.engine:
            await self.engine.dispose()
            self._initialized = False
            logger.info("Database connections closed")


# Global database service instance
db_service = DatabaseService()


# Dependency for FastAPI
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session"""
    async with db_service.session() as session:
        yield session


# Initialize function for startup
async def init_database(database_url: str, echo: bool = False):
    """Initialize the database service"""
    await db_service.initialize(database_url, echo)


# Shutdown function
async def close_database():
    """Close database connections"""
    await db_service.close()


# Helper functions for common operations
class DatabaseUtils:
    """Utility functions for database operations"""
    
    @staticmethod
    async def execute_query(query: str, params: dict = None) -> list:
        """Execute a raw SQL query"""
        async with db_service.session() as session:
            result = await session.execute(text(query), params or {})
            return result.fetchall()
    
    @staticmethod
    async def get_table_stats() -> dict:
        """Get database table statistics"""
        stats = {}
        
        if "postgresql" in str(db_service.engine.url):
            query = """
                SELECT 
                    tablename,
                    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
                    n_live_tup as row_count
                FROM pg_stat_user_tables
                ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
            """
        else:
            # SQLite query
            query = """
                SELECT 
                    name as tablename,
                    '' as size,
                    (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=m.name) as row_count
                FROM sqlite_master m
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
                ORDER BY name;
            """
        
        results = await DatabaseUtils.execute_query(query)
        
        for row in results:
            stats[row[0]] = {
                "size": row[1],
                "row_count": row[2]
            }
        
        return stats
    
    @staticmethod
    async def backup_database(backup_path: str):
        """Backup the database"""
        if "sqlite" in str(db_service.engine.url):
            # SQLite backup
            import shutil
            db_path = str(db_service.engine.url).replace("sqlite+aiosqlite:///", "")
            shutil.copy2(db_path, backup_path)
            logger.info(f"Database backed up to {backup_path}")
        else:
            # PostgreSQL backup would require pg_dump
            logger.warning("PostgreSQL backup not implemented - use pg_dump")
    
    @staticmethod
    async def vacuum_database():
        """Vacuum/optimize the database"""
        async with db_service.session() as session:
            if "postgresql" in str(db_service.engine.url):
                await session.execute(text("VACUUM ANALYZE;"))
            else:
                await session.execute(text("VACUUM;"))
            logger.info("Database vacuumed successfully")


# Export all necessary items
__all__ = [
    "db_service",
    "get_session",
    "init_database",
    "close_database",
    "DatabaseUtils"
]