#!/usr/bin/env python3
"""
Patch database service to fix SQLite pooling issue
"""

import os

def patch_database_service():
    print("🔧 Patching database service for SQLite compatibility...")
    
    db_file = "services/database_services.py"
    
    # Read the current file
    with open(db_file, 'r') as f:
        lines = f.readlines()
    
    # Create backup
    with open(f"{db_file}.backup", 'w') as f:
        f.writelines(lines)
    print(f"✓ Created backup: {db_file}.backup")
    
    # Find and fix the problematic line
    modified = False
    for i, line in enumerate(lines):
        # Look for the create_async_engine line in connect method
        if 'self.engine = create_async_engine(' in line:
            print(f"Found engine creation at line {i+1}")
            
            # Get indentation
            indent = len(line) - len(line.lstrip())
            indent_str = ' ' * indent
            
            # Replace the engine creation block
            # Find the end of the create_async_engine call
            j = i
            while j < len(lines) and ')' not in lines[j]:
                j += 1
            
            # Replace with conditional creation
            new_lines = [
                f"{indent_str}# Check if using SQLite\n",
                f"{indent_str}if self.database_url.startswith('sqlite'):\n",
                f"{indent_str}    # SQLite doesn't support pooling\n",
                f"{indent_str}    self.engine = create_async_engine(\n",
                f"{indent_str}        self.database_url,\n",
                f"{indent_str}        echo=False,\n",
                f"{indent_str}        future=True\n",
                f"{indent_str}    )\n",
                f"{indent_str}else:\n",
                f"{indent_str}    # PostgreSQL/MySQL support pooling\n",
                f"{indent_str}    self.engine = create_async_engine(\n",
                f"{indent_str}        self.database_url,\n",
                f"{indent_str}        echo=False,\n",
                f"{indent_str}        future=True,\n",
                f"{indent_str}        pool_size=10,\n",
                f"{indent_str}        max_overflow=20,\n",
                f"{indent_str}        pool_pre_ping=True,\n",
                f"{indent_str}        pool_recycle=3600\n",
                f"{indent_str}    )\n"
            ]
            
            # Replace the lines
            lines[i:j+1] = new_lines
            modified = True
            break
    
    if modified:
        # Write the patched file
        with open(db_file, 'w') as f:
            f.writelines(lines)
        print("✓ Patched database service successfully!")
        return True
    else:
        print("❌ Could not find the line to patch")
        return False


def alternative_fix():
    """Alternative: Create a wrapper for database initialization"""
    print("\n🔧 Creating alternative database initialization wrapper...")
    
    wrapper_content = '''#!/usr/bin/env python3
"""
SQLite-compatible database initialization
"""

import asyncio
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

async def init_sqlite_db():
    """Initialize SQLite database with sample data"""
    print("🚀 SQLite Database Initialization")
    print("=" * 40)
    
    # Create engine without pooling parameters
    engine = create_async_engine(
        "sqlite+aiosqlite:///data/wit_local.db",
        echo=False,
        future=True
    )
    
    # Create session maker
    async_session = sessionmaker(
        engine, 
        class_=AsyncSession, 
        expire_on_commit=False
    )
    
    # Import models to create tables
    from models.database_models import Base
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print("✓ Tables created")
    
    # Add initial data
    from auth.security import get_password_hash
    
    async with async_session() as session:
        try:
            # Check if admin exists
            result = await session.execute(
                text("SELECT COUNT(*) FROM users WHERE username = 'admin'")
            )
            admin_exists = result.scalar() > 0
            
            if not admin_exists:
                print("\\n📝 Creating initial data...")
                
                # Create admin user
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
                
                print("  ✓ Admin user created (admin/admin123)")
                
                # Create sample project
                await session.execute(
                    text("""
                        INSERT INTO projects (
                            project_id, name, description, status,
                            created_by, created_at, updated_at
                        )
                        VALUES (
                            'PROJ-DEMO-001', 'Demo Workshop Project',
                            'A demonstration project', 'active',
                            :admin_id, :created_at, :updated_at
                        )
                    """),
                    {
                        "admin_id": admin_id,
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    }
                )
                
                print("  ✓ Sample project created")
                
                await session.commit()
                print("\\n✅ Database initialized successfully!")
                
            else:
                print("\\n✓ Admin user already exists")
                
            # Show summary
            print("\\n📊 Database Summary:")
            for table in ["users", "projects", "tasks", "teams"]:
                result = await session.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.scalar()
                print(f"  - {table}: {count} records")
                
        finally:
            await engine.dispose()
    
    print("\\n✅ Done! You can now start the server: python3 dev_server.py")

if __name__ == "__main__":
    asyncio.run(init_sqlite_db())
'''
    
    with open("init_sqlite_db.py", "w") as f:
        f.write(wrapper_content)
    
    print("✓ Created init_sqlite_db.py")
    print("\nRun: python3 init_sqlite_db.py")


if __name__ == "__main__":
    # Try to patch first
    if not patch_database_service():
        # If patching fails, create alternative
        alternative_fix()
    else:
        print("\n✅ Database service patched!")
        print("\nNow run: python3 final_db_init.py")