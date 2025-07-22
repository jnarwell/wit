#!/usr/bin/env python3
"""
Fix user creation with proper ID handling
"""

import sqlite3
from auth.security import get_password_hash
from datetime import datetime, timezone
import uuid

print("🔧 Fixing User Creation with ID...")

# Connect to database
conn = sqlite3.connect('data/wit_local.db')
cursor = conn.cursor()

# First, check the exact schema of users table
print("\n📋 Checking users table schema...")
cursor.execute("PRAGMA table_info(users)")
columns = cursor.fetchall()

print("Column details:")
for col in columns:
    print(f"  {col[1]:20} {col[2]:15} {'NOT NULL' if col[3] else 'NULL':10} {'PRIMARY KEY' if col[5] else ''}")

# Find the ID column type
id_col = next((col for col in columns if col[1] == 'id'), None)
if id_col:
    id_type = id_col[2]
    print(f"\nID column type: {id_type}")
else:
    print("\n❌ No ID column found!")
    exit(1)

# Delete any existing admin user
print("\n🧹 Cleaning up existing admin user...")
cursor.execute("DELETE FROM users WHERE username = 'admin'")
conn.commit()

# Create admin user with proper ID
print("\n👤 Creating admin user...")
try:
    hashed_pw = get_password_hash("admin123")
    now = datetime.now(timezone.utc).isoformat()
    
    # Determine ID value based on type
    if 'INT' in id_type.upper():
        # For integer ID, find the max and add 1
        cursor.execute("SELECT MAX(id) FROM users")
        max_id = cursor.fetchone()[0]
        new_id = (max_id or 0) + 1
        print(f"Using integer ID: {new_id}")
    else:
        # For string/UUID ID
        new_id = str(uuid.uuid4())
        print(f"Using UUID: {new_id}")
    
    # Build insert query based on available columns
    column_names = [col[1] for col in columns]
    
    # Essential data
    data = {
        'id': new_id,
        'username': 'admin',
        'email': 'admin@wit.local',
        'hashed_password': hashed_pw,
        'is_active': 1,
        'is_admin': 1,
        'created_at': now
    }
    
    # Add optional fields if they exist
    if 'last_login' in column_names:
        data['last_login'] = None
    if 'preferences' in column_names:
        data['preferences'] = '{}'
    if 'voice_settings' in column_names:
        data['voice_settings'] = '{}'
    if 'workspace_config' in column_names:
        data['workspace_config'] = '{}'
    
    # Build query
    columns = []
    values = []
    for col, val in data.items():
        if col in column_names:
            columns.append(col)
            values.append(val)
    
    placeholders = ', '.join(['?' for _ in columns])
    columns_str = ', '.join(columns)
    
    query = f"INSERT INTO users ({columns_str}) VALUES ({placeholders})"
    print(f"\nExecuting: {query}")
    print(f"Values: {values}")
    
    cursor.execute(query, values)
    conn.commit()
    
    print("\n✅ Admin user created successfully!")
    
    # Verify
    cursor.execute("SELECT id, username, email, is_admin, is_active FROM users WHERE username = 'admin'")
    admin = cursor.fetchone()
    if admin:
        print(f"\n📊 Admin user details:")
        print(f"  ID: {admin[0]}")
        print(f"  Username: {admin[1]}")
        print(f"  Email: {admin[2]}")
        print(f"  Is Admin: {'Yes' if admin[3] else 'No'}")
        print(f"  Is Active: {'Yes' if admin[4] else 'No'}")
        print(f"  Password: admin123")
        
except Exception as e:
    print(f"\n❌ Error creating user: {e}")
    import traceback
    traceback.print_exc()

# Test password verification
print("\n🧪 Testing password verification...")
try:
    cursor.execute("SELECT hashed_password FROM users WHERE username = 'admin'")
    result = cursor.fetchone()
    
    if result:
        from auth.security import verify_password
        stored_hash = result[0]
        
        if verify_password("admin123", stored_hash):
            print("  ✅ Password verification working!")
        else:
            print("  ❌ Password verification failed!")
    else:
        print("  ❌ No admin user found!")
        
except Exception as e:
    print(f"  ❌ Verification error: {e}")

conn.close()
print("\n✅ User fix complete!")