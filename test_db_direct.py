#!/usr/bin/env python3
"""
Test database and password hashing directly
"""
import sqlite3
import uuid
import sys
sys.path.insert(0, '.')

from software.backend.auth.security import get_password_hash, verify_password

# Test data
username = "directtest"
email = "direct@test.com"
password = "password123"

print("Testing direct database operations...")

# 1. Create hash
print(f"\n1. Creating password hash for '{password}'")
hashed = get_password_hash(password)
print(f"   Hash: {hashed[:40]}...")

# 2. Verify hash
print(f"\n2. Verifying password")
is_valid = verify_password(password, hashed)
print(f"   Valid: {is_valid}")

# 3. Insert into database
print(f"\n3. Inserting user into database")
conn = sqlite3.connect('wit.db')
cursor = conn.cursor()

user_id = str(uuid.uuid4()).replace('-', '')
try:
    cursor.execute("""
        INSERT INTO users (id, username, email, hashed_password, is_active, is_admin, created_at)
        VALUES (?, ?, ?, ?, 1, 0, datetime('now'))
    """, (user_id, username, email, hashed))
    conn.commit()
    print("   ✅ User inserted successfully")
except Exception as e:
    print(f"   ❌ Error: {e}")

# 4. Verify user exists
cursor.execute("SELECT username, email, hashed_password FROM users WHERE username = ?", (username,))
user = cursor.fetchone()
if user:
    print(f"\n4. User in database:")
    print(f"   Username: {user[0]}")
    print(f"   Email: {user[1]}")
    print(f"   Hash matches: {user[2] == hashed}")
    
    # 5. Test password verification from DB
    db_valid = verify_password(password, user[2])
    print(f"\n5. Password verification from DB: {db_valid}")

conn.close()