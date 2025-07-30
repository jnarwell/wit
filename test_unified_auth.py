#!/usr/bin/env python3
"""
Test with unified auth approach
"""
import sys
sys.path.insert(0, '.')

# Use ONLY the backend auth.security module
from software.backend.auth.security import get_password_hash, verify_password

import sqlite3

# Clear any existing test user
conn = sqlite3.connect('wit.db')
cursor = conn.cursor()
cursor.execute("DELETE FROM users WHERE username IN ('testauth', 'testuser')")
conn.commit()

# Create a new test user with known password
username = "testauth"
password = "testpass123"
email = "testauth@example.com"

print("Creating test user...")
hashed = get_password_hash(password)
print(f"Hash: {hashed[:40]}...")

# Insert directly
import uuid
user_id = str(uuid.uuid4()).replace('-', '')
cursor.execute("""
    INSERT INTO users (id, username, email, hashed_password, is_active, is_admin, created_at)
    VALUES (?, ?, ?, ?, 1, 0, datetime('now'))
""", (user_id, username, email, hashed))
conn.commit()

# Verify it's there
cursor.execute("SELECT hashed_password FROM users WHERE username = ?", (username,))
db_hash = cursor.fetchone()[0]
print(f"DB Hash: {db_hash[:40]}...")
print(f"Hashes match: {db_hash == hashed}")

# Test verification
print(f"\nVerifying password '{password}'...")
is_valid = verify_password(password, db_hash)
print(f"Result: {'✅ PASS' if is_valid else '❌ FAIL'}")

conn.close()

# Now test login via API
print("\nTesting login via API...")
import requests
response = requests.post(
    "http://localhost:8000/api/v1/auth/token",
    data={"username": username, "password": password},
    headers={"Content-Type": "application/x-www-form-urlencoded"}
)
print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")

if response.status_code != 200:
    # Try the simple endpoint
    print("\nTrying simple auth endpoint...")
    response2 = requests.post(
        "http://localhost:8000/api/v1/auth/simple-token",
        data={"username": username, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    print(f"Simple Status: {response2.status_code}")
    print(f"Simple Response: {response2.json()}")