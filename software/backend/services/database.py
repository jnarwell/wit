"""
W.I.T. Database Service

Database initialization and session management.
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
import logging
from typing import AsyncGenerator
from contextlib import asynccontextmanager

from core.config import settings
from models.database import Base

logger = logging.getLogger(__name__)

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"),
    echo=settings.DEBUG,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_pre_ping=True,
    pool_recycle=3600
)

# Create session factory
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


async def init_db():
    """Initialize database - create tables if not exist"""
    try:
        async with engine.begin() as conn:
            # Create all tables
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables created successfully")
            
        # Create initial data
        await create_initial_data()
        
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session"""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_db_context():
    """Context manager for database session"""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_initial_data():
    """Create initial data in database"""
    from models.database import Equipment, Material, User
    from sqlalchemy import select
    from passlib.context import CryptContext
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    async with get_db_context() as db:
        # Check if data already exists
        result = await db.execute(select(User).limit(1))
        if result.scalar_one_or_none():
            logger.info("Initial data already exists")
            return
            
        logger.info("Creating initial data...")
        
        # Create default admin user
        admin_user = User(
            username="admin",
            email="admin@wit-terminal.local",
            full_name="Administrator",
            hashed_password=pwd_context.hash("changeme"),
            is_admin=True,
            is_active=True,
            preferences={
                "theme": "dark",
                "units": "metric",
                "language": "en"
            }
        )
        db.add(admin_user)
        
        # Create sample equipment
        printer = Equipment(
            name="Main 3D Printer",
            type="3d_printer",
            model="Prusa i3 MK3S+",
            connection_type="octoprint",
            connection_url=settings.OCTOPRINT_URL,
            is_online=False,
            config={
                "bed_size": [250, 210, 210],
                "nozzle_diameter": 0.4,
                "max_temp_hotend": 300,
                "max_temp_bed": 120
            },
            capabilities=["auto_leveling", "filament_sensor", "power_recovery"]
        )
        db.add(printer)
        
        cnc = Equipment(
            name="CNC Router",
            type="cnc_router",
            model="Shapeoko 3",
            connection_type="grbl",
            connection_url=f"serial://{settings.GRBL_SERIAL_PORT}:{settings.GRBL_BAUD_RATE}",
            is_online=False,
            config={
                "work_area": [425, 425, 95],
                "spindle_max_rpm": 30000,
                "feed_rate_max": 5000
            },
            capabilities=["homing", "probing", "tool_change"]
        )
        db.add(cnc)
        
        # Create sample materials
        pla = Material(
            name="PLA Filament - Black",
            type="filament",
            properties={
                "diameter": 1.75,
                "density": 1.24,
                "melting_point": 180,
                "print_temp_min": 190,
                "print_temp_max": 220,
                "bed_temp": 60,
                "color": "black"
            },
            compatible_equipment=["3d_printer"],
            quantity=2.5,
            unit="kg",
            location="Storage Cabinet A",
            supplier="Prusament",
            cost_per_unit=25.00,
            reorder_point=1.0
        )
        db.add(pla)
        
        plywood = Material(
            name="Plywood - 6mm Baltic Birch",
            type="sheet",
            properties={
                "thickness": 6,
                "sheet_size": [600, 400],
                "density": 0.68,
                "material": "baltic_birch"
            },
            compatible_equipment=["cnc_router", "laser_cutter"],
            quantity=10,
            unit="sheets",
            location="Wood Storage Rack",
            supplier="Local Lumber",
            cost_per_unit=15.00,
            reorder_point=5
        )
        db.add(plywood)
        
        await db.commit()
        logger.info("Initial data created successfully")


# Database utilities
class DatabaseUtils:
    """Database utility functions"""
    
    @staticmethod
    async def health_check() -> bool:
        """Check database connectivity"""
        try:
            async with engine.connect() as conn:
                await conn.execute("SELECT 1")
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False
            
    @staticmethod
    async def get_table_stats() -> dict:
        """Get database table statistics"""
        from sqlalchemy import text
        
        stats = {}
        async with engine.connect() as conn:
            # Get table sizes
            result = await conn.execute(text("""
                SELECT 
                    relname AS table_name,
                    n_live_tup AS row_count,
                    pg_size_pretty(pg_total_relation_size(relid)) AS total_size
                FROM pg_stat_user_tables
                ORDER BY n_live_tup DESC;
            """))
            
            for row in result:
                stats[row.table_name] = {
                    "row_count": row.row_count,
                    "size": row.total_size
                }
                
        return stats
        
    @staticmethod
    async def cleanup_old_telemetry(days: int = 30):
        """Clean up old telemetry data"""
        from sqlalchemy import delete
        from datetime import datetime, timedelta
        from models.database import EquipmentTelemetry, SystemMetric
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        async with get_db_context() as db:
            # Delete old equipment telemetry
            await db.execute(
                delete(EquipmentTelemetry).where(
                    EquipmentTelemetry.timestamp < cutoff_date
                )
            )
            
            # Delete old system metrics
            await db.execute(
                delete(SystemMetric).where(
                    SystemMetric.timestamp < cutoff_date
                )
            )
            
            await db.commit()
            logger.info(f"Cleaned up telemetry data older than {days} days")


# Export database dependency
__all__ = ["get_db", "init_db", "get_db_context", "DatabaseUtils"]