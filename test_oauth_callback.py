#!/usr/bin/env python3
"""
Test OAuth Callback Flow
"""
import asyncio
import httpx
import json

async def test_oauth_flow():
    # First, get an auth token
    print("1. Getting auth token...")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/v1/auth/token",
            data={
                "username": "verifyuser",
                "password": "verifypass123"
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        auth_data = response.json()
        token = auth_data["access_token"]
        print(f"   Token obtained: {token[:20]}...")
    
    # Get OAuth URL
    print("\n2. Getting OAuth URL...")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/v1/accounts/link/google",
            headers={"Authorization": f"Bearer {token}"}
        )
        oauth_data = response.json()
        print(f"   Auth URL: {oauth_data['auth_url'][:100]}...")
        print(f"   State: {oauth_data['state']}")
    
    # Check linked accounts
    print("\n3. Checking linked accounts...")
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "http://localhost:8000/api/v1/accounts/linked",
            headers={"Authorization": f"Bearer {token}"}
        )
        accounts = response.json()
        print(f"   Linked accounts: {json.dumps(accounts, indent=2)}")
    
    print("\n4. OAuth Flow:")
    print("   - Copy the Auth URL above and open it in your browser")
    print("   - Authorize with Google")
    print("   - Check the server logs for callback activity")
    print("   - Run this script again to see if the account was linked")

if __name__ == "__main__":
    asyncio.run(test_oauth_flow())