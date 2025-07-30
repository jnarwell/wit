#!/usr/bin/env python3
"""
Simple login test without ORM
"""
import httpx
import asyncio

async def test_login(username: str, password: str):
    """Test login via HTTP"""
    async with httpx.AsyncClient() as client:
        # Test the login endpoint
        response = await client.post(
            "http://localhost:8000/api/v1/auth/token",
            data={
                "username": username,
                "password": password
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded"
            }
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            token = response.json()["access_token"]
            print(f"\nSuccess! Token: {token[:20]}...")
            
            # Test the token by calling a protected endpoint
            auth_response = await client.get(
                "http://localhost:8000/api/v1/accounts/linked",
                headers={
                    "Authorization": f"Bearer {token}"
                }
            )
            print(f"\nProtected endpoint test: {auth_response.status_code}")

if __name__ == "__main__":
    import sys
    username = sys.argv[1] if len(sys.argv) > 1 else "jamie"
    password = sys.argv[2] if len(sys.argv) > 2 else "12345"
    
    print(f"Testing login for {username}...")
    asyncio.run(test_login(username, password))