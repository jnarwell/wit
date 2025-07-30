#!/usr/bin/env python3
"""
Debug signup and login flow
"""
import httpx
import asyncio
import json

async def test_signup_and_login():
    """Test the complete signup and login flow"""
    async with httpx.AsyncClient() as client:
        # Test data
        test_user = {
            "username": "testuser123",
            "email": "testuser123@example.com", 
            "password": "TestPass123!"
        }
        
        print("1. Testing Signup...")
        print(f"   Username: {test_user['username']}")
        print(f"   Email: {test_user['email']}")
        print(f"   Password: {test_user['password']}")
        
        # Signup
        signup_response = await client.post(
            "http://localhost:8000/api/v1/auth/signup",
            json={
                **test_user,
                "recaptcha_token": "dummy-token"
            }
        )
        
        print(f"\n   Signup Status: {signup_response.status_code}")
        print(f"   Signup Response: {signup_response.json()}")
        
        if signup_response.status_code != 200:
            print("   ❌ Signup failed!")
            return
            
        print("   ✅ Signup successful!")
        
        # Wait a bit
        await asyncio.sleep(1)
        
        # Try login
        print("\n2. Testing Login...")
        login_response = await client.post(
            "http://localhost:8000/api/v1/auth/token",
            data={
                "username": test_user["username"],
                "password": test_user["password"]
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded"
            }
        )
        
        print(f"   Login Status: {login_response.status_code}")
        
        if login_response.status_code == 200:
            token_data = login_response.json()
            print(f"   ✅ Login successful!")
            print(f"   Token: {token_data['access_token'][:20]}...")
        else:
            print(f"   ❌ Login failed!")
            print(f"   Response: {login_response.json()}")
            
            # Let's check the database directly
            print("\n3. Checking database...")
            import sqlite3
            conn = sqlite3.connect('wit.db')
            cursor = conn.cursor()
            cursor.execute("SELECT username, email, is_active, hashed_password FROM users WHERE username = ?", (test_user['username'],))
            user = cursor.fetchone()
            
            if user:
                print(f"   User found in DB:")
                print(f"   - Username: {user[0]}")
                print(f"   - Email: {user[1]}")
                print(f"   - Is Active: {user[2]}")
                print(f"   - Hash starts with: {user[3][:30]}...")
                
                # Test password verification
                from passlib.context import CryptContext
                pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
                is_valid = pwd_context.verify(test_user["password"], user[3])
                print(f"   - Password valid (direct check): {is_valid}")
            else:
                print("   ❌ User not found in database!")
            
            conn.close()

if __name__ == "__main__":
    asyncio.run(test_signup_and_login())