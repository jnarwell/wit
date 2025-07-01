#!/usr/bin/env python3
"""Test database connectivity"""
import asyncio
import os
from software.backend.services.database_services import DatabaseService

async def test_connection():
    # Get database URL from environment or use default
    db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost/wit_db")
    
    db = DatabaseService(db_url)
    try:
        await db.connect()
        print("✅ Database connection successful!")
        print(f"   Connected to: {db_url}")
        await db.disconnect()
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print(f"   Attempted URL: {db_url}")
        print("\n💡 Make sure PostgreSQL is running:")
        print("   docker-compose up -d postgres")

if __name__ == "__main__":
    asyncio.run(test_connection())
