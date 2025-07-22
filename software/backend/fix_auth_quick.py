#!/usr/bin/env python3
"""
Quick fix for authentication issues
"""

import sqlite3
from auth.security import get_password_hash
from datetime import datetime

print("🔧 Fixing Authentication...")

# Connect to database
conn = sqlite3.connect('data/wit_local.db')
cursor = conn.cursor()

# Check current users
cursor.execute("SELECT username, email FROM users")
users = cursor.fetchall()

if users:
    print(f"\n📊 Current users:")
    for user in users:
        print(f"  - {user[0]} ({user[1]})")
else:
    print("\n⚠️  No users found. Creating admin user...")
    
    # Create admin user
    hashed_pw = get_password_hash("admin123")
    
    cursor.execute("""
        INSERT INTO users (
            username, email, full_name, hashed_password, 
            is_admin, is_active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "admin",
        "admin@wit.local",
        "Administrator",
        hashed_pw,
        1,  # is_admin = True
        1,  # is_active = True
        datetime.utcnow().isoformat(),
        datetime.utcnow().isoformat()
    ))
    
    conn.commit()
    print("  ✓ Admin user created successfully!")
    print("    Username: admin")
    print("    Password: admin123")

# Test the password hash
print("\n🧪 Testing password verification...")
cursor.execute("SELECT hashed_password FROM users WHERE username = 'admin'")
result = cursor.fetchone()

if result:
    from auth.security import verify_password
    stored_hash = result[0]
    
    # Test correct password
    if verify_password("admin123", stored_hash):
        print("  ✓ Password verification working!")
    else:
        print("  ✗ Password verification failed!")
        print(f"  Stored hash: {stored_hash[:20]}...")
        
        # Fix the password
        print("  🔧 Fixing password...")
        new_hash = get_password_hash("admin123")
        cursor.execute(
            "UPDATE users SET hashed_password = ? WHERE username = 'admin'",
            (new_hash,)
        )
        conn.commit()
        print("  ✓ Password updated!")

conn.close()
print("\n✅ Authentication fix complete!")