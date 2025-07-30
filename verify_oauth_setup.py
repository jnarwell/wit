#!/usr/bin/env python3
"""
Verify OAuth Setup with Google Credentials
"""
import os
import asyncio
import httpx
import json

async def verify_oauth():
    print("=== OAuth Setup Verification ===\n")
    
    # Check environment variables
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    
    print("1. Environment Variables:")
    print(f"   GOOGLE_CLIENT_ID: {'✓ Set' if client_id else '✗ Not set'}")
    print(f"   GOOGLE_CLIENT_SECRET: {'✓ Set' if client_secret else '✗ Not set'}")
    
    if client_secret:
        print(f"   Secret starts with: {client_secret[:10]}...")
    
    # Test OAuth flow
    print("\n2. Testing OAuth Flow:")
    
    # Get auth token
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/v1/auth/token",
            data={"username": "verifyuser", "password": "verifypass123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        token = response.json()["access_token"]
        print(f"   ✓ Auth token obtained")
    
    # Get OAuth URL
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/v1/accounts/link/google",
            headers={"Authorization": f"Bearer {token}"}
        )
        oauth_data = response.json()
        print(f"   ✓ OAuth URL generated")
        print(f"   State: {oauth_data['state']}")
    
    # Parse the auth URL to verify client_id
    from urllib.parse import urlparse, parse_qs
    parsed = urlparse(oauth_data['auth_url'])
    params = parse_qs(parsed.query)
    
    print(f"\n3. OAuth URL Components:")
    print(f"   Client ID in URL: {params['client_id'][0][:20]}...")
    print(f"   Redirect URI: {params['redirect_uri'][0]}")
    print(f"   Scopes: {params['scope'][0]}")
    
    print(f"\n4. Ready to Test!")
    print(f"   Open this URL in your browser:")
    print(f"   {oauth_data['auth_url'][:100]}...")
    print(f"\n   After authorization, check if the account appears in Settings.")

if __name__ == "__main__":
    asyncio.run(verify_oauth())