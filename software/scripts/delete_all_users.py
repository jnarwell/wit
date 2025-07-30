#!/usr/bin/env python3
"""
Script to delete all user accounts from the database.
WARNING: This will delete ALL users and their associated data!
"""

import asyncio
import sys
from pathlib import Path

# Add the project root to the Python path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from software.backend.services.database_services import (
    get_session, 
    User, 
    Project, 
    Task, 
    TeamMember,
    Equipment,
    engine
)

async def delete_all_users():
    """Delete all users and their associated data"""
    async with AsyncSession(engine) as session:
        try:
            # First, let's see how many users we have
            result = await session.execute(select(User))
            users = result.scalars().all()
            
            if not users:
                print("No users found in the database.")
                return
            
            print(f"Found {len(users)} users:")
            for user in users:
                print(f"  - {user.username} ({user.email})")
            
            # Confirm deletion
            confirm = input("\nAre you sure you want to delete ALL users and their data? (yes/no): ")
            if confirm.lower() != 'yes':
                print("Deletion cancelled.")
                return
            
            print("\nDeleting all user data...")
            
            # Delete in order of dependencies
            # 1. Delete team members
            await session.execute(delete(TeamMember))
            print("✓ Deleted all team members")
            
            # 2. Delete tasks (they reference projects)
            await session.execute(delete(Task))
            print("✓ Deleted all tasks")
            
            # 3. Delete projects
            await session.execute(delete(Project))
            print("✓ Deleted all projects")
            
            # 4. Delete equipment
            await session.execute(delete(Equipment))
            print("✓ Deleted all equipment")
            
            # 5. Finally, delete users
            await session.execute(delete(User))
            print("✓ Deleted all users")
            
            # Commit all changes
            await session.commit()
            
            print("\n✅ Successfully deleted all users and their associated data!")
            
        except Exception as e:
            await session.rollback()
            print(f"\n❌ Error deleting users: {e}")
            raise

async def main():
    """Main function"""
    print("=== W.I.T. User Deletion Script ===")
    print("WARNING: This will permanently delete ALL users and their data!")
    print()
    
    await delete_all_users()

if __name__ == "__main__":
    asyncio.run(main())