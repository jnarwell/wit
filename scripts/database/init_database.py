"""
W.I.T. Database Initialization Script - SQLite Version

File: software/backend/init_database.py

Script to initialize the SQLite database
"""

import asyncio
import logging
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from config import settings
from services.database_service import init_database, db_service, DatabaseUtils
from alembic import command
from alembic.config import Config

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def check_database_connection():
    """Check if we can connect to the database"""
    try:
        logger.info(f"Checking database connection...")
        healthy = await db_service.health_check()
        if healthy:
            logger.info("✓ Database connection successful")
            return True
        else:
            logger.error("✗ Database connection failed")
            return False
    except Exception as e:
        logger.error(f"✗ Database connection error: {e}")
        return False


def run_alembic_migrations():
    """Run Alembic migrations (optional for SQLite)"""
    try:
        logger.info("Checking for migrations...")
        
        # For SQLite, we can skip Alembic and use create_all
        logger.info("Using SQLAlchemy create_all for SQLite")
        return True
        
    except Exception as e:
        logger.error(f"✗ Migration error: {e}")
        return False


async def create_sample_data():
    """Create some sample data for testing"""
    try:
        logger.info("Creating sample data...")
        
        from models.database_models_extended import User, Project, Task, Team
        from sqlalchemy import select
        
        async with db_service.session() as session:
            # Get admin user
            result = await session.execute(
                select(User).where(User.username == "admin")
            )
            admin_user = result.scalar_one_or_none()
            
            if admin_user:
                # Check if sample project exists
                project_result = await session.execute(
                    select(Project).where(Project.name == "Sample Project")
                )
                if not project_result.scalar_one_or_none():
                    # Create sample project
                    sample_project = Project(
                        project_id="PROJ-SAMPLE-001",
                        name="Sample Project",
                        description="A sample project to get you started",
                        type="software",
                        status="active",
                        owner_id=admin_user.id,
                        extra_data={
                            "team": "Engineering",
                            "priority": "medium",
                            "budget": 5000
                        }
                    )
                    session.add(sample_project)
                    await session.flush()
                    
                    # Create sample team
                    sample_team = Team(
                        team_id="TEAM-SAMPLE-001",
                        project_id=sample_project.id,
                        name="Development Team",
                        description="Main development team",
                        type="engineering"
                    )
                    session.add(sample_team)
                    
                    # Create sample tasks
                    tasks = [
                        Task(
                            task_id="TASK-SAMPLE-001",
                            project_id=sample_project.id,
                            title="Setup development environment",
                            description="Install dependencies and configure the project",
                            status="done",
                            priority="high",
                            position=0,
                            created_by=admin_user.id
                        ),
                        Task(
                            task_id="TASK-SAMPLE-002",
                            project_id=sample_project.id,
                            title="Design database schema",
                            description="Create the database models and relationships",
                            status="in_progress",
                            priority="high",
                            position=1,
                            created_by=admin_user.id
                        ),
                        Task(
                            task_id="TASK-SAMPLE-003",
                            project_id=sample_project.id,
                            title="Implement API endpoints",
                            description="Create RESTful API endpoints",
                            status="todo",
                            priority="medium",
                            position=2,
                            created_by=admin_user.id
                        )
                    ]
                    
                    for task in tasks:
                        session.add(task)
                    
                    await session.commit()
                    logger.info("✓ Sample data created")
                else:
                    logger.info("✓ Sample data already exists")
            
    except Exception as e:
        logger.error(f"✗ Error creating sample data: {e}")


async def show_database_stats():
    """Show database statistics"""
    try:
        logger.info("\nDatabase Statistics:")
        stats = await DatabaseUtils.get_table_stats()
        
        for table, info in stats.items():
            logger.info(f"  - {table}: {info['row_count']} rows")
            
    except Exception as e:
        logger.error(f"Error getting database stats: {e}")


async def main():
    """Main initialization function"""
    logger.info("=== W.I.T. Database Initialization (SQLite) ===\n")
    
    # Ensure we're using SQLite
    if not settings.DATABASE_URL.startswith("sqlite"):
        logger.warning(f"Database URL doesn't look like SQLite: {settings.DATABASE_URL}")
        logger.info("Forcing SQLite mode...")
        settings.DATABASE_URL = "sqlite:///data/wit_local.db"
    
    # Initialize database connection
    logger.info("Initializing database connection...")
    try:
        await init_database(settings.DATABASE_URL, echo=False)
        logger.info("✓ Database service initialized")
    except Exception as e:
        logger.error(f"✗ Failed to initialize database service: {e}")
        return 1
    
    # Check connection
    if not await check_database_connection():
        logger.error("\n✗ Cannot proceed without database connection")
        return 1
    
    # Run migrations (or create tables)
    if not run_alembic_migrations():
        logger.warning("Alembic migrations skipped (using create_all)")
    
    # Create sample data
    await create_sample_data()
    
    # Show statistics
    await show_database_stats()
    
    logger.info("\n✓ Database initialization completed successfully!")
    logger.info("\nYou can now start the backend server with:")
    logger.info("  python dev_server.py")
    logger.info("\nDefault admin credentials:")
    logger.info("  Username: admin")
    logger.info("  Password: changeme123")
    
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)