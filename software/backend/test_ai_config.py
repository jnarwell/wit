#!/usr/bin/env python3
"""
Test AI Configuration API
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def get_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/token",
        data={"username": "admin", "password": "admin"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    else:
        print(f"Auth failed: {response.status_code} - {response.text}")
        return None

def test_ai_config():
    """Test AI configuration endpoints"""
    token = get_token()
    if not token:
        print("Failed to get auth token")
        return
        
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n1. Getting AI providers...")
    # Try different possible paths
    paths = [
        "/api/v1/ai-config/providers",
        "/ai-config/providers",
        "/providers"
    ]
    
    for path in paths:
        response = requests.get(f"{BASE_URL}{path}", headers=headers)
        print(f"   Trying {path}: {response.status_code}")
        if response.status_code == 200:
            print(f"   Success! Response: {json.dumps(response.json(), indent=2)}")
            break
        elif response.status_code == 404:
            continue
        else:
            print(f"   Error: {response.text}")
    
    print("\n2. Testing terminal AI query...")
    response = requests.post(
        f"{BASE_URL}/api/v1/terminal/ai-query",
        json={"query": "What is 2+2?"},
        headers=headers
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        print(f"   Response: {json.dumps(response.json(), indent=2)}")
    else:
        print(f"   Error: {response.text}")

if __name__ == "__main__":
    test_ai_config()