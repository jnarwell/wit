#!/usr/bin/env python3
"""
Test authentication
"""
import sqlite3
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def test_auth(username, password):
    """Test authentication"""
    conn = sqlite3.connect('wit.db')
    cursor = conn.cursor()
    
    # Get user data
    cursor.execute("SELECT username, hashed_password, is_active, email FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    
    if not user:
        print(f"User '{username}' not found")
        return
    
    print(f"User found: {user[0]}")
    print(f"Email: {user[3]}")
    print(f"Is Active: {user[2]}")
    print(f"Hashed password: {user[1][:20]}...")
    
    # Test password
    is_valid = pwd_context.verify(password, user[1])
    print(f"\nPassword '{password}' is valid: {is_valid}")
    
    # Also check if user is active
    if not user[2]:
        print("\nWARNING: User is not active!")
    
    conn.close()

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python test_auth.py <username> <password>")
        sys.exit(1)
    
    username = sys.argv[1]
    password = sys.argv[2]
    test_auth(username, password)