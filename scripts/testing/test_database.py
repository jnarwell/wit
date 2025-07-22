"""
W.I.T. Database Test Script

File: software/backend/test_database.py

Test database connections and basic operations
"""

import pytest
import os
import asyncio
import logging
from datetime import datetime
from pathlib import Path
import sys

# Add parent directory to path


from software.backend.config import settings
from software.backend.services.database_service_complete import db_service, init_database
from software.backend.models.database_models_extended import (
    User, Project, Task, Material, Team, Equipment, Job, Tag, Comment, TeamMember, ProjectMaterial, MaterialUsage, ProjectFile, FileVersion
)
from sqlalchemy import select, func

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@pytest.fixture(scope="module")
async def db_session():
    """Fixture for database session"""
    logger.info("Initializing database for tests...")
    db_url = settings.DATABASE_URL
    if not os.getenv("TEST_DATABASE", "false").lower() == "true":
        db_url = "sqlite+aiosqlite:///:memory:"
    await init_database(db_url, echo=False)
    logger.info("Database initialized.")
    
    async with db_service.session() as session:
        yield session
    
    logger.info("Closing database connections...")
    await db_service.close()
    logger.info("Database connections closed.")


@pytest.mark.asyncio
async def test_database_connection(db_session):
    """Test basic database connection"""
    logger.info("Testing database connection...")
    
    try:
        healthy = await db_service.health_check()
        if healthy:
            logger.info("✓ Database connection successful")
            return True
        else:
            logger.error("✗ Database connection failed")
            return False
    except Exception as e:
        logger.error(f"✗ Connection error: {e}")
        return False


@pytest.mark.asyncio
async def test_user_operations(db_session):
    """Test user CRUD operations"""
    logger.info("Testing user operations...")
    
    async with db_session as session:
        try:
            # Create test user
            test_user = User(
                username="testuser",
                email="test@example.com",
                hashed_password="hashed_password_here",
                is_active=True
            )
            session.add(test_user)
            await session.commit()
            logger.info("✓ User created successfully")
            
            # Query user
            result = await session.execute(
                select(User).where(User.username == "testuser")
            )
            user = result.scalar_one_or_none()
            
            if user:
                logger.info(f"✓ User found: {user.username} ({user.email})")
            else:
                logger.error("✗ User not found")
                
            # Update user
            user.last_login = datetime.utcnow()
            await session.commit()
            logger.info("✓ User updated successfully")
            
            # Delete user
            await session.delete(user)
            await session.commit()
            logger.info("✓ User deleted successfully")
            
            return True
            
        except Exception as e:
            logger.error(f"✗ User operations error: {e}")
            return False


@pytest.mark.asyncio
async def test_project_operations(db_session):
    """Test project and related operations"""
    logger.info("Testing project operations...")
    
    async with db_session as session:
        try:
            # Get admin user
            result = await session.execute(
                select(User).where(User.username == "admin")
            )
            admin_user = result.scalar_one_or_none()
            
            if not admin_user:
                logger.error("✗ Admin user not found")
                return False
            
            # Create project
            project = Project(
                project_id=f"TEST-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                name="Test Project",
                description="Database test project",
                type="software",
                status="active",
                owner_id=admin_user.id,
                extra_data={
                    "team": "Engineering",
                    "priority": "high",
                    "budget": 10000
                }
            )
            session.add(project)
            await session.commit()
            logger.info("✓ Project created successfully")
            
            # Create team
            team = Team(
                team_id=f"TEAM-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                project_id=project.id,
                name="Development Team",
                type="engineering"
            )
            session.add(team)
            await session.commit()
            logger.info("✓ Team created successfully")
            
            # Add team member
            member = TeamMember(
                team_id=team.id,
                user_id=admin_user.id,
                role="lead"
            )
            session.add(member)
            await session.commit()
            logger.info("✓ Team member added successfully")
            
            # Create tasks
            tasks = []
            for i in range(3):
                task = Task(
                    task_id=f"TASK-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{i}",
                    project_id=project.id,
                    title=f"Test Task {i+1}",
                    description=f"Description for task {i+1}",
                    status="todo",
                    priority="medium",
                    position=i,
                    created_by=admin_user.id
                )
                tasks.append(task)
                session.add(task)
            
            await session.commit()
            logger.info(f"✓ {len(tasks)} tasks created successfully")
            
            # Query project with relationships
            result = await session.execute(
                select(Project)
                .where(Project.id == project.id)
                .options(
                    selectinload(Project.tasks),
                    selectinload(Project.teams).selectinload(Team.members)
                )
            )
            loaded_project = result.scalar_one_or_none()
            
            if loaded_project:
                logger.info(f"✓ Project loaded with {len(loaded_project.tasks)} tasks")
                logger.info(f"✓ Project has {len(loaded_project.teams)} teams")
            
            # Clean up
            await session.delete(project)  # Cascading delete should remove related records
            await session.commit()
            logger.info("✓ Project and related data deleted successfully")
            
            return True
            
        except Exception as e:
            logger.error(f"✗ Project operations error: {e}")
            await session.rollback()
            return False


@pytest.mark.asyncio
async def test_statistics(db_session):
    """Test database statistics"""
    logger.info("Gathering database statistics...")
    
    async with db_session as session:
        try:
            # Count records in each table
            tables = [
                (User, "Users"),
                (Project, "Projects"),
                (Task, "Tasks"),
                (Team, "Teams"),
                (Material, "Materials")
            ]
            
            for model, name in tables:
                result = await session.execute(
                    select(func.count()).select_from(model)
                )
                count = result.scalar()
                logger.info(f"  {name}: {count} records")
            
            return True
            
        except Exception as e:
            logger.error(f"✗ Statistics error: {e}")
            return False



