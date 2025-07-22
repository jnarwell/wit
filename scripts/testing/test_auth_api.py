#!/usr/bin/env python3
"""
Test authentication API directly
"""

import requests
import json

BASE_URL = "http://localhost:8000"

print("🔐 Testing W.I.T. Authentication API")
print("=" * 40)

# Test 1: Check if server is running
print("\n1️⃣ Checking server...")
try:
    response = requests.get(f"{BASE_URL}/")
    print(f"  ✓ Server is running (status: {response.status_code})")
except Exception as e:
    print(f"  ✗ Server not reachable: {e}")
    exit(1)

# Test 2: Try to access protected endpoint without auth
print("\n2️⃣ Testing protected endpoint without auth...")
response = requests.get(f"{BASE_URL}/api/v1/projects")
print(f"  Status: {response.status_code}")
if response.status_code == 401:
    print("  ✓ Correctly requires authentication")
elif response.status_code == 404:
    print("  ⚠️  Endpoint not found (404) - checking route configuration...")
else:
    print(f"  Unexpected response: {response.text[:100]}")

# Test 3: Try to login
print("\n3️⃣ Testing login...")
login_data = {
    "username": "admin",
    "password": "admin123"
}

# Try different content types
print("\n  a) Trying with form data...")
response = requests.post(
    f"{BASE_URL}/api/v1/auth/token",
    data=login_data
)
print(f"     Status: {response.status_code}")
if response.status_code == 200:
    token_data = response.json()
    print(f"     ✓ Got token: {token_data['access_token'][:20]}...")
    print(f"     Token type: {token_data.get('token_type', 'bearer')}")
else:
    print(f"     Response: {response.text[:200]}")

# Test 4: Check available routes
print("\n4️⃣ Checking API documentation...")
response = requests.get(f"{BASE_URL}/docs")
if response.status_code == 200:
    print("  ✓ API docs available at /docs")
    
# Test 5: Try to find the correct project endpoint
print("\n5️⃣ Searching for project endpoints...")
possible_urls = [
    "/api/v1/projects",
    "/projects", 
    "/api/projects",
    "/v1/projects"
]

for url in possible_urls:
    response = requests.get(f"{BASE_URL}{url}")
    print(f"  {url}: {response.status_code}")
    
# Test 6: Check OpenAPI schema
print("\n6️⃣ Checking OpenAPI schema for routes...")
response = requests.get(f"{BASE_URL}/openapi.json")
if response.status_code == 200:
    openapi = response.json()
    paths = list(openapi.get("paths", {}).keys())
    print(f"  Found {len(paths)} endpoints:")
    for path in sorted(paths)[:10]:  # Show first 10
        print(f"    - {path}")
    if len(paths) > 10:
        print(f"    ... and {len(paths) - 10} more")

print("\n" + "=" * 40)
print("✅ Test complete!")