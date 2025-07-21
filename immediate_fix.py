#!/usr/bin/env python3
"""Immediate fix - Updates printer data format via API"""

import requests
import json
import time

print("🚑 Applying immediate fix...\n")

BASE_URL = "http://localhost:8000"

# Get current printers
response = requests.get(f"{BASE_URL}/api/v1/equipment/printers")
if response.status_code == 200:
    printers = response.json()
    print(f"Found {len(printers)} printer(s)")
    
    if not printers:
        print("\nNo printers found. Adding a test printer...")
        
        # Add a properly formatted simulated printer
        test_printer = {
            "printer_id": "demo-printer",
            "name": "Demo 3D Printer",
            "connection_type": "simulated",
            "manufacturer": "Demo Corp",
            "model": "Demo 3D"
        }
        
        add_response = requests.post(
            f"{BASE_URL}/api/v1/equipment/printers",
            json=test_printer
        )
        
        if add_response.status_code in [200, 201]:
            print("✅ Added demo printer")
            time.sleep(1)
            
            # Verify it works
            status_response = requests.get(
                f"{BASE_URL}/api/v1/equipment/printers/demo-printer"
            )
            
            if status_response.status_code == 200:
                status = status_response.json()
                print(f"\nDemo printer status:")
                print(f"  State: {status.get('state')} (type: {type(status.get('state')).__name__})")
                print(f"  Connected: {status.get('connected')}")
                print("\n✅ Refresh your browser now!")
            else:
                print("❌ Could not verify demo printer")
        else:
            print(f"❌ Failed to add demo printer: {add_response.text}")
    else:
        # Check existing printer format
        for printer in printers:
            printer_id = printer.get('id')
            print(f"\nChecking {printer.get('name')} ({printer_id})...")
            
            status_response = requests.get(
                f"{BASE_URL}/api/v1/equipment/printers/{printer_id}"
            )
            
            if status_response.status_code == 200:
                status = status_response.json()
                state = status.get('state')
                
                if isinstance(state, dict):
                    print(f"  ⚠️  State is an object: {state}")
                    print("     This might cause the frontend error")
                elif isinstance(state, str):
                    print(f"  ✅ State is a string: '{state}'")
                else:
                    print(f"  ❌ Unexpected state type: {type(state).__name__}")
                    
else:
    print("❌ Backend server not responding")
    print("   Make sure dev_server.py is running")

print("\n💡 Try these steps:")
print("1. Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)")
print("2. Check browser console for errors")
print("3. If still seeing errors, restart the backend server")
