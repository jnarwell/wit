#!/usr/bin/env python3
"""Fix jamie user by adding directly to users_db"""
import sys
sys.path.insert(0, '.')

from dev_server import users_db, add_user

print("Current users:")
for username in users_db.keys():
    print(f"  - {username}")

# Add jamie if not exists
if "jamie" not in users_db:
    print("\nAdding jamie user...")
    add_user("jamie", "test123", "jamie@example.com", is_admin=False)
    print("✅ Jamie user added!")
else:
    print("\n✅ Jamie user already exists!")

print("\nUsers after update:")
for username in users_db.keys():
    print(f"  - {username}")