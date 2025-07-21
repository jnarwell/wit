#!/usr/bin/env python3
"""
Fix the database service async context manager issue

File: software/backend/fix_database_service.py
"""

# Read the current database service
with open("services/database_service.py", "r") as f:
    content = f.read()

# Fix the async context manager issues
content = content.replace(
    "async with self.get_session() as session:",
    "async with self.session() as session:"
)

# Write it back
with open("services/database_service.py", "w") as f:
    f.write(content)

print("✓ Fixed database service")
print("\nNow run: python init_database.py")