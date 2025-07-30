#!/usr/bin/env python3
"""
Final auth test after fixes
"""
import requests

# Test with our known good user
username = "testauth"
password = "testpass123"

print("Testing fixed auth endpoint...")
response = requests.post(
    "http://localhost:8000/api/v1/auth/token",
    data={"username": username, "password": password},
    headers={"Content-Type": "application/x-www-form-urlencoded"}
)

print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")

if response.status_code == 200:
    print("\n✅ LOGIN FIXED!")
    
    # Now test signup
    print("\nTesting signup...")
    signup_response = requests.post(
        "http://localhost:8000/api/v1/auth/signup",
        json={
            "username": "newuser",
            "email": "new@example.com",
            "password": "newpass123",
            "recaptcha_token": "dummy"
        }
    )
    print(f"Signup status: {signup_response.status_code}")
    print(f"Signup response: {signup_response.json()}")
    
    if signup_response.status_code == 200:
        # Try to login with new user
        print("\nTrying to login with new user...")
        new_login = requests.post(
            "http://localhost:8000/api/v1/auth/token",
            data={"username": "newuser", "password": "newpass123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        print(f"New user login: {new_login.status_code}")
        if new_login.status_code == 200:
            print("✅ COMPLETE AUTH FLOW WORKING!")