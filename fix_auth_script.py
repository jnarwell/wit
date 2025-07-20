#!/usr/bin/env python3
"""
Quick script to diagnose and fix the authentication issue
"""

import requests
import json

def test_auth_endpoints():
    """Test if auth is required and if we can login"""
    print("\n🔍 Testing Authentication Requirements...\n")
    
    # Test if equipment endpoints require auth
    print("1. Testing if /api/v1/equipment/printers requires auth:")
    r = requests.get("http://localhost:8000/api/v1/equipment/printers")
    if r.status_code == 401:
        print("   ❌ YES - Authentication required (401)")
    else:
        print(f"   ✅ NO - Open endpoint (Status: {r.status_code})")
    
    # Test login endpoint
    print("\n2. Testing login endpoint:")
    login_data = {
        "username": "admin",
        "password": "admin"
    }
    
    try:
        r = requests.post(
            "http://localhost:8000/api/v1/auth/login",
            json=login_data
        )
        if r.status_code == 200:
            token = r.json().get("access_token")
            print(f"   ✅ Login successful! Token: {token[:20]}...")
            return token
        else:
            print(f"   ❌ Login failed: {r.status_code}")
            # Try form data instead of JSON
            r = requests.post(
                "http://localhost:8000/api/v1/auth/token",
                data=login_data  # form data, not JSON
            )
            if r.status_code == 200:
                token = r.json().get("access_token")
                print(f"   ✅ Login successful with form data! Token: {token[:20]}...")
                return token
    except Exception as e:
        print(f"   ❌ Login error: {e}")
    
    return None

def test_with_auth(token):
    """Test equipment endpoints with auth token"""
    print("\n3. Testing equipment endpoints WITH authentication:")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    # Test add printer
    printer_data = {
        "printer_id": "TEST123",
        "name": "Test Printer",
        "connection_type": "usb",
        "manufacturer": "Test",
        "model": "Model X"
    }
    
    r = requests.post(
        "http://localhost:8000/api/v1/equipment/printers",
        json=printer_data,
        headers=headers
    )
    
    if r.status_code == 200:
        print("   ✅ Successfully added printer with auth!")
        print(f"   Response: {r.json()}")
    else:
        print(f"   ❌ Failed with auth: {r.status_code}")
        print(f"   Response: {r.text}")

def create_auth_disabled_patch():
    """Create a patch file to disable auth"""
    patch_content = '''
# Add this to your dev_server.py to disable auth for equipment endpoints

# After loading the equipment router, add:
@app.post("/api/v1/equipment/printers", dependencies=[])
async def add_printer_no_auth(request: PrinterAddRequest):
    """Override with no auth version"""
    # Copy the implementation from equipment_api.py
    # but remove the current_user dependency
    pass
'''
    
    print("\n📝 To disable auth, modify your dev_server.py:")
    print("-" * 60)
    print(patch_content)
    print("-" * 60)

def main():
    print("🔧 W.I.T. Authentication Issue Fixer")
    print("=" * 60)
    
    # Test auth
    token = test_auth_endpoints()
    
    if token:
        test_with_auth(token)
        print("\n✅ SOLUTION: Add authentication to your frontend requests")
        print("   Copy the auth helper code to your MachinesPage.tsx")
    else:
        print("\n❌ Cannot authenticate with default credentials")
        print("\n🔧 SOLUTIONS:")
        print("1. Use the no-auth dev server (recommended for development)")
        print("2. Find the correct login credentials")
        print("3. Disable auth in dev_server.py")
        
        create_auth_disabled_patch()
    
    print("\n" + "=" * 60)
    print("Quick fixes:")
    print("1. Stop current dev_server.py")
    print("2. Run: python3 dev_server_no_auth.py")
    print("   (This version has auth disabled for development)")

if __name__ == "__main__":
    main()