#!/usr/bin/env python3
"""
Simple script to delete all users from the database.
"""

import sqlite3
import os

# Path to the database
db_path = "wit.db"

if not os.path.exists(db_path):
    print(f"Database file {db_path} not found!")
    exit(1)

print("=== W.I.T. User Deletion Script ===")
print("WARNING: This will permanently delete ALL users and their data!")
print()

# Connect to the database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Get count of users
    cursor.execute("SELECT COUNT(*) FROM users")
    user_count = cursor.fetchone()[0]
    
    if user_count == 0:
        print("No users found in the database.")
        exit(0)
    
    # Get user list
    cursor.execute("SELECT username, email FROM users")
    users = cursor.fetchall()
    
    print(f"Found {user_count} users:")
    for username, email in users:
        print(f"  - {username} ({email})")
    
    # Confirm deletion
    confirm = input("\nAre you sure you want to delete ALL users and their data? (yes/no): ")
    if confirm.lower() != 'yes':
        print("Deletion cancelled.")
        exit(0)
    
    print("\nDeleting all user data...")
    
    # Delete in order of dependencies
    tables_to_clear = [
        "team_members",
        "tasks", 
        "files",
        "projects",
        "equipment",
        "users"
    ]
    
    for table in tables_to_clear:
        try:
            cursor.execute(f"DELETE FROM {table}")
            print(f"✓ Cleared table: {table}")
        except sqlite3.OperationalError as e:
            if "no such table" in str(e):
                print(f"⚠️  Table {table} doesn't exist, skipping...")
            else:
                raise
    
    # Commit changes
    conn.commit()
    print("\n✅ Successfully deleted all users and their associated data!")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    conn.rollback()
    
finally:
    conn.close()