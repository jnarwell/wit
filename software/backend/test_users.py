#!/usr/bin/env python3
"""Test to check what users exist in dev_server"""
import sys
sys.path.insert(0, '.')

from dev_server import users_db

print("Users in dev_server users_db:")
for username, user_data in users_db.items():
    print(f"  - {username}: email={user_data.get('email')}, is_admin={user_data.get('is_admin')}")