#!/usr/bin/env python3
"""Test database connectivity with SQLite"""
import asyncio
import os
import sys

# Add project to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Force SQLite mode
os.environ["WIT_DB_STORAGE_MODE"] = "local"

from software.backend.services.database_services import DatabaseService

async def test_connection():
    print("Testing SQLite database connection...")
    print(f"Database will be created at: data/wit_local.db")
    
    db = DatabaseService()
    try:
        await db.connect()
        print("✅ Database connection successful!")
        
        # Create tables
        print("Creating database tables...")
        await db.create_tables()
        print("✅ Tables created successfully!")
        
        # Test a simple query
        from software.backend.models.database_models import User
        users = await db.get_many(User, limit=1)
        print(f"✅ Query test successful! Found {len(users)} users")
        
        await db.disconnect()
        print("✅ Database disconnected cleanly")
        
        print("\n🎉 SQLite database is working perfectly!")
        print("   No Docker or external services needed!")
        
    except Exception as e:
        print(f"❌ Database operation failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_connection())
