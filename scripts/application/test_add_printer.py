#!/usr/bin/env python3
"""
Test adding a printer via the API
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_add_printer():
    print("\n=== Testing Printer Addition ===\n")
    
    # Step 1: Login to get token
    print("1️⃣ Logging in...")
    login_data = {"username": "admin", "password": "admin"}
    response = requests.post(f"{BASE_URL}/api/v1/auth/login", json=login_data)
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        return
    
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Login successful")
    
    # Step 2: Test adding a simulated printer
    print("\n2️⃣ Adding a simulated printer...")
    printer_data = {
        "printer_id": "test-printer-001",
        "name": "Test Simulated Printer",
        "connection_type": "simulated",
        "manufacturer": "Test Corp",
        "model": "TestBot 3000",
        "auto_connect": True
    }
    
    response = requests.post(
        f"{BASE_URL}/api/v1/equipment/printers",
        json=printer_data,
        headers=headers
    )
    
    print(f"Response status: {response.status_code}")
    print(f"Response: {response.json()}")
    
    # Step 3: Verify it was added
    print("\n3️⃣ Verifying printer was added...")
    response = requests.get(f"{BASE_URL}/api/v1/equipment/printers")
    printers = response.json()
    
    found = False
    for printer in printers:
        if printer.get("id") == "test-printer-001":
            found = True
            print(f"✅ Printer found: {printer}")
    
    if not found:
        print("❌ Printer not found in list")
    
    # Step 4: Test adding a PrusaLink printer
    print("\n4️⃣ Adding a PrusaLink printer...")
    prusalink_data = {
        "printer_id": "prusa-test-001",
        "name": "Test Prusa Printer",
        "connection_type": "prusalink",
        "url": "192.168.1.100",  # Example IP
        "username": "maker",
        "password": "test123",  # You'd use real password
        "manufacturer": "Prusa",
        "model": "MK4",
        "auto_connect": True
    }
    
    response = requests.post(
        f"{BASE_URL}/api/v1/equipment/printers",
        json=prusalink_data,
        headers=headers
    )
    
    print(f"Response status: {response.status_code}")
    print(f"Response: {response.json()}")

if __name__ == "__main__":
    test_add_printer()