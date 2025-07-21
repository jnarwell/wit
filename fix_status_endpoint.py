#!/usr/bin/env python3
"""Diagnose and fix PrusaLink connection issues"""

import requests
from requests.auth import HTTPDigestAuth
import json

print("🔍 Diagnosing PrusaLink connection issues...\n")

# Step 1: Check if backend is running
try:
    response = requests.get("http://localhost:8000/")
    if response.status_code == 200:
        print("✅ Backend is running")
    else:
        print("❌ Backend issue detected")
        exit(1)
except:
    print("❌ Backend is not running! Start it first:")
    print("   cd software/backend")
    print("   python3 dev_server.py")
    exit(1)

# Step 2: Get printer list to find PrusaLink printers
print("\n📋 Checking for PrusaLink printers...")
response = requests.get("http://localhost:8000/api/v1/equipment/printers")
if response.status_code == 200:
    printers = response.json()
    prusalink_printers = [p for p in printers if p.get('connection_type') == 'prusalink']
    
    if not prusalink_printers:
        print("❌ No PrusaLink printers found")
        exit(1)
    
    print(f"✅ Found {len(prusalink_printers)} PrusaLink printer(s)")
    
    for printer in prusalink_printers:
        print(f"\n🖨️  Testing printer: {printer.get('name', 'Unknown')}")
        print(f"   ID: {printer['id']}")
        print(f"   Status: {printer.get('state', 'Unknown')}")
        
        # Get detailed status
        status_response = requests.get(f"http://localhost:8000/api/v1/equipment/printers/{printer['id']}")
        if status_response.status_code == 200:
            status = status_response.json()
            print(f"   Connected: {status.get('connected', False)}")
            
            if not status.get('connected'):
                print("\n⚠️  Printer not connected. Let's test the connection manually...")
                
                # Ask for connection details
                print("\nPlease provide PrusaLink connection details:")
                print("(Press Enter to use the last saved values)")
                
                ip = input("Printer IP address (e.g. 192.168.1.134): ").strip()
                if not ip:
                    print("❌ IP address is required")
                    continue
                    
                username = input("Username (default: maker): ").strip() or "maker"
                password = input("Password: ").strip()
                if not password:
                    print("❌ Password is required")
                    continue
                
                # Test direct connection
                print(f"\n🔌 Testing direct connection to {ip}...")
                try:
                    test_url = f"http://{ip}/api/version"
                    auth = HTTPDigestAuth(username, password)
                    test_response = requests.get(test_url, auth=auth, timeout=5)
                    
                    if test_response.status_code == 200:
                        print("✅ Direct connection successful!")
                        version_data = test_response.json()
                        print(f"   PrusaLink version: {version_data.get('api', 'unknown')}")
                        
                        # Test printer endpoint
                        printer_response = requests.get(f"http://{ip}/api/printer", auth=auth, timeout=5)
                        if printer_response.status_code == 200:
                            printer_data = printer_response.json()
                            telemetry = printer_data.get('telemetry', {})
                            print(f"   Nozzle temp: {telemetry.get('temp-nozzle', 0)}°C")
                            print(f"   Bed temp: {telemetry.get('temp-bed', 0)}°C")
                            print(f"   State: {printer_data.get('state', {}).get('text', 'Unknown')}")
                            
                            print("\n✅ Connection test passed! The printer is accessible.")
                            print("\n💡 To fix the connection in W.I.T.:")
                            print("   1. Delete the current printer from the dashboard")
                            print("   2. Add it again with these exact details:")
                            print(f"      - IP: {ip}")
                            print(f"      - Username: {username}")
                            print(f"      - Password: {password}")
                            
                    elif test_response.status_code == 401:
                        print("❌ Authentication failed - check username/password")
                    else:
                        print(f"❌ Connection failed: HTTP {test_response.status_code}")
                        
                except requests.exceptions.Timeout:
                    print("❌ Connection timeout - printer not responding")
                    print("   Check that:")
                    print("   - Printer is powered on")
                    print("   - PrusaLink is enabled in printer settings")
                    print("   - IP address is correct")
                    print("   - Printer is on the same network")
                    
                except requests.exceptions.ConnectionError as e:
                    print(f"❌ Connection error: {e}")
                    print("   Check that:")
                    print("   - IP address is correct")
                    print("   - Printer is on the network")
                    print("   - No firewall blocking connection")
                    
                except Exception as e:
                    print(f"❌ Unexpected error: {e}")

else:
    print("❌ Failed to get printer list")

print("\n" + "="*60)
print("📌 Common issues and solutions:")
print("="*60)
print("1. Wrong IP address → Check printer display: Settings → Network → IP Address")
print("2. Wrong password → Check printer display: Settings → Network → PrusaLink")
print("3. PrusaLink not enabled → Enable in printer settings")
print("4. Network issues → Ensure printer and computer are on same network")
print("5. Firewall → Check if firewall is blocking connections")
print("\n💡 After fixing, delete and re-add the printer in W.I.T.")