#!/usr/bin/env python3
"""
Test OAuth Flow
This script tests the OAuth integration for Google
"""
import asyncio
import aiohttp
import webbrowser
from urllib.parse import urlencode

async def test_oauth_flow():
    """Test the OAuth flow"""
    # First, get an access token (you'll need to be logged in)
    # For testing, we'll assume you have a valid token
    
    print("Testing OAuth Flow...")
    print("=" * 80)
    
    # Test the link endpoint
    async with aiohttp.ClientSession() as session:
        # You'll need to provide a valid JWT token here
        # Get it from browser localStorage after logging in
        token = input("Please enter your JWT token from localStorage (access_token): ").strip()
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test linking Google account
        try:
            async with session.post(
                "http://localhost:8000/api/v1/accounts/link/google",
                headers=headers
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"Success! OAuth URL: {data['auth_url']}")
                    print(f"State: {data['state']}")
                    
                    # Open in browser
                    if input("\nOpen OAuth URL in browser? (y/n): ").lower() == 'y':
                        webbrowser.open(data['auth_url'])
                else:
                    print(f"Error: {response.status}")
                    print(await response.text())
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_oauth_flow())