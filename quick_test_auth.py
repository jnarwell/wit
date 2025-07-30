#!/usr/bin/env python3
"""
Quick auth test - run this after server is started
"""
import requests

# Test credentials
username = "testuser"
password = "password123"
email = "test@example.com"

print("1. Creating account...")
signup = requests.post("http://localhost:8000/api/v1/auth/signup", json={
    "username": username,
    "email": email,
    "password": password,
    "recaptcha_token": "dummy"
})
print(f"   Signup: {signup.status_code} - {signup.json()}")

print("\n2. Trying to login...")
login = requests.post("http://localhost:8000/api/v1/auth/token", 
    data={"username": username, "password": password},
    headers={"Content-Type": "application/x-www-form-urlencoded"}
)
print(f"   Login: {login.status_code} - {login.json()}")

if login.status_code == 200:
    print(f"\n✅ SUCCESS! Token: {login.json()['access_token'][:30]}...")
else:
    print("\n❌ Login failed. Checking database...")
    import sqlite3
    conn = sqlite3.connect('wit.db')
    cursor = conn.cursor()
    cursor.execute("SELECT username, email, is_active FROM users")
    users = cursor.fetchall()
    print(f"   Users in DB: {users}")
    conn.close()