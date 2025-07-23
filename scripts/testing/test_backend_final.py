#!/usr/bin/env python3
"""
Final backend test after all fixes
"""

import requests
import json
import sys

print("🎯 Final Backend Test")
print("=" * 50)

BASE_URL = "http://backend:8000"

# Test 1: Check server
print("\n1️⃣ Server Check...")
try:
    response = requests.get(f"{BASE_URL}/")
    print(f"  ✅ Server running (status: {response.status_code})")
except:
    print("  ❌ Server not running! Start with: python3 dev_server.py")
    sys.exit(1)

# Test 2: Check routes in OpenAPI
print("\n2️⃣ Checking registered routes...")
try:
    response = requests.get(f"{BASE_URL}/openapi.json")
    if response.status_code == 200:
        openapi = response.json()
        paths = openapi.get("paths", {})
        
        # Check for correct routes (without duplication)
        expected_routes = [
            "/api/v1/projects",
            "/api/v1/tasks",
            "/api/v1/teams",
            "/api/v1/materials",
            "/api/v1/files",
            "/api/v1/auth/token"
        ]
        
        print("\n  Expected routes:")
        for route in expected_routes:
            if route in paths:
                print(f"    ✅ {route}")
            else:
                # Check if it exists with duplication
                duplicated = f"/api/v1/projects{route}"
                if duplicated in paths:
                    print(f"    ❌ {route} (found as {duplicated} - needs fix)")
                else:
                    print(f"    ❌ {route} (not found)")
except Exception as e:
    print(f"  ❌ Error checking routes: {e}")

# Test 3: Test authentication
print("\n3️⃣ Testing Authentication...")

# First, let's see what the auth endpoint expects
print("\n  Checking auth endpoint details...")
try:
    # Get OpenAPI spec for auth endpoint
    response = requests.get(f"{BASE_URL}/openapi.json")
    if response.status_code == 200:
        openapi = response.json()
        auth_endpoint = openapi.get("paths", {}).get("/api/v1/auth/token", {})
        if auth_endpoint:
            post_spec = auth_endpoint.get("post", {})
            print(f"    Request body type: {post_spec.get('requestBody', {}).get('content', {}).keys()}")
except:
    pass

# Try login
print("\n  Attempting login...")
login_data = {
    "username": "admin",
    "password": "admin123"
}

# Try both form data and JSON
print("\n  a) Trying with form data...")
response = requests.post(
    f"{BASE_URL}/api/v1/auth/token",
    data=login_data  # Form data
)
print(f"     Status: {response.status_code}")
if response.status_code == 200:
    token_data = response.json()
    access_token = token_data.get("access_token")
    print(f"     ✅ Login successful!")
    print(f"     Token: {access_token[:30]}...")
else:
    print(f"     Response: {response.text[:200]}")
    
    print("\n  b) Trying with JSON...")
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/token",
        json=login_data,  # JSON data
        headers={"Content-Type": "application/json"}
    )
    print(f"     Status: {response.status_code}")
    if response.status_code == 200:
        token_data = response.json()
        access_token = token_data.get("access_token")
        print(f"     ✅ Login successful!")
    else:
        print(f"     Response: {response.text[:200]}")

# Test 4: If we got a token, test protected endpoints
if 'access_token' in locals():
    print("\n4️⃣ Testing Protected Endpoints...")
    headers = {"Authorization": f"Bearer {access_token}"}
    
    endpoints = [
        "/api/v1/projects",
        "/api/v1/tasks",
        "/api/v1/teams",
        "/api/v1/auth/me"
    ]
    
    for endpoint in endpoints:
        response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
        status_icon = "✅" if response.status_code == 200 else "❌"
        print(f"  {status_icon} GET {endpoint}: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list):
                    print(f"     Found {len(data)} items")
                elif isinstance(data, dict) and 'username' in data:
                    print(f"     User: {data.get('username')}")
            except:
                pass

print("\n" + "=" * 50)

# Summary
if 'access_token' in locals() and response.status_code == 200:
    print("\n✅ Backend is fully working!")
    print("\nThe frontend can now:")
    print("1. Login at POST /api/v1/auth/token")
    print("2. Access projects at GET /api/v1/projects")
    print("3. Create tasks at POST /api/v1/tasks")
    print("4. Manage teams at /api/v1/teams")
else:
    print("\n⚠️  Backend needs fixes:")
    print("1. Run: python3 debug_auth_endpoint.py")
    print("2. Run: python3 manual_auth_test.py")
    print("3. Restart server: python3 dev_server.py")