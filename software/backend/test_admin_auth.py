#!/usr/bin/env python3
"""Test script to verify admin authentication flow"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_admin_auth():
    print("Testing admin authentication flow...")
    
    # Step 1: Login as admin
    print("\n1. Logging in as admin...")
    login_response = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        json={"username": "admin", "password": "admin"}
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        print(f"Response: {login_response.text}")
        return
    
    login_data = login_response.json()
    token = login_data.get("access_token")
    print(f"✅ Login successful! Token: {token[:50]}...")
    
    # Step 2: Test /auth/me endpoint
    print("\n2. Testing /auth/me endpoint...")
    headers = {"Authorization": f"Bearer {token}"}
    me_response = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=headers)
    
    if me_response.status_code == 200:
        user_data = me_response.json()
        print(f"✅ /auth/me successful! User: {user_data}")
    else:
        print(f"❌ /auth/me failed: {me_response.status_code}")
        print(f"Response: {me_response.text}")
    
    # Step 3: Test admin stats endpoint
    print("\n3. Testing /admin/stats endpoint...")
    print(f"Headers being sent: {headers}")
    stats_response = requests.get(f"{BASE_URL}/api/v1/admin/stats", headers=headers)
    
    if stats_response.status_code == 200:
        stats_data = stats_response.json()
        print(f"✅ /admin/stats successful! Stats: {json.dumps(stats_data, indent=2)}")
    else:
        print(f"❌ /admin/stats failed: {stats_response.status_code}")
        print(f"Response: {stats_response.text}")
        print(f"Response headers: {stats_response.headers}")
    
    # Step 4: Test admin users endpoint
    print("\n4. Testing /admin/users endpoint...")
    users_response = requests.get(f"{BASE_URL}/api/v1/admin/users", headers=headers)
    
    if users_response.status_code == 200:
        users_data = users_response.json()
        print(f"✅ /admin/users successful! Found {users_data.get('total', 0)} users")
    else:
        print(f"❌ /admin/users failed: {users_response.status_code}")
        print(f"Response: {users_response.text}")
    
    print("\n✅ All tests completed!")

if __name__ == "__main__":
    test_admin_auth()