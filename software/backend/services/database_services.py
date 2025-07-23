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
from sqlalchemy.orm import declarative_base, relationship

# --- Configuration ---
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./wit.db")
logger = logging.getLogger(__name__)

# --- SQLAlchemy Setup ---
Base = declarative_base()

from sqlalchemy.orm import declarative_base, relationship

# --- Models ---
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    projects = relationship("Project", back_populates="owner")

class Project(Base):
    __tablename__ = "projects"
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    owner_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="projects")


engine: AsyncEngine = create_async_engine(DATABASE_URL, echo=False, future=True)
session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

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

# --- CRUD Operations ---

async def get_user_by_username(db: AsyncSession, username: str) -> Optional[User]:
    """Fetches a user by their username."""
    result = await db.execute(select(User).filter(User.username == username))
    return result.scalars().first()

async def create_user(db: AsyncSession, username: str, password: str, email: str, is_admin: bool = False) -> User:
    """Creates a new user in the database."""
    from software.backend.auth.security import get_password_hash
    hashed_password = get_password_hash(password)
    new_user = User(
        username=username,
        hashed_password=hashed_password,
        email=email,
        is_admin=is_admin
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

async def create_project(db: AsyncSession, name: str, description: str, owner_id: uuid.UUID) -> Project:
    """Creates a new project in the database."""
    new_project = Project(
        project_id=f"PROJ-{uuid.uuid4().hex[:8].upper()}",
        name=name,
        description=description,
        owner_id=owner_id
    )
    db.add(new_project)
    await db.commit()
    await db.refresh(new_project)
    return new_project