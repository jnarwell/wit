"""
W.I.T. Database Initializer

File: software/backend/scripts/initialize_database.py

This script creates the database and tables, and adds a default admin user.
"""

import asyncio
import logging
import sys
import os

# Add backend directory to the Python path
backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, backend_root)

from sqlalchemy import select
from services.database_services import get_session, Base, engine, User
from auth.security import get_password_hash

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def create_initial_data():
    """Creates the default admin user if one does not exist."""
    logger.info("Checking for initial data...")
    session = await anext(get_session())
    try:
        # Check if admin user exists
        result = await session.execute(select(User).where(User.username == "admin"))
        admin_exists = result.scalar_one_or_none()

        if not admin_exists:
            logger.info("Creating default admin user...")
            admin_user = User(
                username="admin",
                email="admin@wit.local",
                hashed_password=get_password_hash("admin"), # Set a default password
                is_admin=True,
                is_active=True
            )
            session.add(admin_user)
            await session.commit()
            logger.info("Default admin user created successfully.")
        else:
            logger.info("Admin user already exists.")
    finally:
        await session.close()

async def main():
    """Main function to initialize the database."""
    logger.info("--- Starting Database Initialization ---")
    try:
        # Create all tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created successfully.")
        
        # Add initial data
        await create_initial_data()
        
        logger.info("--- Database Initialization Complete ---")
    except Exception as e:
        logger.error(f"An error occurred during database initialization: {e}", exc_info=True)
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
