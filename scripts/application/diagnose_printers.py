#!/usr/bin/env python3
"""Diagnose the current printer state in backend"""

import requests
import json

print("🔍 Diagnosing printer state...\n")

# Get all printers
response = requests.get("http://localhost:8000/api/v1/equipment/printers")
if response.status_code == 200:
    printers = response.json()
    print(f"Found {len(printers)} printer(s):\n")
    
    for printer in printers:
        print(f"Printer ID: {printer.get('id')}")
        print(f"  Name: {printer.get('name')}")
        print(f"  Type: {printer.get('connection_type')}")
        print(f"  State: {printer.get('state')}")
        print(f"  Connected: {printer.get('connected')}")
        
        # Try to get detailed status
        status_response = requests.get(f"http://localhost:8000/api/v1/equipment/printers/{printer['id']}")
        if status_response.status_code == 200:
            status = status_response.json()
            temps = status.get('temperatures', {})
            if temps:
                nozzle = temps.get('nozzle', {})
                bed = temps.get('bed', {})
                print(f"  Nozzle: {nozzle.get('current', 0)}°C / {nozzle.get('target', 0)}°C")
                print(f"  Bed: {bed.get('current', 0)}°C / {bed.get('target', 0)}°C")
        else:
            print(f"  Status error: {status_response.status_code}")
        print()
else:
    print("Failed to get printers")

print("\n💡 Check the backend console for error messages!")
