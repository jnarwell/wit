#!/usr/bin/env python3
"""
Fix User model relationships in W.I.T. Backend
"""

import os
import re
import sys

def fix_relationships():
    """Fix the User model relationships issue"""
    print("🔧 Fixing User model relationships...")
    
    # Find the database models file
    model_files = [
        "models/database_models.py",
        "models/database_models_extended.py"
    ]
    
    fixed_count = 0
    
    for model_file in model_files:
        if not os.path.exists(model_file):
            continue
            
        print(f"\n📝 Checking {model_file}...")
        
        with open(model_file, 'r') as f:
            content = f.read()
        
        original_content = content
        
        # Fix User.files_uploaded relationship
        # Look for the problematic relationship
        pattern = r'(files_uploaded\s*=\s*relationship\([^)]+)\)'
        
        def fix_relationship(match):
            rel_def = match.group(1)
            # If foreign_keys not specified, add it
            if 'foreign_keys' not in rel_def:
                # Add foreign_keys parameter
                return rel_def + ', foreign_keys="[ProjectFile.uploaded_by]")'
            return match.group(0)
        
        content = re.sub(pattern, fix_relationship, content)
        
        # Also fix any other User relationships that might have similar issues
        # Fix tasks_created relationship
        pattern2 = r'(tasks_created\s*=\s*relationship\([^)]+)\)'
        def fix_tasks(match):
            rel_def = match.group(1)
            if 'foreign_keys' not in rel_def:
                return rel_def + ', foreign_keys="[Task.created_by]")'
            return match.group(0)
        
        content = re.sub(pattern2, fix_tasks, content)
        
        # Fix tasks_assigned relationship  
        pattern3 = r'(tasks_assigned\s*=\s*relationship\([^)]+)\)'
        def fix_assigned(match):
            rel_def = match.group(1)
            if 'foreign_keys' not in rel_def:
                return rel_def + ', foreign_keys="[Task.assigned_to]")'
            return match.group(0)
        
        content = re.sub(pattern3, fix_assigned, content)
        
        if content != original_content:
            # Backup original
            with open(f"{model_file}.backup", 'w') as f:
                f.write(original_content)
            
            # Write fixed content
            with open(model_file, 'w') as f:
                f.write(content)
            
            print(f"  ✓ Fixed relationships in {model_file}")
            fixed_count += 1
    
    return fixed_count


def create_simple_init_data():
    """Create initial data with a simpler approach"""
    print("\n🗄️  Creating initial data (simple approach)...")
    
    init_script = '''#!/usr/bin/env python3
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
'''
    
    with open("init_simple_data.py", "w") as f:
        f.write(init_script)
    
    print("  ✓ Created init_simple_data.py")


def main():
    print("🚀 Fixing W.I.T. Database Relationship Issues")
    print("=" * 50)
    
    # Fix the relationships
    fixed = fix_relationships()
    
    if fixed > 0:
        print(f"\n✅ Fixed {fixed} model file(s)")
        print("\nNow you need to:")
        print("1. Delete the existing database: rm data/wit_local.db")
        print("2. Run init again: python3 init_database.py")
    else:
        print("\n⚠️  No model files found to fix")
        print("Creating a simple initialization script instead...")
        
    # Create simple init script regardless
    create_simple_init_data()
    
    print("\nAlternatively, you can run:")
    print("  python3 init_simple_data.py")
    print("\nThis will add the initial data using direct SQL.")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())