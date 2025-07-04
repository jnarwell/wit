#!/usr/bin/env python3
"""Test if the voice API is working"""
import requests

# Test the voice API
url = "http://localhost:8000/api/v1/voice/test"
try:
    response = requests.get(url)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
    print("Make sure the server is running: python3 dev_server.py")
