"""
W.I.T. Database Test Script

File: software/backend/test_database.py

Test database connections and basic operations
"""

import asyncio
import logging
from datetime import datetime
from pathlib import Path
import sys

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from config import settings
from services.database_service_complete import db_service, init_database
from models.database_models_extended import (
    User, Project, Task, Team, TeamMember, 
    Material, ProjectMaterial, ProjectFile
)
from sqlalchemy import select, func

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_database_connection():
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


async def test_user_operations():
    """Test user CRUD operations"""
    logger.info("\nTesting user operations...")
    
    async with db_service.session() as session:
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


async def test_project_operations():
    """Test project and related operations"""
    logger.info("\nTesting project operations...")
    
    async with db_service.session() as session:
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


async def test_statistics():
    """Test database statistics"""
    logger.info("\nGathering database statistics...")
    
    async with db_service.session() as session:
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


async def main():
    """Run all tests"""
    logger.info("=== W.I.T. Database Tests ===\n")
    
    # Initialize database
    try:
        await init_database(settings.DATABASE_URL, echo=False)
        logger.info("✓ Database initialized")
    except Exception as e:
        logger.error(f"✗ Failed to initialize database: {e}")
        return 1
    
    # Run tests
    tests = [
        ("Connection Test", test_database_connection),
        ("User Operations", test_user_operations),
        ("Project Operations", test_project_operations),
        ("Statistics", test_statistics)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = await test_func()
            results.append((test_name, result))
        except Exception as e:
            logger.error(f"✗ {test_name} failed with error: {e}")
            results.append((test_name, False))
    
    # Summary
    logger.info("\n=== Test Summary ===")
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✓ PASSED" if result else "✗ FAILED"
        logger.info(f"{test_name}: {status}")
    
    logger.info(f"\nTotal: {passed}/{total} tests passed")
    
    # Close database
    await db_service.close()
    
    return 0 if passed == total else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)