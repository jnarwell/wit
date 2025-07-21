#!/usr/bin/env python3
"""
Quick fix to clean up printer issues
"""
import requests
import json

BASE_URL = "http://localhost:8000"

# Step 1: Login
print("Logging in...")
login_response = requests.post(
    f"{BASE_URL}/api/v1/auth/login",
    json={"username": "admin", "password": "admin"}
)

if login_response.status_code != 200:
    print("Failed to login!")
    exit(1)

token = login_response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Step 2: Delete all problematic printers
print("\nCleaning up printers...")

# Get all printers
printers = requests.get(f"{BASE_URL}/api/v1/equipment/printers").json()

# Delete any with errors or the problematic IDs
for printer in printers:
    printer_id = printer.get('id')
    if printer_id in ['M1753061340161', 'N1753061340161'] or 'Error' in str(printer.get('state', {})):
        print(f"Deleting printer: {printer_id}")
        response = requests.delete(
            f"{BASE_URL}/api/v1/equipment/printers/{printer_id}",
            headers=headers
        )
        if response.status_code == 200:
            print(f"✅ Deleted {printer_id}")
        else:
            print(f"❌ Failed to delete {printer_id}")

# Step 3: Add a fresh simulated printer for testing
print("\nAdding fresh test printer...")
test_printer = {
    "printer_id": "3d-printer-sim",
    "name": "3D Printer (Simulated)",
    "connection_type": "simulated",
    "manufacturer": "Prusa",
    "model": "MK4",
    "auto_connect": True
}

response = requests.post(
    f"{BASE_URL}/api/v1/equipment/printers",
    json=test_printer,
    headers=headers
)

if response.status_code == 200:
    print("✅ Added simulated printer for testing")
else:
    print(f"❌ Failed to add: {response.text}")

# Step 4: Show current printers
print("\nCurrent printers:")
printers = requests.get(f"{BASE_URL}/api/v1/equipment/printers").json()
for printer in printers:
    print(f"- {printer.get('id')}: {printer.get('name')} ({printer.get('connection_type')})")

print("\n✅ Cleanup complete!")
print("\nNext steps:")
print("1. Refresh your browser (Ctrl+R or Cmd+R)")
print("2. You should see the simulated printer working")
print("3. To add a real PrusaLink printer:")
print("   - Click 'Add Machine'")
print("   - Choose 'Network (PrusaLink)'") 
print("   - Enter your printer's IP and password")
print("   - Test connection before adding")