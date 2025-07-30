#!/usr/bin/env python3
"""
Comprehensive auth system diagnostic
"""
import sys
import os
sys.path.insert(0, '.')

print("AUTH SYSTEM DIAGNOSTIC")
print("=" * 60)

# 1. Check imports
print("\n1. CHECKING IMPORTS...")
try:
    from software.backend.auth.security import verify_password, get_password_hash
    print("   ✅ Backend auth.security imported")
except Exception as e:
    print(f"   ❌ Failed to import backend auth.security: {e}")

try:
    from software.backend.services.database_services import User, get_session
    print("   ✅ Database services imported")
except Exception as e:
    print(f"   ❌ Failed to import database services: {e}")

try:
    from software.frontend.web.routers.auth_router import router
    print("   ✅ Frontend auth router imported")
except Exception as e:
    print(f"   ❌ Failed to import frontend auth router: {e}")

# 2. Test password hashing
print("\n2. TESTING PASSWORD HASHING...")
test_password = "test123"
try:
    hash1 = get_password_hash(test_password)
    print(f"   Hash created: {hash1[:30]}...")
    
    is_valid = verify_password(test_password, hash1)
    print(f"   Verification: {'✅ PASS' if is_valid else '❌ FAIL'}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# 3. Check database
print("\n3. CHECKING DATABASE...")
import sqlite3
conn = sqlite3.connect('wit.db')
cursor = conn.cursor()

# Check schema
cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
schema = cursor.fetchone()
if schema:
    print("   ✅ Users table exists")
    print(f"   Schema: {schema[0]}")
else:
    print("   ❌ Users table missing!")

# Check users
cursor.execute("SELECT COUNT(*) FROM users")
count = cursor.fetchone()[0]
print(f"   Total users: {count}")

cursor.execute("SELECT username, email, is_active, LENGTH(hashed_password) as hash_len FROM users")
for user in cursor.fetchall():
    print(f"   - {user[0]} ({user[1]}) Active:{user[2]} HashLen:{user[3]}")

conn.close()

# 4. Check environment
print("\n4. CHECKING ENVIRONMENT...")
print(f"   Python: {sys.version}")
print(f"   Working dir: {os.getcwd()}")
print(f"   Script location: {os.path.abspath(__file__)}")

# 5. Test actual modules being used
print("\n5. MODULE LOCATIONS...")
import importlib
modules = [
    'software.backend.auth.security',
    'software.backend.services.database_services',
    'software.frontend.web.routers.auth_router'
]
for mod_name in modules:
    try:
        mod = importlib.import_module(mod_name)
        print(f"   {mod_name}: {getattr(mod, '__file__', 'built-in')}")
    except:
        print(f"   {mod_name}: NOT FOUND")

# 6. Check for multiple password contexts
print("\n6. CHECKING FOR CONFLICTING PASSWORD CONTEXTS...")
try:
    from software.backend.auth.security import pwd_context as backend_pwd
    from software.backend.services.auth_services import pwd_context as services_pwd
    print(f"   Backend context: {backend_pwd}")
    print(f"   Services context: {services_pwd}")
    print(f"   Same object: {backend_pwd is services_pwd}")
except Exception as e:
    print(f"   Could not compare contexts: {e}")

print("\n" + "=" * 60)
print("DIAGNOSTIC COMPLETE")