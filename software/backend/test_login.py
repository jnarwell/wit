#!/usr/bin/env python3
"""Test login with jamie user"""
import requests

BASE_URL = "http://localhost:8000"

# First, log in as admin and create jamie user
print("1. Logging in as admin...")
admin_login = requests.post(f"{BASE_URL}/api/v1/auth/login", 
    json={"username": "admin", "password": "admin"})
if admin_login.status_code == 200:
    print("✅ Admin login successful")
    admin_token = admin_login.json()["access_token"]
else:
    print(f"❌ Admin login failed: {admin_login.text}")
    exit(1)

# Create jamie user
print("\n2. Creating jamie user...")
headers = {"Authorization": f"Bearer {admin_token}"}
create_response = requests.post(f"{BASE_URL}/api/v1/admin/users", 
    headers=headers,
    json={
        "username": "jamie",
        "email": "jamie@example.com",
        "password": "test123",
        "is_admin": False
    })
if create_response.status_code == 200:
    print("✅ Jamie user created")
else:
    print(f"❌ Failed to create jamie: {create_response.text}")

# Try to login as jamie immediately
print("\n3. Attempting to login as jamie...")
jamie_login = requests.post(f"{BASE_URL}/api/v1/auth/login",
    json={"username": "jamie", "password": "test123"})
if jamie_login.status_code == 200:
    print("✅ Jamie login successful!")
else:
    print(f"❌ Jamie login failed: {jamie_login.status_code}")
    print(f"Response: {jamie_login.text}")