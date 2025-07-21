"""
W.I.T. Enhanced Database Service

Additional database operations building on existing service
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from .database_services import DatabaseService
from models.database_models import (
    User, Equipment, Project, Job, Material, 
    CommandHistory, Telemetry, SafetyEvent
)

class EnhancedDatabaseService(DatabaseService):
    """Extended database service with specialized queries"""
    
    async def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username"""
        async with self.get_session() as session:
            query = select(User).where(User.username == username)
            result = await session.execute(query)
            return result.scalar_one_or_none()
    
    async def get_active_jobs(self, limit: int = 10) -> List[Job]:
        """Get currently active jobs"""
        async with self.get_session() as session:
            query = (
                select(Job)
                .where(Job.status.in_(["running", "paused"]))
                .order_by(Job.started_at.desc())
                .limit(limit)
            )
            result = await session.execute(query)
            return result.scalars().all()
    
    async def get_equipment_status_summary(self) -> Dict[str, int]:
        """Get summary of equipment by status"""
        async with self.get_session() as session:
            query = (
                select(Equipment.status, func.count(Equipment.id))
                .group_by(Equipment.status)
            )
            result = await session.execute(query)
            return dict(result.all())
    
    async def get_low_stock_materials(self) -> List[Material]:
        """Get materials that need restocking"""
        async with self.get_session() as session:
            query = (
                select(Material)
                .where(
                    or_(
                        Material.quantity <= Material.min_stock_level,
                        Material.min_stock_level.is_(None)
                    )
                )
                .order_by(Material.quantity)
            )
            result = await session.execute(query)
            return result.scalars().all()
    
    async def record_command(
        self,
        command: str,
        user_id: str,
        success: bool,
        **kwargs
    ) -> CommandHistory:
        """Record a voice command"""
        cmd = CommandHistory(
            command=command,
            user_id=user_id,
            success=success,
            timestamp=datetime.utcnow(),
            **kwargs
        )
        return await self.create(cmd)
    
    async def get_safety_events_unresolved(self) -> List[SafetyEvent]:
        """Get unresolved safety events"""
        async with self.get_session() as session:
            query = (
                select(SafetyEvent)
                .where(SafetyEvent.resolved == False)
                .order_by(SafetyEvent.severity.desc(), SafetyEvent.timestamp.desc())
            )
            result = await session.execute(query)
            return result.scalars().all()
    
    async def get_telemetry_summary(
        self,
        equipment_id: str,
        metric: str,
        hours: int = 24
    ) -> Dict[str, Any]:
        """Get telemetry summary statistics"""
        async with self.get_session() as session:
            start_time = datetime.utcnow() - timedelta(hours=hours)
            
            query = (
                select(
                    func.min(Telemetry.value).label("min"),
                    func.max(Telemetry.value).label("max"),
                    func.avg(Telemetry.value).label("avg"),
                    func.count(Telemetry.value).label("count")
                )
                .where(
                    and_(
                        Telemetry.equipment_id == equipment_id,
                        Telemetry.metric == metric,
                        Telemetry.time >= start_time
                    )
                )
            )
            result = await session.execute(query)
            row = result.one()
            
            return {
                "min": row.min,
                "max": row.max,
                "avg": float(row.avg) if row.avg else None,
                "count": row.count,
                "metric": metric,
                "equipment_id": equipment_id,
                "period_hours": hours
            }

# Create singleton instance
enhanced_db_service = EnhancedDatabaseService()
