#!/usr/bin/env python3
"""Simple test to verify API setup"""

print("Testing WIT API setup...")

# Test basic imports
try:
    from api.projects_api import router as projects_router
    print("✅ Projects API imported")
except Exception as e:
    print(f"❌ Projects API failed: {e}")

try:
    from api.terminal_api import router as terminal_router
    print("✅ Terminal API imported")
except Exception as e:
    print(f"❌ Terminal API failed: {e}")

try:
    from services.database_services import User, Project
    print("✅ Database models imported")
except Exception as e:
    print(f"❌ Database models failed: {e}")

print("\n✨ Basic test completed!")
print("\nTo run the server:")
print("  python dev_server.py")