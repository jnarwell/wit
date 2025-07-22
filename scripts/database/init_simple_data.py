#!/usr/bin/env python3
"""Simple data initialization"""
import asyncio
from sqlalchemy import text
from services.database_services import db_service
from config import settings
from auth.security import get_password_hash

async def init_data():
    """Initialize with raw SQL to avoid relationship issues"""
    await db_service.init(settings.DATABASE_URL)
    
    async with db_service.get_session() as session:
        try:
            # Create admin user
            admin_exists = await session.execute(
                text("SELECT COUNT(*) FROM users WHERE username = 'admin'")
            )
            if admin_exists.scalar() == 0:
                await session.execute(
                    text("""
                        INSERT INTO users (username, email, full_name, hashed_password, is_admin, is_active)
                        VALUES (:username, :email, :full_name, :hashed_password, :is_admin, :is_active)
                    """),
                    {
                        "username": "admin",
                        "email": "admin@wit.local",
                        "full_name": "Administrator",
                        "hashed_password": get_password_hash("admin123"),
                        "is_admin": True,
                        "is_active": True
                    }
                )
                print("✓ Admin user created")
                
                # Get admin ID
                result = await session.execute(
                    text("SELECT id FROM users WHERE username = 'admin'")
                )
                admin_id = result.scalar()
                
                # Create sample project
                await session.execute(
                    text("""
                        INSERT INTO projects (project_id, name, description, status, created_by)
                        VALUES (:project_id, :name, :description, :status, :created_by)
                    """),
                    {
                        "project_id": "PROJ-001",
                        "name": "Sample Workshop Project",
                        "description": "A sample project to get started",
                        "status": "active",
                        "created_by": admin_id
                    }
                )
                print("✓ Sample project created")
                
                await session.commit()
                print("✓ All initial data created!")
            else:
                print("✓ Admin user already exists")
                
        except Exception as e:
            print(f"Error: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(init_data())
