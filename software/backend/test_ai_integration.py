#!/usr/bin/env python3
"""
Test AI Integration with multiple providers
"""

import requests
import json
import os

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

def test_ai_providers():
    """Test AI providers functionality"""
    token = get_token()
    if not token:
        print("Failed to get auth token")
        return
        
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n=== AI Provider Configuration Test ===\n")
    
    # 1. Configure Anthropic provider
    print("1. Configuring Anthropic provider...")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    if anthropic_key:
        response = requests.post(
            f"{BASE_URL}/api/v1/ai-config/providers/anthropic/configure",
            json={
                "provider_id": "anthropic",
                "api_key": anthropic_key,
                "model": "claude-3-sonnet-20240229"
            },
            headers=headers
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            print(f"   Response: {response.json()}")
        else:
            print(f"   Error: {response.text}")
    else:
        print("   No ANTHROPIC_API_KEY found in environment")
    
    # 2. Get configured providers
    print("\n2. Getting configured providers...")
    response = requests.get(
        f"{BASE_URL}/api/v1/ai-config/providers",
        headers=headers
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Active provider: {data.get('active_provider', 'None')}")
        print(f"   Total configured: {data.get('total_configured', 0)}")
        for provider in data.get('providers', []):
            print(f"   - {provider['name']}: {'✓' if provider['configured'] else '✗'} configured, {'✓' if provider['enabled'] else '✗'} enabled")
    else:
        print(f"   Error: {response.text}")
    
    # 3. Test terminal AI query
    print("\n3. Testing terminal AI query...")
    response = requests.post(
        f"{BASE_URL}/api/v1/terminal/ai-query",
        json={"query": "What is the best temperature for printing PLA?"},
        headers=headers
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Provider: {data['provider']}")
        print(f"   Model: {data['model']}")
        print(f"   Response: {data['response'][:200]}...")
    else:
        print(f"   Error: {response.text}")
    
    # 4. Test terminal command with AI
    print("\n4. Testing terminal command...")
    response = requests.post(
        f"{BASE_URL}/api/v1/terminal/command",
        json={
            "command": "create a python script to calculate fibonacci numbers",
            "history": []
        },
        headers=headers
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Response: {data['response'][:200]}...")
    else:
        print(f"   Error: {response.text}")
    
    print("\n=== Test Complete ===")

if __name__ == "__main__":
    test_ai_providers()