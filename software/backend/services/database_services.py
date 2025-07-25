# software/backend/services/database_services.py
"""
W.I.T. Database Service - SIMPLIFIED
"""
import logging
import os
import uuid
from datetime import datetime
from typing import AsyncGenerator, Optional

from fastapi import HTTPException
from sqlalchemy import (Column, String, Integer, Float, Boolean, DateTime, JSON, Text, ForeignKey, Index, select, event, UniqueConstraint)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import (AsyncSession, async_sessionmaker, create_async_engine, AsyncEngine)
from sqlalchemy.orm import declarative_base, relationship


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./wit.db")
logger = logging.getLogger(__name__)
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
    microcontrollers = relationship("Microcontroller", back_populates="owner")

class Project(Base):
    __tablename__ = "projects"
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    type = Column(String(50))
    status = Column(String(50), default="not_started")  # not_started, in_progress, blocked, complete
    priority = Column(String(20), default="medium")  # low, medium, high
    owner_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    extra_data = Column(JSON, default={})
    owner = relationship("User", back_populates="projects")
    tasks = relationship("Task", back_populates="project")
    members = relationship("TeamMember", back_populates="project")

class TeamMember(Base):
    __tablename__ = "team_members"
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(PG_UUID(as_uuid=True), ForeignKey("projects.id"))
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"))
    role = Column(String(50), default="viewer")
    project = relationship("Project", back_populates="members")
    user = relationship("User")
    __table_args__ = (UniqueConstraint('project_id', 'user_id', name='_project_user_uc'),)

class Task(Base):
    __tablename__ = "tasks"
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="not_started")  # not_started, in_progress, blocked, complete
    priority = Column(String(20), default="medium")  # low, medium, high
    project_id = Column(PG_UUID(as_uuid=True), ForeignKey("projects.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project = relationship("Project", back_populates="tasks")

class File(Base):
    __tablename__ = "files"
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String(200), nullable=False)
    filepath = Column(String(500), nullable=False)
    filesize = Column(Integer)
    filetype = Column(String(100))
    project_id = Column(PG_UUID(as_uuid=True), ForeignKey("projects.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    project = relationship("Project")

class Equipment(Base):
    __tablename__ = "equipment"
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    equipment_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    type = Column(String(50), nullable=False) # e.g., "3d_printer", "laser_cutter"
    status = Column(String(50), default="offline")
    owner_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"))
    extra_data = Column(JSON, default={})

engine: AsyncEngine = create_async_engine(DATABASE_URL, echo=False, future=True)
session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Sync engine for background tasks
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
sync_engine = create_engine(DATABASE_URL.replace("+aiosqlite", ""), echo=False)
sync_session_factory = sessionmaker(bind=sync_engine, expire_on_commit=False)

async def create_db_and_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {e}", exc_info=True)
            raise

async def get_user_by_username(db: AsyncSession, username: str) -> Optional[User]:
    result = await db.execute(select(User).filter(User.username == username))
    return result.scalars().first()

async def create_user(db: AsyncSession, username: str, email: str, password: str) -> User:
    from software.backend.auth.security import get_password_hash
    hashed_password = get_password_hash(password)
    new_user = User(username=username, email=email, hashed_password=hashed_password)
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

def get_session_sync() -> Session:
    """Get a synchronous database session for background tasks"""
    return sync_session_factory()
