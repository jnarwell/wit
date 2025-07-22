#!/usr/bin/env python3
"""
Final working database initialization for W.I.T.
Uses the get_session dependency which handles connection automatically
"""

import asyncio
import sys
from datetime import datetime

async def main():
    print("🚀 W.I.T. Database Initialization (Final Version)")
    print("=" * 50)
    
    try:
        # Import the get_session function that handles connection automatically
        from services.database_services import get_session
        from auth.security import get_password_hash
        from sqlalchemy import text
        
        print("\n✅ Imports successful")
        
        # The get_session function will connect automatically if needed
        print("\n📝 Adding initial data...")
        
        async for session in get_session():
            try:
                # Check if admin exists
                result = await session.execute(
                    text("SELECT COUNT(*) FROM users WHERE username = 'admin'")
                )
                admin_exists = result.scalar() > 0
                
                if not admin_exists:
                    print("\n  👤 Creating admin user...")
                    
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
                    
                    print("    ✓ Admin user created")
                    print("    📧 Username: admin")
                    print("    🔑 Password: admin123")
                    
                    # Create sample project
                    print("\n  📁 Creating sample project...")
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
                    
                    print("    ✓ Sample project created")
                    
                    # Create sample tasks
                    print("\n  📋 Creating sample tasks...")
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
                    
                    print("    ✓ 3 sample tasks created")
                    
                    # Create sample team
                    print("\n  👥 Creating sample team...")
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
                    
                    print("    ✓ Sample team created")
                    
                    # Commit all changes
                    await session.commit()
                    
                    print("\n  ✅ All initial data created successfully!")
                    
                else:
                    print("\n  ✓ Admin user already exists - skipping data creation")
                
                # Show summary
                print("\n📊 Database Summary:")
                for table in ["users", "projects", "tasks", "teams"]:
                    result = await session.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    count = result.scalar()
                    print(f"  - {table}: {count} records")
                    
            finally:
                # Session will be closed automatically by the context manager
                break  # Exit the async for loop
                
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    print("\n" + "=" * 50)
    print("🎉 Database initialization complete!")
    print("\n📌 Next Steps:")
    print("1. Start the server: python3 dev_server.py")
    print("2. Visit API docs: http://localhost:8000/docs")
    print("3. Login with:")
    print("   - Username: admin")
    print("   - Password: admin123")
    print("\n💡 The backend is now ready for frontend development!")
    
    return 0

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))