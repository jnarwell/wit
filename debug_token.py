#!/usr/bin/env python3
"""
Debug token decoding
"""
import sys
sys.path.insert(0, '.')

from software.backend.auth.security import decode_access_token
from software.backend.services.auth_services import AuthService
import requests

# Login to get a token
response = requests.post(
    "http://localhost:8000/api/v1/auth/token",
    data={"username": "verifyuser", "password": "verifypass123"},
    headers={"Content-Type": "application/x-www-form-urlencoded"}
)

if response.status_code == 200:
    tokens = response.json()
    token = tokens['access_token']
    print(f"Token: {token[:50]}...")
    
    # Test backend.auth.security decode
    print("\n1. Testing backend.auth.security.decode_access_token:")
    result = decode_access_token(token)
    print(f"   Result: {result}")
    
    # Test auth_services decode
    print("\n2. Testing auth_services.decode_token:")
    auth_service = AuthService()
    result = auth_service.decode_token(token)
    print(f"   Result: {result}")
    
    # Decode manually to see what's in the token
    print("\n3. Manual decode:")
    import jwt
    from software.backend.auth.security import SECRET_KEY, ALGORITHM
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        print(f"   Payload: {payload}")
    except Exception as e:
        print(f"   Error: {e}")
else:
    print(f"Login failed: {response.text}")