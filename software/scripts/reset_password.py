#!/usr/bin/env python3
"""
Reset user password
"""
import sqlite3
import sys
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def reset_password(username, new_password):
    """Reset a user's password"""
    conn = sqlite3.connect('wit.db')
    cursor = conn.cursor()
    
    # Check if user exists
    cursor.execute("SELECT username, email FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    
    if not user:
        print(f"User '{username}' not found")
        return
    
    # Hash the new password
    hashed_password = pwd_context.hash(new_password)
    
    # Update password
    cursor.execute("UPDATE users SET hashed_password = ? WHERE username = ?", (hashed_password, username))
    conn.commit()
    
    print(f"Password reset successful for user '{username}'")
    print(f"Email: {user[1]}")
    print(f"You can now login with:")
    print(f"  Username: {username}")
    print(f"  Password: {new_password}")
    
    conn.close()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python reset_password.py <username> <new_password>")
        sys.exit(1)
    
    username = sys.argv[1]
    new_password = sys.argv[2]
    reset_password(username, new_password)