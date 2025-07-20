#!/usr/bin/env python3
"""
Test the complete auth flow to identify issues
"""

import requests
import json

BASE_URL = "http://localhost:8000"

print("🧪 Testing W.I.T. Auth Flow\n")

# Step 1: Test if server is running
print("1️⃣ Testing server connection...")
try:
    response = requests.get(f"{BASE_URL}/")
    print(f"✅ Server is running")
    print(f"   Response: {response.json()}")
except Exception as e:
    print(f"❌ Server not reachable: {e}")
    exit(1)

# Step 2: Test login
print("\n2️⃣ Testing login endpoint...")
login_data = {
    "username": "admin",
    "password": "admin"
}

try:
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/token",
        data=login_data,  # Form data, not JSON
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        token_data = response.json()
        access_token = token_data.get("access_token")
        print(f"✅ Login successful!")
        print(f"   Token: {access_token[:20]}...")
    else:
        print(f"❌ Login failed: {response.text}")
        exit(1)
        
except Exception as e:
    print(f"❌ Login error: {e}")
    exit(1)

# Step 3: Test /me endpoint with token
print("\n3️⃣ Testing /me endpoint...")
try:
    response = requests.get(
        f"{BASE_URL}/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        user_data = response.json()
        print(f"✅ User info retrieved!")
        print(f"   User: {json.dumps(user_data, indent=2)}")
    else:
        print(f"❌ /me failed: {response.status_code}")
        print(f"   Response: {response.text}")
        
except Exception as e:
    print(f"❌ /me error: {e}")

# Step 4: Test CORS headers
print("\n4️⃣ Testing CORS headers...")
try:
    # Simulate browser request from localhost:3000
    response = requests.options(
        f"{BASE_URL}/api/v1/auth/token",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type"
        }
    )
    
    cors_headers = {
        "Access-Control-Allow-Origin": response.headers.get("Access-Control-Allow-Origin"),
        "Access-Control-Allow-Methods": response.headers.get("Access-Control-Allow-Methods"),
        "Access-Control-Allow-Headers": response.headers.get("Access-Control-Allow-Headers")
    }
    
    print(f"   CORS Headers: {json.dumps(cors_headers, indent=2)}")
    
    if cors_headers["Access-Control-Allow-Origin"] in ["*", "http://localhost:3000"]:
        print(f"✅ CORS properly configured for localhost:3000")
    else:
        print(f"❌ CORS not allowing localhost:3000")
        
except Exception as e:
    print(f"❌ CORS test error: {e}")

print("\n" + "="*50)
print("📊 Summary:")
print("   If all tests pass, your auth should work in the browser!")
print("   If not, use the fixed dev_server.py above.")
print("="*50)