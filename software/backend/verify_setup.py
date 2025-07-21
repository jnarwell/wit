#!/usr/bin/env python3
"""
Verify the setup is correct

File: software/backend/verify_setup.py
"""

import sys

print("Verifying setup...\n")

# Test imports
try:
    from models.database_models_extended import Base, User, Project, Task
    print("✓ Models import successful")
    print(f"  - Base type: {type(Base)}")
    print(f"  - User table: {User.__tablename__}")
except Exception as e:
    print(f"✗ Models import failed: {e}")
    sys.exit(1)

try:
    from auth.security import get_password_hash, verify_password
    print("✓ Auth security import successful")
    
    # Test password hashing
    test_pass = "test123"
    hashed = get_password_hash(test_pass)
    verified = verify_password(test_pass, hashed)
    print(f"  - Password hashing works: {verified}")
except Exception as e:
    print(f"✗ Auth security import failed: {e}")
    sys.exit(1)

try:
    from services.database_service import db_service, init_database
    print("✓ Database service import successful")
except Exception as e:
    print(f"✗ Database service import failed: {e}")
    sys.exit(1)

try:
    from config import settings
    print("✓ Config import successful")
    print(f"  - Database URL: {settings.DATABASE_URL}")
except Exception as e:
    print(f"✗ Config import failed: {e}")
    sys.exit(1)

print("\n✅ All imports successful! Ready to run init_database.py")