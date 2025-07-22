#!/usr/bin/env python3
import requests
import json

# Add a simulated printer
printer_data = {
    "printer_id": "simulated-printer-1",
    "name": "Simulated Prusa MK3S",
    "connection_type": "simulated",
    "model": "Prusa i3 MK3S+",
    "manufacturer": "Prusa Research"
}

try:
    response = requests.post(
        "http://localhost:8000/api/v1/equipment/printers",
        json=printer_data
    )
    
    if response.status_code in [200, 201]:
        print("✅ Added simulated printer successfully")
        
        # Verify it's working
        status_response = requests.get(
            f"http://localhost:8000/api/v1/equipment/printers/{printer_data['printer_id']}"
        )
        
        if status_response.status_code == 200:
            status = status_response.json()
            print(f"   Status: {status.get('state', 'Unknown')}")
            print(f"   Connected: {status.get('connected', False)}")
        else:
            print("⚠️  Could not verify printer status")
    else:
        print(f"❌ Failed to add printer: {response.status_code}")
        print(f"   Response: {response.text}")
        
except Exception as e:
    print(f"❌ Error: {e}")
    print("   Make sure the backend server is running!")
