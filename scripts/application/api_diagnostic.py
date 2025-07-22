#!/usr/bin/env python3
"""
Test the running server's API endpoints directly
"""
import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def test_api():
    print("\n=== W.I.T. API DIAGNOSTIC ===\n")
    
    # 1. Check if server is running
    try:
        response = requests.get(f"{BASE_URL}/")
        print("✅ Server is running")
        print(f"   Version: {response.json().get('version', 'Unknown')}")
    except Exception as e:
        print(f"❌ Server not reachable: {e}")
        print("   Make sure dev_server.py is running!")
        return
    
    # 2. List all printers
    print("\n📋 Listing all printers:")
    try:
        response = requests.get(f"{BASE_URL}/api/v1/equipment/printers")
        printers = response.json()
        
        if not printers:
            print("   No printers found on server")
        else:
            for printer in printers:
                print(f"\n   Printer: {printer.get('id', 'Unknown ID')}")
                print(f"   - Name: {printer.get('name', 'Unknown')}")
                print(f"   - Type: {printer.get('connection_type', 'Unknown')}")
                print(f"   - Connected: {printer.get('connected', False)}")
                print(f"   - State: {printer.get('state', 'Unknown')}")
    except Exception as e:
        print(f"   Error listing printers: {e}")
    
    # 3. Test specific printer if ID provided
    if len(sys.argv) > 1:
        printer_id = sys.argv[1]
        print(f"\n🔍 Testing printer: {printer_id}")
        
        try:
            response = requests.get(f"{BASE_URL}/api/v1/equipment/printers/{printer_id}")
            if response.status_code == 200:
                data = response.json()
                print(f"   Found printer!")
                print(f"   Response: {json.dumps(data, indent=2)}")
            else:
                print(f"   HTTP {response.status_code}: {response.text}")
        except Exception as e:
            print(f"   Error: {e}")
    
    # 4. Test authentication
    print("\n🔐 Testing authentication:")
    try:
        # Try to login
        login_data = {"username": "admin", "password": "admin"}
        response = requests.post(f"{BASE_URL}/api/v1/auth/login", json=login_data)
        
        if response.status_code == 200:
            token = response.json().get("access_token")
            print("   ✅ Login successful")
            
            # Test authenticated endpoint
            headers = {"Authorization": f"Bearer {token}"}
            response = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=headers)
            user_data = response.json()
            print(f"   Logged in as: {user_data.get('username', 'Unknown')}")
        else:
            print(f"   ❌ Login failed: {response.status_code}")
    except Exception as e:
        print(f"   Error: {e}")

if __name__ == "__main__":
    print("Usage: python3 api_diagnostic.py [printer_id]")
    test_api()