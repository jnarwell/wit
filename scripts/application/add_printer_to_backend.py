#!/usr/bin/env python3
"""
Add printer to backend with authentication
Save as: add_printer_with_auth.py
Run: python3 add_printer_with_auth.py
"""

import requests
import json
import time

# CHANGE THESE VALUES
PRINTER_IP = "192.168.1.100"  # Your printer's IP
PRUSALINK_PASSWORD = "YOUR_PASSWORD"  # Your PrusaLink password

# Backend credentials
USERNAME = "admin"  # or "maker"
PASSWORD = "admin"  # or "maker123" for maker user

def main():
    print("🔧 Adding printer to backend with authentication...\n")
    
    # Check if backend is running
    try:
        r = requests.get("http://localhost:8000/")
        print(f"✅ Backend is running: v{r.json()['version']}")
    except:
        print("❌ Backend not running! Start it with: python3 dev_server.py")
        return
    
    # Login first
    print(f"\n🔐 Logging in as '{USERNAME}'...")
    login_data = {
        "username": USERNAME,
        "password": PASSWORD
    }
    
    r = requests.post(
        "http://localhost:8000/api/v1/auth/login",
        json=login_data
    )
    
    if r.status_code != 200:
        print(f"❌ Login failed: {r.status_code} - {r.text}")
        return
    
    auth_response = r.json()
    access_token = auth_response["access_token"]
    print(f"✅ Login successful! Token: {access_token[:20]}...")
    
    # Set auth headers
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    # List current printers
    r = requests.get("http://localhost:8000/api/v1/equipment/printers", headers=headers)
    printers = r.json()
    print(f"\n📋 Current printers: {len(printers)}")
    for p in printers:
        print(f"  - {p.get('id', 'unknown')}: {p.get('name', 'unknown')}")
    
    # Add the printer
    print(f"\n➕ Adding printer...")
    printer_data = {
        "printer_id": "M1753050226643",
        "name": "3D Printer",
        "connection_type": "prusalink",
        "url": PRINTER_IP,
        "username": "maker",
        "password": PRUSALINK_PASSWORD,
        "manufacturer": "Prusa",
        "model": ""
    }
    
    r = requests.post(
        "http://localhost:8000/api/v1/equipment/printers",
        json=printer_data,
        headers=headers
    )
    
    if r.status_code == 200:
        print(f"✅ Printer added: {r.json()}")
    else:
        print(f"❌ Failed to add: {r.status_code} - {r.text}")
        return
    
    # Wait for data
    print("\n⏳ Waiting for PrusaLink data...")
    time.sleep(3)
    
    # Get the printer status
    r = requests.get(
        f"http://localhost:8000/api/v1/equipment/printers/M1753050226643",
        headers=headers
    )
    
    if r.status_code == 200:
        printer = r.json()
        print(f"\n✅ SUCCESS! Printer data:")
        print(f"   Name: {printer.get('name', 'Unknown')}")
        print(f"   Connected: {printer.get('connected', False)}")
        print(f"   State: {printer.get('state', {}).get('text', 'Unknown')}")
        
        if 'telemetry' in printer:
            print(f"\n🌡️  Real temperatures:")
            print(f"   Nozzle: {printer['telemetry'].get('temp-nozzle', 'N/A')}°C")
            print(f"   Bed: {printer['telemetry'].get('temp-bed', 'N/A')}°C")
        else:
            print("   No telemetry data yet")
            
        print("\n✅ The dashboard should now show real data!")
        print("💡 Refresh your browser if needed")
    else:
        print(f"❌ Failed to get printer: {r.status_code}")

if __name__ == "__main__":
    main()