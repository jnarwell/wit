#!/usr/bin/env python3
"""
W.I.T. - Network Printer Setup Script

This script helps you connect your Prusa XL via network (PrusaLink or OctoPrint).
Updated to use requests library for Digest authentication support.
"""

import asyncio
import sys
import os
import json
import requests
from requests.auth import HTTPDigestAuth
import aiohttp
from datetime import datetime

# Add project paths
sys.path.append(os.path.join(os.path.dirname(__file__), 'software'))


def print_header():
    """Print setup header"""
    print("\n" + "="*60)
    print("🌐  W.I.T. - Network Printer Setup")
    print("="*60 + "\n")


def print_options():
    """Print connection options"""
    print("Choose your connection method:\n")
    print("1️⃣  PrusaLink (Built into Prusa XL/MK4/MINI+)")
    print("2️⃣  OctoPrint (External server)")
    print("3️⃣  Auto-detect (Scan network)")
    print("4️⃣  Exit")
    print()


def setup_prusalink_sync():
    """Setup PrusaLink connection with Digest authentication (synchronous version)"""
    print("\n🔧 PrusaLink Setup")
    print("-" * 40)
    
    # Get printer IP
    print("\nEnter your printer's IP address")
    print("(Find it on printer: Settings → Network → IP Address)")
    print("Example: 192.168.1.134")
    ip_input = input("IP Address: ").strip()
    
    if not ip_input:
        print("❌ IP address required")
        return None
    
    # Clean up the input - remove http:// or https:// if provided
    ip = ip_input.replace("http://", "").replace("https://", "").rstrip("/")
    
    # Validate IP format (basic check)
    parts = ip.split('.')
    if "/" in ip or ":" in ip or len(parts) != 4:
        print("❌ Please enter just the IP address (e.g., 192.168.1.134)")
        print("   Don't include http:// or port numbers")
        return None
    
    # Test basic connection
    print(f"\n🔌 Testing connection to {ip}...")
    
    try:
        url = f"http://{ip}/api/version"
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Connected to PrusaLink!")
            print(f"   Printer: {data.get('text', 'Unknown')}")
            print(f"   Version: {data.get('api', 'Unknown')}")
            print(f"   Hostname: {data.get('hostname', 'Unknown')}")
        elif response.status_code == 401:
            print("✅ PrusaLink found (authentication required)")
        else:
            print(f"❌ Connection failed (HTTP {response.status_code})")
            return None
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return None
    
    # Get credentials
    print("\n🔑 Enter your PrusaLink credentials")
    print("(Find them on printer: Settings → Network → PrusaLink)")
    
    username = input("Username (default: maker): ").strip()
    if not username:
        username = "maker"  # Default PrusaLink username
    
    password = input("Password: ").strip()
    
    if not password:
        print("❌ Password required")
        return None
    
    # Test with credentials
    print("\n🧪 Testing authentication...")
    
    # Create Digest auth
    auth = HTTPDigestAuth(username, password)
    
    try:
        # Test authenticated endpoint
        url = f"http://{ip}/api/printer"
        response = requests.get(url, auth=auth, timeout=5)
        
        if response.status_code == 200:
            print("✅ Authentication successful!")
            
            # Get printer details
            data = response.json()
            state = data.get('state', {})
            telemetry = data.get('telemetry', {})
            
            print(f"\n📊 Printer Status:")
            print(f"   State: {state.get('text', 'Unknown')}")
            
            if telemetry:
                temp_nozzle = telemetry.get('temp-nozzle', 0)
                temp_bed = telemetry.get('temp-bed', 0)
                print(f"   Nozzle: {temp_nozzle}°C")
                print(f"   Bed: {temp_bed}°C")
            
            return {
                "type": "prusalink",
                "host": ip,
                "username": username,
                "password": password,
                "auth_type": "digest",
                "name": input("\nPrinter name (e.g., 'Prusa XL'): ").strip() or "Prusa XL"
            }
        elif response.status_code == 401:
            print("❌ Authentication failed. Check your username and password.")
            print("   Note: Default username is usually 'maker'")
            return None
        else:
            print(f"❌ Request failed (HTTP {response.status_code})")
            return None
            
    except Exception as e:
        print(f"❌ Authentication failed: {e}")
        return None


async def setup_octoprint():
    """Setup OctoPrint connection"""
    print("\n🐙 OctoPrint Setup")
    print("-" * 40)
    
    # Get OctoPrint URL
    print("\nEnter your OctoPrint URL")
    print("Examples:")
    print("  - http://octopi.local")
    print("  - http://192.168.1.100:5000")
    url = input("URL: ").strip()
    
    if not url:
        print("❌ URL required")
        return None
        
    if not url.startswith("http"):
        url = f"http://{url}"
        
    # Test connection
    print(f"\n🔌 Testing connection to {url}...")
    
    try:
        test_url = f"{url}/api/version"
        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(test_url) as response:
                if response.status_code == 200:
                    data = await response.json()
                    print("✅ Connected to OctoPrint!")
                    print(f"   Version: {data.get('server', 'Unknown')}")
                else:
                    print(f"❌ Connection failed (HTTP {response.status_code})")
                    return None
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return None
        
    # Get API key
    print("\n🔑 Enter your OctoPrint API key")
    print("(Get it from: OctoPrint → Settings → API)")
    api_key = input("API Key: ").strip()
    
    if not api_key:
        print("❌ API key required")
        return None
        
    # Test with API key
    print("\n🧪 Testing authentication...")
    
    headers = {"X-Api-Key": api_key}
    
    try:
        test_url = f"{url}/api/printer"
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(test_url, headers=headers) as response:
                if response.status_code == 200:
                    print("✅ Authentication successful!")
                    
                    data = await response.json()
                    state = data.get('state', {})
                    temps = data.get('temperature', {})
                    
                    print(f"\n📊 Printer Status:")
                    print(f"   State: {state.get('text', 'Unknown')}")
                    
                    if temps:
                        tool = temps.get('tool0', {})
                        bed = temps.get('bed', {})
                        if tool:
                            print(f"   Nozzle: {tool.get('actual', 0)}°C")
                        if bed:
                            print(f"   Bed: {bed.get('actual', 0)}°C")
                    
                    return {
                        "type": "octoprint",
                        "url": url,
                        "api_key": api_key,
                        "name": input("\nPrinter name (e.g., 'Prusa XL'): ").strip() or "Prusa XL"
                    }
                else:
                    print("❌ Authentication failed. Check your API key.")
                    return None
                    
    except Exception as e:
        print(f"❌ Authentication failed: {e}")
        return None


def save_config(printer_config):
    """Save printer configuration"""
    config_dir = "software/backend/config"
    os.makedirs(config_dir, exist_ok=True)
    
    config_file = os.path.join(config_dir, "network_printers.json")
    
    # Load existing config
    existing_config = {"printers": {}}
    if os.path.exists(config_file):
        try:
            with open(config_file, 'r') as f:
                existing_config = json.load(f)
        except:
            pass
            
    # Add new printer
    printer_id = f"{printer_config['type']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    existing_config["printers"][printer_id] = {
        **printer_config,
        "added": datetime.now().isoformat()
    }
    
    # Save (with sensitive data handling)
    with open(config_file, 'w') as f:
        json.dump(existing_config, f, indent=2)
        
    print(f"\n💾 Configuration saved!")
    print(f"   File: {config_file}")
    print(f"   ID: {printer_id}")
    
    # Also create a .env entry for the credentials
    env_file = ".env"
    if printer_config['type'] == 'prusalink':
        env_entries = f"""
# PrusaLink Configuration (Digest Authentication)
PRUSALINK_HOST={printer_config['host']}
PRUSALINK_USERNAME={printer_config['username']}
PRUSALINK_PASSWORD={printer_config['password']}
PRUSALINK_AUTH_TYPE=digest
"""
        print(f"\n📝 Add these to your .env file:")
        print(env_entries)
    
    return printer_id


async def scan_network():
    """Scan local network for printers"""
    print("🔍 Scanning network for printers...")
    print("   This may take a minute...\n")
    
    found_printers = []
    
    # Common ports to check
    prusalink_ports = [80, 8080]
    octoprint_ports = [5000, 80]
    
    # Get local network range (simplified - assumes 192.168.1.x)
    import socket
    hostname = socket.gethostname()
    local_ip = socket.gethostbyname(hostname)
    network_prefix = '.'.join(local_ip.split('.')[:-1])
    
    print(f"Scanning {network_prefix}.1-254...\n")
    
    async def check_host(ip, port, printer_type):
        """Check if host has printer service"""
        try:
            timeout = aiohttp.ClientTimeout(total=1)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                if printer_type == "prusalink":
                    url = f"http://{ip}:{port}/api/version"
                else:  # octoprint
                    url = f"http://{ip}:{port}/api/version"
                    
                async with session.get(url) as response:
                    if response.status in [200, 401]:  # 401 means auth required
                        data = {}
                        if response.status == 200:
                            data = await response.json()
                        
                        return {
                            "type": printer_type,
                            "ip": ip,
                            "port": port,
                            "info": data
                        }
        except:
            pass
        return None
    
    # Create tasks for all IPs and ports
    tasks = []
    for i in range(1, 255):
        ip = f"{network_prefix}.{i}"
        
        # Check PrusaLink ports
        for port in prusalink_ports:
            tasks.append(check_host(ip, port, "prusalink"))
            
        # Check OctoPrint ports  
        for port in octoprint_ports:
            tasks.append(check_host(ip, port, "octoprint"))
    
    # Run all checks concurrently
    results = await asyncio.gather(*tasks)
    
    # Filter out None results
    found_printers = [r for r in results if r is not None]
    
    if found_printers:
        print(f"✅ Found {len(found_printers)} printer(s):\n")
        for i, printer in enumerate(found_printers):
            print(f"[{i+1}] {printer['type'].upper()} at {printer['ip']}:{printer['port']}")
            if 'info' in printer and printer['info']:
                if 'text' in printer['info']:
                    print(f"    Type: {printer['info'].get('text', 'Unknown')}")
                if 'hostname' in printer['info']:
                    print(f"    Hostname: {printer['info'].get('hostname', 'Unknown')}")
            print()
    else:
        print("❌ No printers found on network")
        print("   Make sure:")
        print("   - Printer is powered on")
        print("   - Connected to same network")
        print("   - PrusaLink/OctoPrint is enabled")
        
    return found_printers


def setup_prusalink_with_ip_sync(ip):
    """Setup PrusaLink with pre-filled IP (synchronous version)"""
    print(f"🔧 Setting up PrusaLink at {ip}")
    print("-" * 40)
    
    # Get credentials
    print("\n🔑 Enter your PrusaLink credentials")
    print("(Find them on printer: Settings → Network → PrusaLink)")
    
    username = input("Username (default: maker): ").strip()
    if not username:
        username = "maker"
    
    password = input("Password: ").strip()
    
    if not password:
        print("❌ Password required")
        return None
    
    # Test with credentials
    print("\n🧪 Testing authentication...")
    
    auth = HTTPDigestAuth(username, password)
    
    try:
        url = f"http://{ip}/api/printer"
        response = requests.get(url, auth=auth, timeout=5)
        
        if response.status_code == 200:
            print("✅ Authentication successful!")
            return {
                "type": "prusalink",
                "host": ip,
                "username": username,
                "password": password,
                "auth_type": "digest",
                "name": input("\nPrinter name (e.g., 'Prusa XL'): ").strip() or "Prusa XL"
            }
        else:
            print("❌ Authentication failed")
            return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None


async def main():
    """Main setup process"""
    print_header()
    
    while True:
        print_options()
        choice = input("Select option (1-4): ").strip()
        
        if choice == "1":
            # PrusaLink setup - using synchronous version
            config = setup_prusalink_sync()
            if config:
                printer_id = save_config(config)
                print("\n✅ PrusaLink setup complete!")
                print("\n📋 Next steps:")
                print("   1. Install requests library: pip install requests")
                print("   2. Start the backend server")
                print("   3. The printer is now configured")
                print("   4. Use voice commands or the dashboard to control it")
                break
                
        elif choice == "2":
            # OctoPrint setup
            config = await setup_octoprint()
            if config:
                printer_id = save_config(config)
                print("\n✅ OctoPrint setup complete!")
                print("\n📋 Next steps:")
                print("   1. Start the backend server")
                print("   2. Add printer in dashboard with:")
                print(f"      - Connection: OctoPrint")
                print(f"      - URL: {config['url']}")
                print(f"      - API Key: {config['api_key'][:8]}...")
                break
                
        elif choice == "3":
            # Auto-detect
            found = await scan_network()
            if found:
                print("\nWhich printer to setup?")
                printer_choice = input("Enter number: ").strip()
                try:
                    idx = int(printer_choice) - 1
                    if 0 <= idx < len(found):
                        selected = found[idx]
                        if selected['type'] == 'prusalink':
                            print(f"\n✅ Selected PrusaLink at {selected['ip']}")
                            print("Continuing with PrusaLink setup...\n")
                            # Use synchronous version
                            config = setup_prusalink_with_ip_sync(selected['ip'])
                            if config:
                                printer_id = save_config(config)
                                print("\n✅ PrusaLink setup complete!")
                                break
                        else:
                            print(f"\n✅ Selected OctoPrint at {selected['ip']}:{selected['port']}")
                            # Continue with OctoPrint setup
                except:
                    print("Invalid selection")
                    
        elif choice == "4":
            print("\n👋 Setup cancelled.")
            break
            
        else:
            print("❌ Invalid choice. Please select 1-4.")
            
        print()  # Empty line for spacing


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n👋 Setup interrupted.")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()