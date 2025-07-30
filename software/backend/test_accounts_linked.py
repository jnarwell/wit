#!/usr/bin/env python3
"""Test accounts/linked endpoint"""
import requests

BASE_URL = "http://localhost:8000"

# Login first
login_response = requests.post(
    f"{BASE_URL}/api/v1/auth/token",
    data={"username": "maker", "password": "maker123"},
    headers={"Content-Type": "application/x-www-form-urlencoded"}
)

if login_response.status_code == 200:
    print("✅ Login successful!")
    token = login_response.json()["access_token"]
    
    # Test accounts/linked
    accounts_response = requests.get(
        f"{BASE_URL}/api/v1/accounts/linked",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    print(f"\n/api/v1/accounts/linked response:")
    print(f"Status: {accounts_response.status_code}")
    print(f"Body: {accounts_response.json()}")
else:
    print(f"❌ Login failed: {login_response.status_code}")