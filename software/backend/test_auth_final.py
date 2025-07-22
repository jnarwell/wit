#!/usr/bin/env python3
"""
Final authentication test after fixes
"""

import requests
import json
import time

print("🔐 Final Authentication Test")
print("=" * 40)

BASE_URL = "http://localhost:8000"

# Test 1: Server health
print("\n1️⃣ Checking server health...")
try:
    response = requests.get(f"{BASE_URL}/api/v1/system/health")
    if response.status_code == 200:
        print("  ✅ Server is healthy")
    else:
        print(f"  ⚠️  Server health check returned: {response.status_code}")
except Exception as e:
    print(f"  ❌ Server not reachable: {e}")
    print("  Make sure to restart the server: python3 dev_server.py")
    exit(1)

# Test 2: Authentication
print("\n2️⃣ Testing authentication...")
login_data = {
    "username": "admin",
    "password": "admin123"
}

try:
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/token",
        data=login_data  # Form data, not JSON
    )
    
    print(f"  Status: {response.status_code}")
    
    if response.status_code == 200:
        token_data = response.json()
        access_token = token_data.get("access_token")
        print(f"  ✅ Login successful!")
        print(f"  Token: {access_token[:30]}...")
        
        # Test 3: Access protected endpoints
        print("\n3️⃣ Testing protected endpoints...")
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Test projects endpoint
        print("\n  Testing /api/v1/projects...")
        proj_response = requests.get(f"{BASE_URL}/api/v1/projects", headers=headers)
        print(f"    Status: {proj_response.status_code}")
        if proj_response.status_code == 200:
            projects = proj_response.json()
            print(f"    ✅ Projects endpoint working!")
            print(f"    Found {len(projects)} projects")
            
        # Test user info
        print("\n  Testing /api/v1/auth/me...")
        me_response = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=headers)
        print(f"    Status: {me_response.status_code}")
        if me_response.status_code == 200:
            user_info = me_response.json()
            print(f"    ✅ User info endpoint working!")
            print(f"    User: {user_info.get('username')} ({user_info.get('email')})")
            
    else:
        print(f"  ❌ Login failed!")
        print(f"  Response: {response.text}")
        
        # Debug: Check if admin user exists in database
        print("\n  🔍 Debugging...")
        print("  Run this to check if admin user exists:")
        print("  sqlite3 data/wit_local.db \"SELECT id, username, email FROM users WHERE username='admin';\"")
        
except Exception as e:
    print(f"  ❌ Error: {e}")

# Test 4: Check all major endpoints
print("\n4️⃣ Checking all major endpoints...")
endpoints = [
    "/api/v1/projects",
    "/api/v1/tasks", 
    "/api/v1/teams",
    "/api/v1/equipment",
    "/api/v1/voice/status",
    "/api/v1/vision/status"
]

for endpoint in endpoints:
    try:
        response = requests.get(f"{BASE_URL}{endpoint}")
        status = "✅" if response.status_code in [200, 401] else "❌"
        print(f"  {status} {endpoint}: {response.status_code}")
    except:
        print(f"  ❌ {endpoint}: Failed to connect")

print("\n" + "=" * 40)
print("✅ Test complete!")

# Summary
if 'access_token' in locals():
    print("\n🎉 Authentication is working!")
    print("The backend is ready for frontend development.")
else:
    print("\n⚠️  Authentication is not working yet.")
    print("Please run: python3 fix_user_id.py")
    print("Then restart the server: python3 dev_server.py")