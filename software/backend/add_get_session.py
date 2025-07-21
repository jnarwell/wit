#!/usr/bin/env python3
"""Add the missing standalone get_session function"""

# Read the file
with open("services/database_services.py", "r") as f:
    content = f.read()

# Check if standalone get_session already exists
if "async def get_session()" in content and "yield session" in content:
    print("✅ Standalone get_session already exists")
else:
    # Add the missing imports and function
    additions = '''
# Imports for dependency injection
from typing import AsyncGenerator
import os

# Create a global database service instance
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./wit.db")
db_service = DatabaseService(DATABASE_URL)

# Standalone get_session function for FastAPI dependency injection
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Get database session - FastAPI dependency"""
    # Initialize if needed
    if not db_service.connected:
        await db_service.connect()
    
    async with db_service.get_session() as session:
        yield session
'''
    
    # Add to the end of file
    with open("services/database_services.py", "a") as f:
        f.write("\n" + additions)
    
    print("✅ Added standalone get_session function")

print("🚀 Now try: python dev_server.py")
