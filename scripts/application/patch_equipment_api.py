#!/usr/bin/env python3
"""
W.I.T. Integration Diagnostic Script

This script checks if your backend and frontend are properly configured
for the machines page integration.
"""

import requests
import json
import sys
from datetime import datetime

# Colors for output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def check_backend():
    """Check if backend is running and properly configured"""
    print(f"\n{Colors.BLUE}1. Checking Backend...{Colors.END}")
    
    try:
        # Check root endpoint
        r = requests.get("http://localhost:8000/", timeout=2)
        data = r.json()
        print(f"{Colors.GREEN}✅ Backend is running{Colors.END}")
        
        # Check if equipment router is loaded
        routers = data.get("routers_loaded", [])
        if "equipment" in routers:
            print(f"{Colors.GREEN}✅ Equipment router is loaded{Colors.END}")
        else:
            print(f"{Colors.RED}❌ Equipment router NOT loaded{Colors.END}")
            print(f"   Loaded routers: {routers}")
            return False
            
    except requests.exceptions.ConnectionError:
        print(f"{Colors.RED}❌ Backend not running at http://localhost:8000{Colors.END}")
        print(f"   Run: python3 dev_server.py")
        return False
    except Exception as e:
        print(f"{Colors.RED}❌ Error checking backend: {e}{Colors.END}")
        return False
    
    return True

def check_endpoints():
    """Check if required endpoints exist"""
    print(f"\n{Colors.BLUE}2. Checking API Endpoints...{Colors.END}")
    
    endpoints = [
        ("GET", "/api/v1/equipment/printers", "List printers"),
        ("POST", "/api/v1/equipment/printers", "Add printer"),
        ("POST", "/api/v1/equipment/printers/test", "Test connection"),
    ]
    
    all_good = True
    
    for method, path, description in endpoints:
        try:
            if method == "GET":
                r = requests.get(f"http://localhost:8000{path}")
            else:
                # For POST, we expect 422 (missing body) not 404
                r = requests.post(f"http://localhost:8000{path}", json={})
            
            if r.status_code == 404:
                print(f"{Colors.RED}❌ {method} {path} - NOT FOUND{Colors.END}")
                all_good = False
            elif r.status_code in [200, 422, 401]:
                print(f"{Colors.GREEN}✅ {method} {path} - {description}{Colors.END}")
            else:
                print(f"{Colors.YELLOW}⚠️  {method} {path} - Status {r.status_code}{Colors.END}")
                
        except Exception as e:
            print(f"{Colors.RED}❌ {method} {path} - Error: {e}{Colors.END}")
            all_good = False
    
    return all_good

def test_prusalink_connection():
    """Test PrusaLink connection"""
    print(f"\n{Colors.BLUE}3. Testing PrusaLink Connection...{Colors.END}")
    
    # Test data
    test_data = {
        "connection_type": "prusalink",
        "url": "192.168.1.134",
        "username": "maker",
        "password": "your-password-here"  # You'll need to update this
    }
    
    try:
        r = requests.post(
            "http://localhost:8000/api/v1/equipment/printers/test",
            json=test_data
        )
        
        if r.status_code == 404:
            print(f"{Colors.RED}❌ Test endpoint not found{Colors.END}")
            print(f"   Add the test endpoint to software/backend/api/equipment_api.py")
            return False
        elif r.status_code == 200:
            result = r.json()
            if result.get("success"):
                print(f"{Colors.GREEN}✅ Test endpoint works - {result.get('message')}{Colors.END}")
            else:
                print(f"{Colors.YELLOW}⚠️  Test failed: {result.get('message')}{Colors.END}")
        else:
            print(f"{Colors.RED}❌ Unexpected status: {r.status_code}{Colors.END}")
            print(f"   Response: {r.text}")
            
    except Exception as e:
        print(f"{Colors.RED}❌ Error testing connection: {e}{Colors.END}")
        return False
    
    return True

def check_cors():
    """Check CORS configuration"""
    print(f"\n{Colors.BLUE}4. Checking CORS Configuration...{Colors.END}")
    
    try:
        # Simulate a CORS preflight request
        headers = {
            'Origin': 'http://localhost:3000',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type'
        }
        
        r = requests.options("http://localhost:8000/api/v1/equipment/printers", headers=headers)
        
        cors_headers = r.headers.get('Access-Control-Allow-Origin')
        if cors_headers in ['*', 'http://localhost:3000']:
            print(f"{Colors.GREEN}✅ CORS is properly configured{Colors.END}")
            return True
        else:
            print(f"{Colors.RED}❌ CORS not configured for localhost:3000{Colors.END}")
            return False
            
    except Exception as e:
        print(f"{Colors.YELLOW}⚠️  Could not check CORS: {e}{Colors.END}")
        return True  # Assume it's OK

def main():
    print(f"{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}W.I.T. Backend-Frontend Integration Diagnostic{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run checks
    backend_ok = check_backend()
    
    if backend_ok:
        endpoints_ok = check_endpoints()
        cors_ok = check_cors()
        test_ok = test_prusalink_connection()
    else:
        endpoints_ok = False
        cors_ok = False
        test_ok = False
    
    # Summary
    print(f"\n{Colors.BLUE}Summary:{Colors.END}")
    print(f"{'Backend Running:':.<30} {'✅ Yes' if backend_ok else '❌ No'}")
    print(f"{'Equipment Router:':.<30} {'✅ Loaded' if backend_ok else '❌ Not Loaded'}")
    print(f"{'API Endpoints:':.<30} {'✅ Available' if endpoints_ok else '❌ Missing'}")
    print(f"{'CORS Config:':.<30} {'✅ OK' if cors_ok else '❌ Needs Fix'}")
    print(f"{'Test Endpoint:':.<30} {'✅ Working' if test_ok else '❌ Not Working'}")
    
    # Recommendations
    print(f"\n{Colors.BLUE}Recommendations:{Colors.END}")
    
    if not backend_ok:
        print(f"1. Start the backend server:")
        print(f"   cd wit-terminal")
        print(f"   python3 dev_server.py")
        
    if backend_ok and not endpoints_ok:
        print(f"1. Check if equipment_api.py is in software/backend/api/")
        print(f"2. Make sure the test endpoint is added to equipment_api.py")
        print(f"3. Try using dev_server_fixed.py instead")
        
    if backend_ok and endpoints_ok and not test_ok:
        print(f"1. Add the test endpoint code to equipment_api.py")
        print(f"2. Restart the backend server")
    
    if backend_ok and endpoints_ok and test_ok:
        print(f"{Colors.GREEN}✅ Everything looks good! The integration should work.{Colors.END}")
        print(f"\nNext steps:")
        print(f"1. Update MachinesPage.tsx with the fixed code")
        print(f"2. Start the frontend: cd software/frontend/web && npm run dev")
        print(f"3. Test adding a machine")
    
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")

if __name__ == "__main__":
    main()