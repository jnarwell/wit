#!/usr/bin/env python3
"""
Simple user activation script
"""
import sqlite3
import sys

def activate_user(username):
    """Activate a user by username"""
    conn = sqlite3.connect('wit.db')
    cursor = conn.cursor()
    
    # Check if user exists
    cursor.execute("SELECT username, email, is_active FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    
    if not user:
        print(f"User '{username}' not found")
        return
    
    if user[2]:  # is_active
        print(f"User '{username}' is already active")
        return
    
    # Activate user
    cursor.execute("UPDATE users SET is_active = 1 WHERE username = ?", (username,))
    conn.commit()
    
    print(f"User '{username}' has been activated!")
    print(f"Email: {user[1]}")
    print(f"You can now login with username: {username}")
    
    conn.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python simple_activate.py <username>")
        sys.exit(1)
    
    username = sys.argv[1]
    activate_user(username)