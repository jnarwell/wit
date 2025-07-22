#!/usr/bin/env python3
"""
Debug authentication endpoint to understand why login is failing
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("🔍 Debugging Authentication Endpoint")
print("=" * 50)

# Test 1: Check if admin user exists and password works
print("\n1️⃣ Testing database directly...")
import sqlite3
from auth.security import verify_password

conn = sqlite3.connect('data/wit_local.db')
cursor = conn.cursor()

cursor.execute("SELECT id, username, email, hashed_password, is_admin, is_active FROM users WHERE username = 'admin'")
admin = cursor.fetchone()

if admin:
    print(f"✅ Admin user found:")
    print(f"  ID: {admin[0]}")
    print(f"  Username: {admin[1]}")
    print(f"  Email: {admin[2]}")
    print(f"  Is Admin: {admin[4]}")
    print(f"  Is Active: {admin[5]}")
    
    # Test password
    if verify_password("admin123", admin[3]):
        print(f"  ✅ Password verification: WORKS")
    else:
        print(f"  ❌ Password verification: FAILED")
else:
    print("❌ No admin user found!")

conn.close()

# Test 2: Check the auth dependency
print("\n2️⃣ Testing auth dependencies...")
try:
    from auth.dependencies import get_current_user, authenticate_user
    print("✅ Auth dependencies imported")
    
    # Test authenticate_user function if it exists
    if 'authenticate_user' in locals():
        print("\n  Testing authenticate_user function...")
        # This would need the database session
except Exception as e:
    print(f"❌ Auth dependencies error: {e}")

# Test 3: Check the login endpoint directly
print("\n3️⃣ Checking login endpoint code...")
try:
    from routers.auth_router import login
    print("✅ Login function imported")
    
    # Check what the login function expects
    import inspect
    sig = inspect.signature(login)
    print(f"  Function signature: {sig}")
    
except Exception as e:
    print(f"❌ Cannot import login function: {e}")

# Test 4: Check OAuth2 form parsing
print("\n4️⃣ Testing form data parsing...")
from fastapi.security import OAuth2PasswordRequestForm

# Simulate form data
class FakeForm:
    def __init__(self):
        self.username = "admin"
        self.password = "admin123"
        self.grant_type = "password"
        self.scopes = []
        self.client_id = None
        self.client_secret = None

form = FakeForm()
print(f"  Username: {form.username}")
print(f"  Password: {form.password}")

# Test 5: Trace through authentication flow
print("\n5️⃣ Tracing authentication flow...")
try:
    # Import the actual authentication logic
    import asyncio
    from services.database_services import get_session
    
    async def test_auth_flow():
        # Get database session
        async for db_session in get_session():
            try:
                # Try to authenticate
                from sqlalchemy import select
                from models.database_models import User
                
                # Query for user
                stmt = select(User).where(User.username == "admin")
                result = await db_session.execute(stmt)
                user = result.scalar_one_or_none()
                
                if user:
                    print(f"  ✅ User found via SQLAlchemy: {user.username}")
                    print(f"     Email: {user.email}")
                    print(f"     Is Active: {user.is_active}")
                    
                    # Test password
                    if verify_password("admin123", user.hashed_password):
                        print(f"  ✅ Password matches!")
                    else:
                        print(f"  ❌ Password doesn't match")
                        print(f"     Stored hash: {user.hashed_password[:50]}...")
                else:
                    print(f"  ❌ User not found via SQLAlchemy")
                    
            finally:
                await db_session.close()
                break
    
    # Run the async test
    asyncio.run(test_auth_flow())
    
except Exception as e:
    print(f"  ❌ Error in auth flow: {e}")
    import traceback
    traceback.print_exc()

# Test 6: Check if there's a mismatch in expectations
print("\n6️⃣ Checking for common issues...")

# Check if is_active needs to be True/False vs 1/0
print("\n  Checking boolean handling...")
conn = sqlite3.connect('data/wit_local.db')
cursor = conn.cursor()
cursor.execute("SELECT typeof(is_active), typeof(is_admin) FROM users WHERE username = 'admin'")
types = cursor.fetchone()
if types:
    print(f"  is_active type: {types[0]}")
    print(f"  is_admin type: {types[1]}")
conn.close()

print("\n" + "=" * 50)
print("💡 Next steps based on findings above")