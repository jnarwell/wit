#!/usr/bin/env python3
"""
Test database directly
"""
import sqlite3
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Connect to database
conn = sqlite3.connect('wit.db')
cursor = conn.cursor()

# Get all users
cursor.execute("SELECT id, username, email, hashed_password, is_active FROM users")
users = cursor.fetchall()

print("Users in database:")
for user in users:
    print(f"\nID: {user[0]}")
    print(f"Username: {user[1]}")
    print(f"Email: {user[2]}")
    print(f"Is Active: {user[4]}")
    print(f"Hash starts with: {user[3][:30]}...")
    
    # Test password
    is_valid = pwd_context.verify("12345", user[3])
    print(f"Password '12345' valid: {is_valid}")

conn.close()