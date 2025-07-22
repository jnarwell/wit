#!/usr/bin/env python3
"""
Test PrusaLink using requests library with Digest auth
"""

import requests
from requests.auth import HTTPDigestAuth

# Your credentials
ip = "192.168.1.134"
username = "maker"
password = "GkSsqbykCym6Xd8"

print(f"🔐 Testing PrusaLink with requests library")
print(f"   IP: {ip}")
print(f"   Username: {username}")
print(f"   Password: {password}")
print("=" * 50)

# Create Digest auth
auth = HTTPDigestAuth(username, password)

# Test connection
url = f"http://{ip}/api/printer"
print(f"\n🔌 Connecting to {url}...")

try:
    response = requests.get(url, auth=auth, timeout=5)
    
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        print("✅ Authentication successful!")
        
        data = response.json()
        state = data.get('state', {})
        telemetry = data.get('telemetry', {})
        
        print(f"\n📊 Printer Info:")
        print(f"   State: {state.get('text', 'Unknown')}")
        print(f"   Nozzle temp: {telemetry.get('temp-nozzle', 'N/A')}°C")
        print(f"   Bed temp: {telemetry.get('temp-bed', 'N/A')}°C")
        
        # Test other endpoints
        print("\n🧪 Testing other endpoints...")
        
        endpoints = ["/api/version", "/api/job", "/api/files"]
        for endpoint in endpoints:
            test_url = f"http://{ip}{endpoint}"
            r = requests.get(test_url, auth=auth, timeout=5)
            print(f"   {endpoint}: Status {r.status_code}")
            if r.status_code == 200 and endpoint == "/api/version":
                print(f"      {r.json()}")
        
    else:
        print(f"❌ Authentication failed: {response.status_code}")
        print(f"Response: {response.text}")
        
except Exception as e:
    print(f"❌ Error: {e}")