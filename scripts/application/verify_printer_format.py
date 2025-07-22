#!/usr/bin/env python3
"""Verify the printer data format is correct"""

import requests
import json

print("🔍 Verifying printer data format...\n")

# Get all printers
response = requests.get("http://localhost:8000/api/v1/equipment/printers")
if response.status_code == 200:
    printers = response.json()
    
    for printer in printers:
        printer_id = printer.get('id')
        print(f"Checking printer: {printer.get('name')} ({printer_id})")
        
        # Get detailed status
        status_response = requests.get(f"http://localhost:8000/api/v1/equipment/printers/{printer_id}")
        
        if status_response.status_code == 200:
            status = status_response.json()
            
            # Check state format
            state = status.get('state')
            print(f"  State value: '{state}' (type: {type(state).__name__})")
            
            if not isinstance(state, str):
                print("  ❌ ERROR: State should be a string!")
                print(f"     Got: {state}")
            else:
                print("  ✅ State format is correct")
            
            # Check temperatures format
            temps = status.get('temperatures', {})
            if temps:
                print("  ✅ Temperature data present")
                nozzle = temps.get('nozzle', {})
                if isinstance(nozzle, dict) and 'current' in nozzle:
                    print(f"     Nozzle: {nozzle['current']}°C")
                else:
                    print("  ⚠️  Nozzle temperature format issue")
            
            print()
        else:
            print(f"  ❌ Failed to get status: {status_response.status_code}")
else:
    print("❌ Failed to get printers")
    
print("\nIf state is a string, the widget should work!")
