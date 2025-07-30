#!/usr/bin/env python3
"""
Test login with detailed debugging
"""
import sys
sys.path.insert(0, '.')

import asyncio
from sqlalchemy import select
from software.backend.services.database_services import get_session, User as DBUser
from software.backend.auth.security import verify_password

async def test_login_detailed(username: str, password: str):
    """Test login with detailed debugging"""
    print(f"Testing login for: {username}")
    print(f"Password: {password}")
    
    try:
        async for db in get_session():
            print("\n1. Database session obtained")
            
            # Query user
            stmt = select(DBUser).where(DBUser.username == username)
            print(f"2. Query: SELECT * FROM users WHERE username = '{username}'")
            
            result = await db.execute(stmt)
            user = result.scalar_one_or_none()
            
            if not user:
                print("3. ❌ User not found!")
                return
            
            print(f"3. ✅ User found:")
            print(f"   - ID: {user.id}")
            print(f"   - Username: {user.username}")
            print(f"   - Email: {user.email}")
            print(f"   - Is Active: {user.is_active}")
            print(f"   - Hash: {user.hashed_password[:30]}...")
            
            # Verify password
            print(f"\n4. Verifying password...")
            is_valid = verify_password(password, user.hashed_password)
            print(f"   Result: {is_valid}")
            
            if not is_valid:
                print("   ❌ Password verification failed!")
                
                # Double check with a fresh hash
                from software.backend.auth.security import get_password_hash
                fresh_hash = get_password_hash(password)
                print(f"\n5. Fresh hash for '{password}': {fresh_hash[:30]}...")
                print(f"   Fresh hash matches stored: {fresh_hash == user.hashed_password}")
                
                # Try with passlib directly
                from passlib.context import CryptContext
                pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
                direct_verify = pwd_context.verify(password, user.hashed_password)
                print(f"   Direct passlib verify: {direct_verify}")
            else:
                print("   ✅ Password is valid!")
                
            break
            
    except Exception as e:
        print(f"\n❌ Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    username = sys.argv[1] if len(sys.argv) > 1 else "testuser123"
    password = sys.argv[2] if len(sys.argv) > 2 else "TestPass123!"
    
    asyncio.run(test_login_detailed(username, password))