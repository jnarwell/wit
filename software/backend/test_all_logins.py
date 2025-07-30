#!/usr/bin/env python3
"""Test all user logins"""
import requests

BASE_URL = "http://localhost:8000"

users = [
    ("admin", "admin"),
    ("maker", "maker123"),
    ("jamie", "test123")
]

print("Testing logins with /api/v1/auth/login endpoint:")
print("=" * 50)

for username, password in users:
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        json={"username": username, "password": password}
    )
    
    if response.status_code == 200:
        print(f"✅ {username}: Login successful!")
    else:
        print(f"❌ {username}: Login failed - {response.status_code}")
        print(f"   Response: {response.text}")

print("\n\nTesting logins with /api/v1/auth/token endpoint (OAuth2 style):")
print("=" * 50)

for username, password in users:
    # OAuth2 style login
    form_data = {
        "username": username,
        "password": password,
        "grant_type": "password"
    }
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/token",
        data=form_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    if response.status_code == 200:
        print(f"✅ {username}: Login successful!")
    else:
        print(f"❌ {username}: Login failed - {response.status_code}")
        print(f"   Response: {response.text}")