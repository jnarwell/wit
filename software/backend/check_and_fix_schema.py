#!/usr/bin/env python3
"""
Check and fix database schema issues
"""

import sqlite3
from auth.security import get_password_hash
from datetime import datetime, timezone

print("🔍 Checking Database Schema...")

# Connect to database
conn = sqlite3.connect('data/wit_local.db')
cursor = conn.cursor()

# Check users table schema
print("\n📋 Users table schema:")
cursor.execute("PRAGMA table_info(users)")
columns = cursor.fetchall()

column_names = [col[1] for col in columns]
print(f"Columns: {', '.join(column_names)}")

# Check if we need full_name column
if 'full_name' not in column_names:
    print("\n⚠️  'full_name' column missing. Checking for alternatives...")
    
    # Check what columns we have
    name_columns = [col for col in column_names if 'name' in col.lower()]
    print(f"Name-related columns: {name_columns}")

# Create admin user with existing schema
print("\n👤 Creating admin user...")

try:
    # First, clear any existing admin user
    cursor.execute("DELETE FROM users WHERE username = 'admin'")
    
    # Get password hash
    hashed_pw = get_password_hash("admin123")
    
    # Build insert based on actual columns
    if 'full_name' in column_names:
        # Use full schema
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
            datetime.now(timezone.utc).isoformat(),
            datetime.now(timezone.utc).isoformat()
        ))
    else:
        # Minimal schema - just essential fields
        print("Using minimal schema...")
        
        # Find which columns exist
        essential_columns = ['username', 'email', 'hashed_password', 'is_admin', 'is_active']
        available = [col for col in essential_columns if col in column_names]
        
        # Build dynamic insert
        placeholders = ', '.join(['?' for _ in available])
        columns_str = ', '.join(available)
        
        values = []
        for col in available:
            if col == 'username':
                values.append('admin')
            elif col == 'email':
                values.append('admin@wit.local')
            elif col == 'hashed_password':
                values.append(hashed_pw)
            elif col == 'is_admin':
                values.append(1)
            elif col == 'is_active':
                values.append(1)
        
        query = f"INSERT INTO users ({columns_str}) VALUES ({placeholders})"
        cursor.execute(query, values)
    
    conn.commit()
    print("✅ Admin user created successfully!")
    
    # Verify
    cursor.execute("SELECT username, email FROM users WHERE username = 'admin'")
    admin = cursor.fetchone()
    if admin:
        print(f"   Username: {admin[0]}")
        print(f"   Email: {admin[1]}")
        print(f"   Password: admin123")
        
except Exception as e:
    print(f"❌ Error creating user: {e}")
    
# Check all tables
print("\n📊 Database tables:")
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = cursor.fetchall()
for table in tables:
    cursor.execute(f"SELECT COUNT(*) FROM {table[0]}")
    count = cursor.fetchone()[0]
    print(f"  - {table[0]}: {count} rows")

conn.close()
print("\n✅ Schema check complete!")