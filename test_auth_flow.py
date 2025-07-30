#!/usr/bin/env python3
"""
Comprehensive test of auth flow
"""
import httpx
import asyncio
import sqlite3
import sys
sys.path.insert(0, '.')

from passlib.context import CryptContext

async def test_complete_flow():
    """Test the complete auth flow step by step"""
    # Test credentials
    username = "testuser"
    email = "test@example.com"
    password = "password123"
    
    print("="*60)
    print("AUTHENTICATION FLOW TEST")
    print("="*60)
    
    async with httpx.AsyncClient() as client:
        # 1. Test signup
        print("\n1. SIGNUP TEST")
        print(f"   Username: {username}")
        print(f"   Email: {email}")
        print(f"   Password: {password}")
        
        signup_response = await client.post(
            "http://localhost:8000/api/v1/auth/signup",
            json={
                "username": username,
                "email": email,
                "password": password,
                "recaptcha_token": "dummy"
            }
        )
        
        print(f"   Status: {signup_response.status_code}")
        print(f"   Response: {signup_response.json()}")
        
        if signup_response.status_code != 200:
            print("   ❌ Signup failed!")
            return
            
        # 2. Check database
        print("\n2. DATABASE CHECK")
        conn = sqlite3.connect('wit.db')
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, email, hashed_password, is_active FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        if not user:
            print("   ❌ User not in database!")
            return
            
        print(f"   ✅ User in database:")
        print(f"      ID: {user[0]}")
        print(f"      Username: {user[1]}")
        print(f"      Email: {user[2]}")
        print(f"      Active: {user[4]}")
        print(f"      Hash: {user[3][:40]}...")
        
        # 3. Test password verification directly
        print("\n3. PASSWORD VERIFICATION TEST")
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        is_valid = pwd_context.verify(password, user[3])
        print(f"   Direct verification: {'✅ PASS' if is_valid else '❌ FAIL'}")
        
        # 4. Test with auth modules
        print("\n4. AUTH MODULE TEST")
        from software.backend.auth.security import verify_password as backend_verify
        backend_valid = backend_verify(password, user[3])
        print(f"   Backend auth.security: {'✅ PASS' if backend_valid else '❌ FAIL'}")
        
        conn.close()
        
        # 5. Test login endpoint
        print("\n5. LOGIN ENDPOINT TEST")
        print(f"   Attempting login with {username}/{password}")
        
        # Try form data
        login_response = await client.post(
            "http://localhost:8000/api/v1/auth/token",
            data={
                "username": username,
                "password": password
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded"
            }
        )
        
        print(f"   Status: {login_response.status_code}")
        if login_response.status_code == 200:
            print("   ✅ Login successful!")
            print(f"   Token: {login_response.json()['access_token'][:30]}...")
        else:
            print("   ❌ Login failed!")
            print(f"   Response: {login_response.json()}")
            
        # 6. Try with curl to rule out client issues
        print("\n6. CURL TEST")
        import subprocess
        curl_cmd = f'curl -X POST "http://localhost:8000/api/v1/auth/token" -H "Content-Type: application/x-www-form-urlencoded" -d "username={username}&password={password}"'
        result = subprocess.run(curl_cmd, shell=True, capture_output=True, text=True)
        print(f"   Curl response: {result.stdout}")

if __name__ == "__main__":
    asyncio.run(test_complete_flow())