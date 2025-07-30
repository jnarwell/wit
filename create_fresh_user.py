#!/usr/bin/env python3
"""
Create a fresh test user with unified password context
"""
import sys
sys.path.insert(0, '.')

# Use ONLY the backend auth.security module
from software.backend.auth.security import get_password_hash
import sqlite3
import uuid

# Clear any existing test users
conn = sqlite3.connect('wit.db')
cursor = conn.cursor()
cursor.execute("DELETE FROM users WHERE username IN ('freshtest', 'testauth')")
conn.commit()

# Create a new test user
username = "freshtest"
password = "fresh123"
email = "fresh@test.com"

print(f"Creating user {username} with password {password}")
hashed = get_password_hash(password)
print(f"Hash: {hashed[:40]}...")

# Insert directly
user_id = str(uuid.uuid4()).replace('-', '')
cursor.execute("""
    INSERT INTO users (id, username, email, hashed_password, is_active, is_admin, created_at)
    VALUES (?, ?, ?, ?, 1, 0, datetime('now'))
""", (user_id, username, email, hashed))
conn.commit()

print(f"User created with ID: {user_id}")
conn.close()

# Now test login
print("\nTesting login...")
import requests
response = requests.post(
    "http://localhost:8000/api/v1/auth/token",
    data={"username": username, "password": password},
    headers={"Content-Type": "application/x-www-form-urlencoded"}
)
print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")

if response.status_code == 200:
    print("\n✅ AUTH SYSTEM FIXED!")
else:
    print("\n❌ Still broken...")