#!/usr/bin/env python3
"""
Add initial data to W.I.T. database
Simple approach using direct database operations
"""

import asyncio
import sys
from datetime import datetime

async def main():
    print("🚀 Adding Initial Data to W.I.T. Database")
    print("=" * 40)
    
    try:
        from services.database_services import db_service
        from config import settings
        from auth.security import get_password_hash
        from sqlalchemy import text
        
        # Initialize database connection
        await db_service.init(settings.DATABASE_URL)
        
        async with db_service.get_session() as session:
            # Check if admin exists
            result = await session.execute(
                text("SELECT COUNT(*) FROM users WHERE username = 'admin'")
            )
            admin_exists = result.scalar() > 0
            
            if not admin_exists:
                print("\n📝 Creating admin user...")
                
                # Insert admin user
                await session.execute(
                    text("""
                        INSERT INTO users (
                            username, email, full_name, hashed_password, 
                            is_admin, is_active, created_at, updated_at
                        )
                        VALUES (
                            :username, :email, :full_name, :hashed_password,
                            :is_admin, :is_active, :created_at, :updated_at
                        )
                    """),
                    {
                        "username": "admin",
                        "email": "admin@wit.local", 
                        "full_name": "Administrator",
                        "hashed_password": get_password_hash("admin123"),
                        "is_admin": True,
                        "is_active": True,
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    }
                )
                
                # Get admin ID
                result = await session.execute(
                    text("SELECT id FROM users WHERE username = 'admin'")
                )
                admin_id = result.scalar()
                
                print("  ✓ Admin user created (username: admin, password: admin123)")
                
                # Create sample project
                print("\n📁 Creating sample project...")
                await session.execute(
                    text("""
                        INSERT INTO projects (
                            project_id, name, description, status,
                            created_by, created_at, updated_at
                        )
                        VALUES (
                            :project_id, :name, :description, :status,
                            :created_by, :created_at, :updated_at
                        )
                    """),
                    {
                        "project_id": "PROJ-DEMO-001",
                        "name": "Demo Workshop Project",
                        "description": "A demonstration project showcasing W.I.T. capabilities",
                        "status": "active",
                        "created_by": admin_id,
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    }
                )
                
                # Get project ID
                result = await session.execute(
                    text("SELECT id FROM projects WHERE project_id = 'PROJ-DEMO-001'")
                )
                project_id = result.scalar()
                
                print("  ✓ Sample project created")
                
                # Create sample tasks
                print("\n📋 Creating sample tasks...")
                tasks = [
                    {
                        "task_id": "TASK-001",
                        "title": "Setup workshop environment",
                        "description": "Install and configure W.I.T. hardware",
                        "status": "done",
                        "priority": "high",
                        "position": 0
                    },
                    {
                        "task_id": "TASK-002",
                        "title": "Configure voice commands",
                        "description": "Setup Claude AI integration for voice control",
                        "status": "in_progress",
                        "priority": "high",
                        "position": 1
                    },
                    {
                        "task_id": "TASK-003",
                        "title": "Test equipment integration",
                        "description": "Verify all workshop equipment is connected",
                        "status": "todo",
                        "priority": "medium",
                        "position": 2
                    }
                ]
                
                for task in tasks:
                    await session.execute(
                        text("""
                            INSERT INTO tasks (
                                task_id, project_id, title, description,
                                status, priority, position, created_by,
                                created_at, updated_at
                            )
                            VALUES (
                                :task_id, :project_id, :title, :description,
                                :status, :priority, :position, :created_by,
                                :created_at, :updated_at
                            )
                        """),
                        {
                            **task,
                            "project_id": project_id,
                            "created_by": admin_id,
                            "created_at": datetime.utcnow(),
                            "updated_at": datetime.utcnow()
                        }
                    )
                
                print("  ✓ Sample tasks created")
                
                # Create sample team
                print("\n👥 Creating sample team...")
                await session.execute(
                    text("""
                        INSERT INTO teams (
                            team_id, project_id, name, description,
                            type, created_at, updated_at
                        )
                        VALUES (
                            :team_id, :project_id, :name, :description,
                            :type, :created_at, :updated_at
                        )
                    """),
                    {
                        "team_id": "TEAM-001",
                        "project_id": project_id,
                        "name": "Workshop Makers",
                        "description": "Core workshop team",
                        "type": "engineering",
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    }
                )
                
                print("  ✓ Sample team created")
                
                await session.commit()
                
                print("\n✅ All initial data created successfully!")
                
            else:
                print("\n✓ Admin user already exists - skipping data creation")
            
            # Show summary
            print("\n📊 Database Summary:")
            for table in ["users", "projects", "tasks", "teams"]:
                result = await session.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.scalar()
                print(f"  - {table}: {count} records")
                
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return 1
    
    print("\n🎉 Database is ready!")
    print("\nYou can now:")
    print("1. Start the server: python3 dev_server.py")
    print("2. Login with: admin / admin123")
    print("3. Access API docs: http://localhost:8000/docs")
    
    return 0

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))