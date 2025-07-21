#!/usr/bin/env python3
"""
Quick test to see if your printer accepts G-code commands
This is how PrusaConnect likely controls temperature!
"""

import requests
from requests.auth import HTTPDigestAuth

print("🔧 G-code Command Test for PrusaLink\n")

# Get connection details
ip = input("Printer IP: ").strip()
username = input("Username (press Enter for 'maker'): ").strip() or "maker"
password = input("Password: ").strip()

if not ip.startswith('http'):
    ip = f'http://{ip}'

auth = HTTPDigestAuth(username, password)

print("\n🧪 Testing G-code endpoints...\n")

# Safe G-code to test with (just reads temperature)
test_gcode = "M105"

# Try different endpoint/format combinations
tests = [
    {"url": f"{ip}/api/printer/command", "data": {"command": test_gcode}},
    {"url": f"{ip}/api/gcode", "data": {"command": test_gcode}},
    {"url": f"{ip}/api/printer/gcode", "data": {"commands": [test_gcode]}},
    {"url": f"{ip}/api/v1/printer/gcode", "data": {"gcode": test_gcode}},
]

working = None

for test in tests:
    try:
        print(f"Trying: {test['url']}")
        response = requests.post(test['url'], json=test['data'], auth=auth, timeout=5)
        
        if response.status_code in [200, 201, 204]:
            print(f"✅ SUCCESS! Status: {response.status_code}")
            if response.text:
                print(f"   Response: {response.text[:100]}")
            working = test
            break
        else:
            print(f"❌ Failed: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

print("\n" + "="*50 + "\n")

if working:
    print("🎉 Found working G-code endpoint!\n")
    print(f"Endpoint: {working['url']}")
    print(f"Format: {working['data']}")
    print("\n📝 To set temperature, use these G-codes:")
    print("   Nozzle: M104 S[temperature]")
    print("   Bed: M140 S[temperature]")
    print("\nExample to set nozzle to 200°C:")
    
    # Show the exact format
    if "commands" in working['data']:
        print(f'   {{"commands": ["M104 S200"]}}')
    elif "gcode" in working['data']:
        print(f'   {{"gcode": "M104 S200"}}')
    else:
        print(f'   {{"command": "M104 S200"}}')
    
    # Try to actually set temperature
    print("\n🌡️  Want to test setting nozzle to 30°C? (safe temp)")
    if input("Type 'yes' to test: ").lower() == 'yes':
        temp_data = working['data'].copy()
        if "commands" in temp_data:
            temp_data["commands"] = ["M104 S30"]
        elif "gcode" in temp_data:
            temp_data["gcode"] = "M104 S30"
        else:
            temp_data["command"] = "M104 S30"
            
        try:
            response = requests.post(working['url'], json=temp_data, auth=auth, timeout=5)
            if response.status_code in [200, 201, 204]:
                print("✅ Temperature command sent successfully!")
                print("Check your printer display - nozzle should start heating to 30°C")
            else:
                print(f"❌ Failed: HTTP {response.status_code}")
        except Exception as e:
            print(f"❌ Error: {e}")
            
else:
    print("❌ No G-code endpoint found")
    print("\n💡 Your printer might:")
    print("1. Need G-code enabled in settings")
    print("2. Use a different API")
    print("3. Require different authentication")
    print("\nTry the browser DevTools method to see what PrusaConnect uses!")