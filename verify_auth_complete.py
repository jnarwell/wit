#!/usr/bin/env python3
"""
Verify complete auth system is working
"""
import requests
import json

print("=" * 60)
print("AUTH SYSTEM VERIFICATION")
print("=" * 60)

# Test signup
print("\n1. Testing Signup...")
response = requests.post(
    "http://localhost:8000/api/v1/auth/signup",
    json={
        "username": "verifyuser",
        "email": "verify@example.com",
        "password": "verifypass123",
        "recaptcha_token": "dummy"
    }
)
print(f"   Signup: {response.status_code} - {'✅ PASS' if response.status_code == 200 else '❌ FAIL'}")

# Test login
print("\n2. Testing Login...")
response = requests.post(
    "http://localhost:8000/api/v1/auth/token",
    data={"username": "verifyuser", "password": "verifypass123"},
    headers={"Content-Type": "application/x-www-form-urlencoded"}
)
print(f"   Login: {response.status_code} - {'✅ PASS' if response.status_code == 200 else '❌ FAIL'}")

if response.status_code == 200:
    tokens = response.json()
    auth_header = {"Authorization": f"Bearer {tokens['access_token']}"}
    
    # Test /me endpoint
    print("\n3. Testing /me endpoint...")
    response = requests.get("http://localhost:8000/api/v1/auth/me", headers=auth_header)
    print(f"   /me: {response.status_code} - {'✅ PASS' if response.status_code == 200 else '❌ FAIL'}")
    if response.status_code == 200:
        user_info = response.json()
        print(f"   User: {user_info['username']} ({user_info['email']})")
    
    # Test protected endpoints
    print("\n4. Testing Protected Endpoints...")
    
    # Projects
    response = requests.get("http://localhost:8000/api/v1/projects", headers=auth_header)
    print(f"   /projects: {response.status_code} - {'✅ PASS' if response.status_code == 200 else '❌ FAIL'}")
    
    # Files
    response = requests.get("http://localhost:8000/api/v1/files/user", headers=auth_header)
    print(f"   /files/user: {response.status_code} - {'✅ PASS' if response.status_code == 200 else '❌ FAIL'}")
    
    response = requests.get("http://localhost:8000/api/v1/files/projects", headers=auth_header)
    print(f"   /files/projects: {response.status_code} - {'✅ PASS' if response.status_code == 200 else '❌ FAIL'}")

print("\n" + "=" * 60)
print("AUTH SYSTEM VERIFICATION COMPLETE")
print("=" * 60)