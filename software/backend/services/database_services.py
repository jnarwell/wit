"""
W.I.T. Database Service - SIMPLIFIED

File: software/backend/services/database_services.py

A direct and standard implementation for SQLAlchemy connection and session management.
"""

import logging
import os
import uuid
from datetime import datetime
from typing import AsyncGenerator, Optional

from fastapi import HTTPException
from sqlalchemy import (Column, String, Integer, Float, Boolean, DateTime, JSON, Text, ForeignKey, Index, select, event)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import (AsyncSession, async_sessionmaker, create_async_engine, AsyncEngine)
from sqlalchemy.orm import declarative_base

# --- Configuration ---
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./wit.db")
logger = logging.getLogger(__name__)

# --- SQLAlchemy Setup ---
Base = declarative_base()
engine: AsyncEngine = create_async_engine(DATABASE_URL, echo=False, future=True)
session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# --- Models ---
class User(Base):
    __tablename__ = "users"
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Project(Base):
    __tablename__ = "projects"
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    type = Column(String(50))
    status = Column(String(50), default="active")
    owner_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    extra_data = Column(JSON, default={})

# --- Database Lifecycle Functions ---
async def create_db_and_tables():
    """Creates all database tables from the Base metadata."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created successfully.")

async def close_db_connection():
    """Closes the database engine connection."""
    await engine.dispose()
    logger.info("Database connection closed.")

# --- Dependency for FastAPI ---
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that provides a database session."""
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {e}", exc_info=True)
            raise