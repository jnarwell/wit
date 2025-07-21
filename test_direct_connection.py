#!/usr/bin/env python3
"""Test printer connection directly"""

import requests
from requests.auth import HTTPDigestAuth

print("🧪 Direct PrusaLink Test\n")

# Your printer details
ip = "192.168.1.134"
username = "maker"
password = "GkSsqbykCym6Xd8"

print(f"Testing connection to {ip}...")

try:
    # Test direct connection
    auth = HTTPDigestAuth(username, password)
    response = requests.get(f"http://{ip}/api/printer", auth=auth, timeout=5)
    
    if response.status_code == 200:
        print("✅ Direct connection successful!")
        data = response.json()
        
        print("\nRaw response type:", type(data))
        print("Has telemetry?", "telemetry" in data if isinstance(data, dict) else False)
        print("Has state?", "state" in data if isinstance(data, dict) else False)
        
        if isinstance(data, dict):
            telemetry = data.get("telemetry", {})
            state = data.get("state", {})
            
            print(f"\nState: {state.get('text', 'Unknown') if isinstance(state, dict) else 'Invalid'}")
            print(f"Nozzle temp: {telemetry.get('temp-nozzle', 'N/A') if isinstance(telemetry, dict) else 'Invalid'}")
            print(f"Bed temp: {telemetry.get('temp-bed', 'N/A') if isinstance(telemetry, dict) else 'Invalid'}")
        else:
            print("\n❌ Unexpected response format:", data)
    else:
        print(f"❌ Connection failed: {response.status_code}")
        
except Exception as e:
    print(f"❌ Error: {e}")

print("\n💡 Check if the response format matches what the backend expects")
