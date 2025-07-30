#!/usr/bin/env python3
"""
Test login with raw SQL to bypass ORM issues
"""
import sqlite3
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def test_raw_login(username, password):
    """Test login with raw SQL"""
    print(f"Testing login for: {username}")
    print(f"Password: {password}")
    
    conn = sqlite3.connect('wit.db')
    cursor = conn.cursor()
    
    # Get user
    cursor.execute("SELECT id, username, email, hashed_password, is_active FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    
    if not user:
        print("\n❌ User not found in database!")
        conn.close()
        return False
    
    print(f"\n✅ User found:")
    print(f"   ID: {user[0]}")
    print(f"   Username: {user[1]}")
    print(f"   Email: {user[2]}")
    print(f"   Is Active: {user[4]}")
    print(f"   Hash: {user[3][:30]}...")
    
    # Verify password
    is_valid = pwd_context.verify(password, user[3])
    print(f"\nPassword verification: {'✅ VALID' if is_valid else '❌ INVALID'}")
    
    conn.close()
    return is_valid

# Test with the user we just created
test_raw_login("testuser123", "TestPass123!")

# Also test if there are any other users
print("\n" + "="*50)
print("All users in database:")
conn = sqlite3.connect('wit.db')
cursor = conn.cursor()
cursor.execute("SELECT username, email, is_active FROM users")
for user in cursor.fetchall():
    print(f"  - {user[0]} ({user[1]}) - Active: {user[2]}")
conn.close()