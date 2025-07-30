#!/usr/bin/env python3
"""
Test simple auth endpoint
"""
import requests

# Test with the user we created directly
username = "directtest"
password = "password123"

print("Testing simple auth endpoint...")
response = requests.post(
    "http://localhost:8000/api/v1/auth/simple-token",
    data={"username": username, "password": password},
    headers={"Content-Type": "application/x-www-form-urlencoded"}
)

print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")

if response.status_code == 200:
    print(f"\n✅ SUCCESS with simple endpoint!")
    print("The issue is confirmed to be with the ORM in the main login endpoint.")