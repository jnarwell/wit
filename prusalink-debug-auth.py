#!/usr/bin/env python3
"""
Debug PrusaLink Authentication
"""

import asyncio
import aiohttp
import base64
import json

async def test_prusalink_auth():
    """Test different authentication methods with PrusaLink"""
    
    # Configuration
    ip = "192.168.1.134"
    username = "maker"
    password = "GkSsqbykCym6Xd8"  # Your actual password
    
    print(f"🔍 Testing PrusaLink Authentication Methods")
    print(f"   Host: {ip}")
    print(f"   Username: {username}")
    print(f"   Password: {password}")
    print("=" * 50)
    
    timeout = aiohttp.ClientTimeout(total=5)
    
    # Test 1: No auth (should fail with 401)
    print("\n1️⃣ Testing without authentication...")
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(f"http://{ip}/api/printer") as response:
                print(f"   Status: {response.status}")
                print(f"   Headers: {dict(response.headers)}")
                if response.status == 401:
                    print("   ✅ Correctly requires authentication")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 2: Basic Auth (standard method)
    print("\n2️⃣ Testing Basic Authentication...")
    auth_str = f"{username}:{password}"
    auth_bytes = auth_str.encode('utf-8')
    auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
    headers = {"Authorization": f"Basic {auth_b64}"}
    
    print(f"   Auth string: {auth_str}")
    print(f"   Base64: {auth_b64}")
    print(f"   Header: {headers['Authorization']}")
    
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(f"http://{ip}/api/printer", headers=headers) as response:
                print(f"   Status: {response.status}")
                if response.status == 200:
                    print("   ✅ Authentication successful!")
                    data = await response.json()
                    print(f"   Response: {json.dumps(data, indent=2)[:200]}...")
                else:
                    print(f"   ❌ Authentication failed")
                    text = await response.text()
                    print(f"   Response: {text[:200]}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 3: Try with aiohttp built-in auth
    print("\n3️⃣ Testing with aiohttp BasicAuth...")
    auth = aiohttp.BasicAuth(username, password)
    
    try:
        async with aiohttp.ClientSession(timeout=timeout, auth=auth) as session:
            async with session.get(f"http://{ip}/api/printer") as response:
                print(f"   Status: {response.status}")
                if response.status == 200:
                    print("   ✅ Authentication successful!")
                else:
                    print(f"   ❌ Authentication failed")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 4: Try different endpoints
    print("\n4️⃣ Testing different endpoints...")
    endpoints = ["/api/version", "/api/printer", "/api/status", "/"]
    
    for endpoint in endpoints:
        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(f"http://{ip}{endpoint}", headers=headers) as response:
                    print(f"   {endpoint}: Status {response.status}")
                    if response.status == 200:
                        if endpoint == "/api/version":
                            data = await response.json()
                            print(f"      Version info: {data}")
        except Exception as e:
            print(f"   {endpoint}: Error - {e}")
    
    # Test 5: Check if it's using Digest auth instead
    print("\n5️⃣ Checking authentication method...")
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(f"http://{ip}/api/printer") as response:
                if response.status == 401:
                    www_auth = response.headers.get('WWW-Authenticate', '')
                    print(f"   WWW-Authenticate header: {www_auth}")
                    if 'Digest' in www_auth:
                        print("   ⚠️  Server wants Digest authentication, not Basic!")
                    elif 'Basic' in www_auth:
                        print("   ✅ Server expects Basic authentication")
                        realm = www_auth.split('realm="')[1].split('"')[0] if 'realm=' in www_auth else 'Unknown'
                        print(f"   Realm: {realm}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_prusalink_auth())