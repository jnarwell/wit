#!/usr/bin/env python3
"""Test project creation"""
import requests

BASE_URL = "http://localhost:8000"

# Login first
login_response = requests.post(
    f"{BASE_URL}/api/v1/auth/token",
    data={"username": "admin", "password": "admin"},
    headers={"Content-Type": "application/x-www-form-urlencoded"}
)

if login_response.status_code == 200:
    print("✅ Login successful!")
    token = login_response.json()["access_token"]
    
    # Create a project
    project_data = {
        "name": "Test Project",
        "description": "Testing project creation",
        "type": "software",
        "status": "in_progress",
        "priority": "high"
    }
    
    create_response = requests.post(
        f"{BASE_URL}/api/v1/projects/",
        json=project_data,
        headers={"Authorization": f"Bearer {token}"}
    )
    
    print(f"\nCreate project response:")
    print(f"Status: {create_response.status_code}")
    print(f"Body: {create_response.json()}")
    
    # List projects
    list_response = requests.get(
        f"{BASE_URL}/api/v1/projects/",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    print(f"\nList projects response:")
    print(f"Status: {list_response.status_code}")
    print(f"Body: {list_response.json()}")
else:
    print(f"❌ Login failed: {login_response.status_code}")