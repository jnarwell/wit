#!/usr/bin/env python3
"""
Test /me endpoint
"""
import requests

# First login
response = requests.post(
    "http://localhost:8000/api/v1/auth/token",
    data={"username": "testuser", "password": "testpass"},
    headers={"Content-Type": "application/x-www-form-urlencoded"}
)

if response.status_code != 200:
    print("Creating test user...")
    # Create user
    signup_response = requests.post(
        "http://localhost:8000/api/v1/auth/signup",
        json={
            "username": "testuser",
            "email": "test@example.com",
            "password": "testpass",
            "recaptcha_token": "dummy"
        }
    )
    print(f"Signup: {signup_response.status_code}")
    
    # Try login again
    response = requests.post(
        "http://localhost:8000/api/v1/auth/token",
        data={"username": "testuser", "password": "testpass"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )

if response.status_code == 200:
    tokens = response.json()
    print(f"Login successful, got token: {tokens['access_token'][:50]}...")
    
    # Test /me endpoint
    me_response = requests.get(
        "http://localhost:8000/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    print(f"\n/me endpoint status: {me_response.status_code}")
    if me_response.status_code == 200:
        print(f"User info: {me_response.json()}")
    else:
        print(f"Error: {me_response.text}")
        
    # Test projects endpoint
    projects_response = requests.get(
        "http://localhost:8000/api/v1/projects",
        headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    print(f"\n/projects endpoint status: {projects_response.status_code}")
    if projects_response.status_code == 200:
        print(f"Projects: {projects_response.json()}")
    else:
        print(f"Error: {projects_response.text}")
else:
    print(f"Login failed: {response.text}")