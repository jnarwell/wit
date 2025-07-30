#!/usr/bin/env python3
"""
Debug login endpoint
"""
import asyncio
import sys
sys.path.insert(0, '.')

from sqlalchemy import select
from software.backend.services.database_services import get_session, User as DBUser
from software.backend.auth.security import verify_password

async def debug_login(username: str, password: str):
    """Debug the login process"""
    async for db in get_session():
        print(f"Attempting login for: {username}")
        
        # Query user
        stmt = select(DBUser).where(DBUser.username == username)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            print("User not found!")
            return
        
        print(f"User found: {user.username}")
        print(f"User ID: {user.id}")
        print(f"Email: {user.email}")
        print(f"Is Active: {user.is_active}")
        print(f"Hash starts with: {user.hashed_password[:20]}...")
        
        # Verify password
        is_valid = verify_password(password, user.hashed_password)
        print(f"\nPassword verification: {is_valid}")
        
        if not is_valid:
            print("Password verification failed!")
        elif not user.is_active:
            print("User is not active!")
        else:
            print("Login should succeed!")
        
        break

if __name__ == "__main__":
    username = sys.argv[1] if len(sys.argv) > 1 else "jamie"
    password = sys.argv[2] if len(sys.argv) > 2 else "12345"
    
    asyncio.run(debug_login(username, password))