#!/usr/bin/env python3
"""
Simple test of the W.I.T. Printer Bridge concept
Run this to see if we can actually control your printer!
"""

import requests
from requests.auth import HTTPDigestAuth
import time

print("🌉 W.I.T. Printer Bridge Test\n")

# Your printer details
PRINTER_IP = "192.168.1.134"
PRINTER_USER = "maker"
PRINTER_PASS = "GkSsqbykCym6Xd8"

auth = HTTPDigestAuth(PRINTER_USER, PRINTER_PASS)
base_url = f"http://{PRINTER_IP}"

print(f"Testing printer control at {PRINTER_IP}...\n")

# Test 1: Can we send G-code?
print("📍 Test 1: Checking G-code endpoints")

gcode_tests = [
    # Safe G-code - just reads temperature
    {"endpoint": "/api/printer/command", "data": {"command": "M105"}},
    {"endpoint": "/api/gcode", "data": {"command": "M105"}},
    {"endpoint": "/api/printer/gcode", "data": {"commands": ["M105"]}},
    
    # Try PrusaLink v2 API
    {"endpoint": "/api/v1/printer/gcode", "data": {"gcode": "M105"}},
    
    # Direct serial-like endpoints
    {"endpoint": "/api/printer", "data": {"command": "M105"}},
    {"endpoint": "/api/cmd", "data": {"cmd": "M105"}},
]

working_endpoint = None

for test in gcode_tests:
    try:
        url = base_url + test["endpoint"]
        response = requests.post(url, json=test["data"], auth=auth, timeout=5)
        
        if response.status_code in [200, 201, 204]:
            print(f"✅ Found working endpoint: {test['endpoint']}")
            print(f"   Format: {test['data']}")
            working_endpoint = test
            break
        else:
            print(f"❌ {test['endpoint']} - HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ {test['endpoint']} - Error: {str(e)[:50]}")

print("\n" + "="*50 + "\n")

if working_endpoint:
    print("🎉 Found a way to control your printer!\n")
    
    # Test temperature control
    print("🌡️ Want to test temperature control?")
    print("This will set nozzle to 35°C (safe temperature)")
    
    if input("Type 'yes' to test: ").lower() == 'yes':
        # Set nozzle to 35°C
        gcode = "M104 S35"
        test_data = working_endpoint["data"].copy()
        
        # Update with temperature G-code
        if "command" in test_data:
            test_data["command"] = gcode
        elif "commands" in test_data:
            test_data["commands"] = [gcode]
        elif "gcode" in test_data:
            test_data["gcode"] = gcode
        elif "cmd" in test_data:
            test_data["cmd"] = gcode
            
        print(f"\nSending: {gcode}")
        
        try:
            response = requests.post(
                base_url + working_endpoint["endpoint"],
                json=test_data,
                auth=auth,
                timeout=5
            )
            
            if response.status_code in [200, 201, 204]:
                print("✅ Temperature command sent!")
                print("Check your printer - nozzle should start heating to 35°C")
                
                # Wait and check temperature
                time.sleep(3)
                print("\nChecking temperature...")
                
                # Try to read temperature
                status_response = requests.get(
                    f"{base_url}/api/v1/status",
                    auth=auth,
                    timeout=5
                )
                
                if status_response.status_code == 200:
                    data = status_response.json()
                    if "temperature" in data:
                        nozzle_temp = data["temperature"].get("tool0", {}).get("actual", "?")
                        print(f"Current nozzle temp: {nozzle_temp}°C")
                        
            else:
                print(f"❌ Command failed: HTTP {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error: {e}")
            
        # Turn off heater
        print("\nTurning off heater...")
        test_data["command"] = "M104 S0"
        try:
            requests.post(
                base_url + working_endpoint["endpoint"],
                json=test_data,
                auth=auth,
                timeout=5
            )
            print("✅ Heater turned off")
        except:
            print("⚠️  Remember to turn off heater manually!")
            
else:
    print("😕 No G-code endpoint found\n")
    print("Your printer might:")
    print("1. Need a firmware update")
    print("2. Require different authentication")
    print("3. Use a proprietary protocol")
    print("\nThe bridge concept would work with OctoPrint though!")

print("\n" + "="*50 + "\n")
print("💡 Bridge Architecture Summary:")
print("1. W.I.T. sends commands to bridge")
print("2. Bridge translates to G-code")
print("3. Bridge sends G-code to printer")
print("4. Bridge reports status back to W.I.T.")
print("\nThis would give you full control!")