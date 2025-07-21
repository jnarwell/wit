#!/usr/bin/env python3
"""Fix 'NoneType' object has no attribute 'get' error"""

import os

dev_server_path = "dev_server.py"

if not os.path.exists(dev_server_path):
    print(f"❌ {dev_server_path} not found!")
    exit(1)

print("🔧 Fixing 'get' attribute error...")

with open(dev_server_path, 'r') as f:
    content = f.read()

# Fix 1: Update fetch_prusalink_data to handle all None cases
old_fetch = """async def fetch_prusalink_data(printer_info: Dict[str, Any]) -> Dict[str, Any]:
    \"\"\"Fetch real data from PrusaLink printer with enhanced status\"\"\"
    try:
        url = printer_info["url"].replace("http://", "").replace("https://", "").strip("/")
        auth = HTTPDigestAuth(printer_info.get("username", "maker"), printer_info["password"])"""

new_fetch = """async def fetch_prusalink_data(printer_info: Dict[str, Any]) -> Dict[str, Any]:
    \"\"\"Fetch real data from PrusaLink printer with enhanced status\"\"\"
    try:
        # Comprehensive safety check
        if printer_info is None:
            logger.error("printer_info is None in fetch_prusalink_data")
            return {
                "connected": False,
                "state": {"text": "Invalid Configuration", "color": "red"},
                "telemetry": {}
            }
        
        # Log what we received
        logger.info(f"Fetching data for printer with info: {printer_info}")
        
        # Check required fields
        if not isinstance(printer_info, dict):
            logger.error(f"printer_info is not a dict: {type(printer_info)}")
            return {
                "connected": False,
                "state": {"text": "Invalid Configuration Type", "color": "red"},
                "telemetry": {}
            }
            
        url = printer_info.get("url", "")
        if not url:
            logger.error("No URL in printer_info")
            return {
                "connected": False,
                "state": {"text": "No URL Configured", "color": "red"},
                "telemetry": {}
            }
            
        password = printer_info.get("password", "")
        if not password:
            logger.error("No password in printer_info")
            return {
                "connected": False,
                "state": {"text": "No Password Configured", "color": "red"},
                "telemetry": {}
            }
        
        url = url.replace("http://", "").replace("https://", "").strip("/")
        auth = HTTPDigestAuth(printer_info.get("username", "maker"), password)"""

content = content.replace(old_fetch, new_fetch)

# Fix 2: Add safety to the response parsing
old_telemetry = """            data = printer_response.json()
            telemetry = data.get("telemetry", {})
            state = data.get("state", {})"""

new_telemetry = """            data = printer_response.json()
            if data is None:
                logger.error("Printer API returned None")
                return {
                    "connected": False,
                    "state": {"text": "Invalid API Response", "color": "red"},
                    "telemetry": {}
                }
            
            telemetry = data.get("telemetry", {}) if isinstance(data, dict) else {}
            state = data.get("state", {}) if isinstance(data, dict) else {}"""

content = content.replace(old_telemetry, new_telemetry)

# Fix 3: Add logging to printer status endpoint
old_endpoint = """        # Build the proper response for the frontend
        response = {
            "id": printer_id,
            "name": printer_info.get("name", "Unknown"),"""

new_endpoint = """        # Log printer_info for debugging
        logger.info(f"Building response for printer {printer_id}, printer_info type: {type(printer_info)}")
        if printer_info is None:
            logger.error(f"printer_info is None for {printer_id}")
            printer_info = {}
        
        # Build the proper response for the frontend
        response = {
            "id": printer_id,
            "name": printer_info.get("name", "Unknown") if isinstance(printer_info, dict) else "Unknown","""

content = content.replace(old_endpoint, new_endpoint)

# Write the fixed content
with open(dev_server_path, 'w') as f:
    f.write(content)

print("✅ Fixed 'get' attribute error")

# Create a test script to verify the fix
print("\n📝 Creating test script...")

test_script = '''#!/usr/bin/env python3
"""Test printer connection directly"""

import requests
from requests.auth import HTTPDigestAuth

print("🧪 Direct PrusaLink Test\\n")

# Your printer details
ip = "192.168.1.134"
username = "maker"
password = "GkSsqbykCym6Xd8"

print(f"Testing connection to {ip}...")

try:
    # Test direct connection
    auth = HTTPDigestAuth(username, password)
    response = requests.get(f"http://{ip}/api/printer", auth=auth, timeout=5)
    
    if response.status_code == 200:
        print("✅ Direct connection successful!")
        data = response.json()
        
        print("\\nRaw response type:", type(data))
        print("Has telemetry?", "telemetry" in data if isinstance(data, dict) else False)
        print("Has state?", "state" in data if isinstance(data, dict) else False)
        
        if isinstance(data, dict):
            telemetry = data.get("telemetry", {})
            state = data.get("state", {})
            
            print(f"\\nState: {state.get('text', 'Unknown') if isinstance(state, dict) else 'Invalid'}")
            print(f"Nozzle temp: {telemetry.get('temp-nozzle', 'N/A') if isinstance(telemetry, dict) else 'Invalid'}")
            print(f"Bed temp: {telemetry.get('temp-bed', 'N/A') if isinstance(telemetry, dict) else 'Invalid'}")
        else:
            print("\\n❌ Unexpected response format:", data)
    else:
        print(f"❌ Connection failed: {response.status_code}")
        
except Exception as e:
    print(f"❌ Error: {e}")

print("\\n💡 Check if the response format matches what the backend expects")
'''

with open("test_direct_connection.py", "w") as f:
    f.write(test_script)

os.chmod("test_direct_connection.py", 0o755)

print("✅ Created test_direct_connection.py")
print("\n🔄 Next steps:")
print("1. Restart the backend server")
print("2. Run the direct test: python3 test_direct_connection.py")
print("3. Check the backend console for detailed logs")
print("\nThe error should now show more specific information!")