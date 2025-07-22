#!/usr/bin/env python3
"""
Inspect database to understand the issue
"""

import sqlite3

print("🔍 Database Inspection")
print("=" * 40)

conn = sqlite3.connect('data/wit_local.db')
cursor = conn.cursor()

# Check users table
print("\n📋 Users table structure:")
cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
create_sql = cursor.fetchone()
if create_sql:
    print(create_sql[0])
else:
    print("❌ Users table not found!")

# Check for any users
print("\n👥 Current users:")
cursor.execute("SELECT * FROM users")
users = cursor.fetchall()
if users:
    # Get column names
    column_names = [description[0] for description in cursor.description]
    print(f"Columns: {', '.join(column_names)}")
    
    for user in users:
        print(f"\nUser record:")
        for i, value in enumerate(user):
            print(f"  {column_names[i]}: {value}")
else:
    print("  No users found")

# Check sequences/autoincrement
print("\n🔢 Checking AUTOINCREMENT...")
cursor.execute("SELECT name, seq FROM sqlite_sequence WHERE name='users'")
seq = cursor.fetchone()
if seq:
    print(f"  Users sequence: {seq[1]}")
else:
    print("  No sequence found for users table")

# Try to understand the ID column
print("\n🆔 Understanding ID column...")
cursor.execute("PRAGMA table_info(users)")
columns = cursor.fetchall()
id_col = next((col for col in columns if col[1] == 'id'), None)
if id_col:
    print(f"  Column: {id_col[1]}")
    print(f"  Type: {id_col[2]}")
    print(f"  Not Null: {id_col[3]}")
    print(f"  Default: {id_col[4]}")
    print(f"  Primary Key: {id_col[5]}")

conn.close()

print("\n" + "=" * 40)
print("💡 Insights:")
if id_col and id_col[2] == 'INTEGER' and id_col[5] == 1:
    print("- ID is INTEGER PRIMARY KEY (should auto-increment)")
    print("- If insert fails, try without specifying ID")
elif id_col and 'CHAR' in id_col[2].upper():
    print("- ID is string type (needs UUID)")
else:
    print("- ID configuration unclear")