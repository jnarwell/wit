#!/usr/bin/env python3
"""
Clear all users from the database
"""
import sqlite3

conn = sqlite3.connect('wit.db')
cursor = conn.cursor()

# First, check how many users exist
cursor.execute("SELECT COUNT(*) FROM users")
count = cursor.fetchone()[0]
print(f"Found {count} users in database")

if count > 0:
    # Show the users that will be deleted
    cursor.execute("SELECT username, email FROM users")
    users = cursor.fetchall()
    print("\nUsers to be deleted:")
    for username, email in users:
        print(f"  - {username} ({email})")
    
    # Delete all users
    cursor.execute("DELETE FROM users")
    conn.commit()
    print(f"\n✅ Deleted all {count} users")
else:
    print("\n✅ No users to delete")

# Verify deletion
cursor.execute("SELECT COUNT(*) FROM users")
final_count = cursor.fetchone()[0]
print(f"\nFinal user count: {final_count}")

conn.close()