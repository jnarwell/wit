"""
W.I.T. Database Service

File: software/backend/services/database_service.py

Database management service using SQLAlchemy and PostgreSQL/TimescaleDB.
"""

import asyncio
import logging
from typing import Optional, Dict, Any, List, Type, TypeVar
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import (
    create_async_engine, AsyncSession, AsyncEngine, async_sessionmaker
)
from sqlalchemy.orm import declarative_base, selectinload
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, JSON, Text,
    ForeignKey, Index, select, and_, or_, func, desc
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import text
import uuid

# Configure logging
logger = logging.getLogger(__name__)

# Base for all models
Base = declarative_base()

# Type variable for generic model operations
ModelType = TypeVar("ModelType", bound=Base)


# Database Models

class User(Base):
    """User model"""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)
    preferences = Column(JSONB, default={})


class Equipment(Base):
    """Equipment model"""
    __tablename__ = "equipment"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    equipment_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)  # printer, cnc, laser, etc.
    model = Column(String(100))
    status = Column(String(50), default="offline")
    config = Column(JSONB, default={})
    location = Column(String(100))
    added_at = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime)
    extra_data = Column(JSONB, default={})
    
    __table_args__ = (
        Index("idx_equipment_type_status", "type", "status"),
    )


class Project(Base):
    """Project model"""
    __tablename__ = "projects"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    type = Column(String(50))
    status = Column(String(50), default="active")
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime)
    files = Column(JSONB, default=[])
    extra_data = Column(JSONB, default={})


class Job(Base):
    """Job/Task model"""
    __tablename__ = "jobs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(String(50), unique=True, nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"))
    equipment_id = Column(UUID(as_uuid=True), ForeignKey("equipment.id"))
    type = Column(String(50))  # print, cut, mill, etc.
    status = Column(String(50), default="pending")
    priority = Column(Integer, default=0)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    duration_seconds = Column(Integer)
    progress = Column(Float, default=0.0)
    file_path = Column(String(500))
    parameters = Column(JSONB, default={})
    result = Column(JSONB)
    error = Column(Text)
    
    __table_args__ = (
        Index("idx_job_status_priority", "status", "priority"),
        Index("idx_job_equipment_status", "equipment_id", "status"),
    )


class Material(Base):
    """Material inventory model"""
    __tablename__ = "materials"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    material_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)
    location = Column(String(100))
    color = Column(String(50))
    properties = Column(JSONB, default={})
    supplier = Column(String(100))
    cost_per_unit = Column(Float)
    min_stock_level = Column(Float)
    last_updated = Column(DateTime, default=datetime.utcnow)


class Event(Base):
    """Event log model"""
    __tablename__ = "events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(String(50), unique=True, nullable=False, index=True)
    type = Column(String(50), nullable=False)
    category = Column(String(50), nullable=False)
    priority = Column(Integer, default=1)
    source = Column(String(100))
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    data = Column(JSONB, default={})
    correlation_id = Column(String(50), index=True)
    
    __table_args__ = (
        Index("idx_event_type_timestamp", "type", "timestamp"),
        Index("idx_event_category_timestamp", "category", "timestamp"),
    )


class Telemetry(Base):
    """Telemetry/Time-series data model"""
    __tablename__ = "telemetry"
    
    time = Column(DateTime, primary_key=True, default=datetime.utcnow)
    source = Column(String(100), primary_key=True)
    metric = Column(String(100), primary_key=True)
    value = Column(Float)
    unit = Column(String(20))
    tags = Column(JSONB, default={})
    
    __table_args__ = (
        Index("idx_telemetry_source_metric_time", "source", "metric", "time"),
    )


class Command(Base):
    """Command history model"""
    __tablename__ = "commands"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    command = Column(String(200), nullable=False)
    target = Column(String(100))
    parameters = Column(JSONB, default={})
    source = Column(String(100))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    result = Column(JSONB)
    success = Column(Boolean)
    error = Column(Text)


class SafetyLog(Base):
    """Safety event log model"""
    __tablename__ = "safety_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type = Column(String(50), nullable=False)
    alert_level = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    location = Column(String(100))
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    details = Column(JSONB, default={})
    
    __table_args__ = (
        Index("idx_safety_level_timestamp", "alert_level", "timestamp"),
        Index("idx_safety_resolved_timestamp", "resolved", "timestamp"),
    )


class DatabaseService:
    """Database service for managing all database operations"""
    
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.engine: Optional[AsyncEngine] = None
        self.session_factory: Optional[async_sessionmaker] = None
        self.connected = False
        
    async def connect(self):
        """Connect to database"""
        try:
            # Create async engine
            self.engine = create_async_engine(
                self.database_url,
                echo=False,  # Set to True for SQL logging
                pool_pre_ping=True,
                pool_size=10,
                max_overflow=20
            )
            
            # Create session factory
            self.session_factory = async_sessionmaker(
                self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
            
            # Test connection
            async with self.engine.begin() as conn:
                await conn.execute(text("SELECT 1"))
                
            self.connected = True
            logger.info("Connected to database")
            
        except Exception as e:
            logger.error(f"Database connection error: {e}")
            raise
            
    async def disconnect(self):
        """Disconnect from database"""
        if self.engine:
            await self.engine.dispose()
            
        self.connected = False
        logger.info("Disconnected from database")
        
    async def create_tables(self):
        """Create all tables"""
        if not self.engine:
            raise RuntimeError("Not connected to database")
            
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
            # Create TimescaleDB hypertable for telemetry
            await conn.execute(text("""
                SELECT create_hypertable('telemetry', 'time', 
                    if_not_exists => TRUE,
                    chunk_time_interval => INTERVAL '1 day'
                );
            """))
            
            # Create hypertable for events
            await conn.execute(text("""
                SELECT create_hypertable('events', 'timestamp',
                    if_not_exists => TRUE,
                    chunk_time_interval => INTERVAL '1 week'
                );
            """))
            
        logger.info("Database tables created")
        
    @asynccontextmanager
    async def get_session(self) -> AsyncSession:
        """Get database session"""
        if not self.session_factory:
            raise RuntimeError("Not connected to database")
            
        async with self.session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
                
    # Generic CRUD operations
    async def create(self, model: ModelType) -> ModelType:
        """Create a new record"""
        async with self.get_session() as session:
            session.add(model)
            await session.flush()
            await session.refresh(model)
            return model
            
    async def get(self, model_class: Type[ModelType], 
                  **filters) -> Optional[ModelType]:
        """Get single record by filters"""
        async with self.get_session() as session:
            query = select(model_class)
            
            for key, value in filters.items():
                query = query.where(getattr(model_class, key) == value)
                
            result = await session.execute(query)
            return result.scalar_one_or_none()
            
    async def get_many(self, model_class: Type[ModelType],
                      limit: int = 100,
                      offset: int = 0,
                      **filters) -> List[ModelType]:
        """Get multiple records"""
        async with self.get_session() as session:
            query = select(model_class)
            
            for key, value in filters.items():
                query = query.where(getattr(model_class, key) == value)
                
            query = query.limit(limit).offset(offset)
            
            result = await session.execute(query)
            return result.scalars().all()
            
    async def update(self, model: ModelType, **updates) -> ModelType:
        """Update a record"""
        async with self.get_session() as session:
            for key, value in updates.items():
                setattr(model, key, value)
                
            session.add(model)
            await session.flush()
            await session.refresh(model)
            return model
            
    async def delete(self, model: ModelType) -> bool:
        """Delete a record"""
        async with self.get_session() as session:
            await session.delete(model)
            return True
            
    # Specific queries
    async def get_active_equipment(self) -> List[Equipment]:
        """Get all active equipment"""
        async with self.get_session() as session:
            query = select(Equipment).where(
                Equipment.status.in_(["online", "idle", "busy"])
            )
            result = await session.execute(query)
            return result.scalars().all()
            
    async def get_recent_jobs(self, 
                            equipment_id: Optional[str] = None,
                            limit: int = 10) -> List[Job]:
        """Get recent jobs"""
        async with self.get_session() as session:
            query = select(Job).order_by(desc(Job.started_at))
            
            if equipment_id:
                equipment = await self.get(Equipment, equipment_id=equipment_id)
                if equipment:
                    query = query.where(Job.equipment_id == equipment.id)
                    
            query = query.limit(limit)
            
            result = await session.execute(query)
            return result.scalars().all()
            
    async def get_low_stock_materials(self) -> List[Material]:
        """Get materials below minimum stock level"""
        async with self.get_session() as session:
            query = select(Material).where(
                Material.quantity <= Material.min_stock_level
            )
            result = await session.execute(query)
            return result.scalars().all()
            
    async def record_telemetry(self, source: str, metric: str, 
                             value: float, unit: str = "",
                             tags: Optional[Dict[str, Any]] = None):
        """Record telemetry data"""
        telemetry = Telemetry(
            source=source,
            metric=metric,
            value=value,
            unit=unit,
            tags=tags or {}
        )
        await self.create(telemetry)
        
    async def get_telemetry(self, source: str, metric: str,
                          start_time: datetime,
                          end_time: Optional[datetime] = None,
                          limit: int = 1000) -> List[Telemetry]:
        """Get telemetry data"""
        async with self.get_session() as session:
            query = select(Telemetry).where(
                and_(
                    Telemetry.source == source,
                    Telemetry.metric == metric,
                    Telemetry.time >= start_time
                )
            )
            
            if end_time:
                query = query.where(Telemetry.time <= end_time)
                
            query = query.order_by(Telemetry.time).limit(limit)
            
            result = await session.execute(query)
            return result.scalars().all()
            
    async def get_telemetry_aggregated(self, source: str, metric: str,
                                     start_time: datetime,
                                     end_time: Optional[datetime] = None,
                                     interval: str = "1 hour") -> List[Dict[str, Any]]:
        """Get aggregated telemetry data"""
        async with self.get_session() as session:
            # Use TimescaleDB time_bucket function
            query = text("""
                SELECT 
                    time_bucket(:interval, time) AS bucket,
                    AVG(value) as avg_value,
                    MIN(value) as min_value,
                    MAX(value) as max_value,
                    COUNT(*) as count
                FROM telemetry
                WHERE source = :source
                    AND metric = :metric
                    AND time >= :start_time
                    AND (:end_time IS NULL OR time <= :end_time)
                GROUP BY bucket
                ORDER BY bucket
            """)
            
            result = await session.execute(
                query,
                {
                    "interval": interval,
                    "source": source,
                    "metric": metric,
                    "start_time": start_time,
                    "end_time": end_time
                }
            )
            
            return [dict(row) for row in result]
            
    async def cleanup_old_data(self, days: int = 30):
        """Cleanup old data"""
        async with self.get_session() as session:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            # Delete old events
            await session.execute(
                text("DELETE FROM events WHERE timestamp < :cutoff"),
                {"cutoff": cutoff_date}
            )
            
            # Delete old telemetry (TimescaleDB handles this efficiently)
            await session.execute(
                text("DELETE FROM telemetry WHERE time < :cutoff"),
                {"cutoff": cutoff_date}
            )
            
            logger.info(f"Cleaned up data older than {days} days")
            
    async def get_statistics(self) -> Dict[str, Any]:
        """Get database statistics"""
        async with self.get_session() as session:
            stats = {}
            
            # Count records in each table
            for table in ["users", "equipment", "projects", "jobs", 
                         "materials", "events", "commands", "safety_logs"]:
                result = await session.execute(
                    text(f"SELECT COUNT(*) as count FROM {table}")
                )
                stats[f"{table}_count"] = result.scalar()
                
            # Get telemetry statistics
            result = await session.execute(
                text("""
                    SELECT 
                        COUNT(DISTINCT source) as sources,
                        COUNT(DISTINCT metric) as metrics,
                        COUNT(*) as total_points
                    FROM telemetry
                    WHERE time > NOW() - INTERVAL '24 hours'
                """)
            )
            telemetry_stats = dict(result.fetchone())
            stats["telemetry_24h"] = telemetry_stats
            
            return stats


# Example usage
async def main():
    """Example usage"""
    db = DatabaseService("postgresql+asyncpg://user:pass@localhost/wit_db")
    
    await db.connect()
    await db.create_tables()
    
    # Create a user
    user = User(
        username="john_doe",
        email="john@example.com",
        hashed_password="hashed_password_here"
    )
    user = await db.create(user)
    print(f"Created user: {user.username}")
    
    # Create equipment
    printer = Equipment(
        equipment_id="printer1",
        name="Prusa MK3S+",
        type="3d_printer",
        model="MK3S+",
        status="online"
    )
    printer = await db.create(printer)
    
    # Record telemetry
    await db.record_telemetry(
        source="printer1",
        metric="extruder_temp",
        value=205.5,
        unit="celsius"
    )
    
    # Get statistics
    stats = await db.get_statistics()
    print(f"Database statistics: {stats}")
    
    await db.disconnect()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())