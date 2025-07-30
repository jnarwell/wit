#!/usr/bin/env python3
"""
Test signup endpoint
"""
import requests
import time

# Test signup
username = f"newuser{int(time.time())}"
email = f"{username}@test.com"
password = "newpass123"

print(f"Testing signup with username: {username}")
response = requests.post(
    "http://localhost:8000/api/v1/auth/signup",
    json={
        "username": username,
        "email": email,
        "password": password,
        "recaptcha_token": "dummy"
    }
)

print(f"Signup status: {response.status_code}")
if response.status_code == 200:
    print(f"Signup response: {response.json()}")
    
    # Try to login
    print("\nTesting login with new user...")
    login_response = requests.post(
        "http://localhost:8000/api/v1/auth/token",
        data={"username": username, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    print(f"Login status: {login_response.status_code}")
    if login_response.status_code == 200:
        print("✅ SIGNUP AND LOGIN WORKING!")
    else:
        print(f"Login response: {login_response.json()}")
else:
    print(f"Signup error: {response.text}")