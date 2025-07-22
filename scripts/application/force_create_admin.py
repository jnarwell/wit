#!/usr/bin/env python3
"""
Force create admin user - handles all ID scenarios
"""

import sqlite3
import sys

print("💪 Force Creating Admin User")
print("=" * 40)

# First, let's understand the exact table structure
conn = sqlite3.connect('data/wit_local.db')
cursor = conn.cursor()

# Get the CREATE TABLE statement
cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
create_statement = cursor.fetchone()
if create_statement:
    print("\n📋 Users table definition:")
    print(create_statement[0])

# Method 1: Try with raw SQL and let SQLite handle ID
print("\n\n🔧 Method 1: Using raw SQL with minimal fields...")
try:
    # Get password hash
    from auth.security import get_password_hash
    hashed_pw = get_password_hash("admin123")
    
    # Delete existing admin
    cursor.execute("DELETE FROM users WHERE username = 'admin'")
    
    # Try insert without ID (let SQLite auto-generate if possible)
    cursor.execute("""
        INSERT INTO users (username, email, hashed_password, is_admin, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
    """, ('admin', 'admin@wit.local', hashed_pw, 1, 1))
    
    conn.commit()
    print("✅ Method 1 successful!")
    
except Exception as e:
    print(f"❌ Method 1 failed: {e}")
    conn.rollback()
    
    # Method 2: Try with explicit ID
    print("\n🔧 Method 2: Using explicit ID...")
    try:
        # Check ID type
        cursor.execute("PRAGMA table_info(users)")
        columns = cursor.fetchall()
        id_col = next((col for col in columns if col[1] == 'id'), None)
        
        if id_col and 'INT' in id_col[2].upper():
            # Integer ID
            cursor.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM users")
            next_id = cursor.fetchone()[0]
        else:
            # String ID
            import uuid
            next_id = str(uuid.uuid4())
        
        print(f"  Using ID: {next_id}")
        
        # Delete existing admin
        cursor.execute("DELETE FROM users WHERE username = 'admin'")
        
        # Get all column names
        column_names = [col[1] for col in columns]
        
        # Build insert with all required columns
        values = {
            'id': next_id,
            'username': 'admin',
            'email': 'admin@wit.local',
            'hashed_password': hashed_pw,
            'is_admin': 1,
            'is_active': 1,
            'created_at': 'datetime("now")'
        }
        
        # Add any other required columns with defaults
        for col in columns:
            col_name = col[1]
            if col_name not in values and col[3]:  # Not null
                if 'INT' in col[2].upper():
                    values[col_name] = 0
                elif 'REAL' in col[2].upper() or 'FLOAT' in col[2].upper():
                    values[col_name] = 0.0
                elif 'CHAR' in col[2].upper() or 'TEXT' in col[2].upper():
                    values[col_name] = ''
        
        # Build query
        cols = [k for k in values.keys() if k in column_names]
        vals = [values[k] for k in cols]
        
        # Handle datetime
        query = f"INSERT INTO users ({', '.join(cols)}) VALUES ({', '.join(['?' if v != 'datetime(\"now\")' else 'datetime(\"now\")' for v in vals])})"
        vals = [v for v in vals if v != 'datetime("now")']
        
        cursor.execute(query, vals)
        conn.commit()
        print("✅ Method 2 successful!")
        
    except Exception as e2:
        print(f"❌ Method 2 failed: {e2}")
        conn.rollback()
        
        # Method 3: Direct SQL execution
        print("\n🔧 Method 3: Direct SQL command...")
        try:
            import uuid
            direct_sql = f"""
            INSERT INTO users (id, username, email, hashed_password, is_admin, is_active, created_at)
            VALUES ('{uuid.uuid4()}', 'admin', 'admin@wit.local', '{hashed_pw}', 1, 1, datetime('now'))
            """
            cursor.execute(direct_sql)
            conn.commit()
            print("✅ Method 3 successful!")
        except Exception as e3:
            print(f"❌ Method 3 failed: {e3}")

# Verify admin was created
print("\n🔍 Verifying admin user...")
cursor.execute("SELECT id, username, email, is_admin FROM users WHERE username = 'admin'")
admin = cursor.fetchone()

if admin:
    print("\n✅ SUCCESS! Admin user created:")
    print(f"  ID: {admin[0]}")
    print(f"  Username: {admin[1]}")
    print(f"  Email: {admin[2]}")
    print(f"  Is Admin: {'Yes' if admin[3] else 'No'}")
    print(f"  Password: admin123")
    
    # Test password
    print("\n🧪 Testing password...")
    from auth.security import verify_password
    cursor.execute("SELECT hashed_password FROM users WHERE username = 'admin'")
    hashed = cursor.fetchone()[0]
    if verify_password("admin123", hashed):
        print("  ✅ Password verification successful!")
    else:
        print("  ❌ Password verification failed!")
else:
    print("\n❌ Admin user creation failed!")
    print("\nTry running this SQL directly:")
    print("sqlite3 data/wit_local.db")
    print(f"INSERT INTO users (id, username, email, hashed_password, is_admin, is_active, created_at) VALUES (1, 'admin', 'admin@wit.local', '{hashed_pw}', 1, 1, datetime('now'));")

conn.close()

print("\n" + "=" * 40)
print("Next step: Restart the server and test authentication")
print("  python3 dev_server.py")