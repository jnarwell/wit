#!/usr/bin/env python3
"""Test the printer API with better error visibility"""

import requests
import json

print("Testing printer API...\n")

# Get printer list
response = requests.get("http://localhost:8000/api/v1/equipment/printers")
if response.status_code == 200:
    printers = response.json()
    print(f"Found {len(printers)} printer(s)\n")
    
    for printer in printers:
        print(f"Printer: {printer.get('name')} ({printer.get('id')})")
        print(f"  Type: {printer.get('connection_type')}")
        print(f"  State: {printer.get('state')}")
        if printer.get('error'):
            print(f"  ERROR: {printer['error']}")
        print()
        
        # Get detailed status
        detail_response = requests.get(
            f"http://localhost:8000/api/v1/equipment/printers/{printer['id']}"
        )
        if detail_response.status_code == 200:
            details = detail_response.json()
            print(f"  Detailed state: {details.get('state')}")
            print(f"  Temperatures: {details.get('temperatures', {})}")
        print("-" * 40)
else:
    print(f"Failed to get printers: {response.status_code}")

print("\nCheck the backend console for detailed error messages!")
