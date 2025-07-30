#!/usr/bin/env python3
"""
Activate a user account manually
"""
import asyncio
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from software.backend.services.database_services import get_session, User

async def activate_user(username: str):
    """Activate a user by username"""
    async for db in get_session():
        # Find user
        result = await db.execute(
            select(User).where(User.username == username)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            print(f"User '{username}' not found")
            return
        
        if user.is_active:
            print(f"User '{username}' is already active")
            return
        
        # Activate user
        user.is_active = True
        await db.commit()
        
        print(f"User '{username}' has been activated!")
        print(f"Email: {user.email}")
        print(f"You can now login with username: {username}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python activate_user.py <username>")
        sys.exit(1)
    
    username = sys.argv[1]
    asyncio.run(activate_user(username))