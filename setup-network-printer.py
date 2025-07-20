#!/usr/bin/env python3
"""
W.I.T. - Network Printer Setup Script

This script helps you connect your Prusa XL via network (PrusaLink or OctoPrint).
"""

import asyncio
import sys
import os
import json
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
    
    async def check_host(ip, port, service_type):
        """Check if a host has a printer service"""
        url = f"http://{ip}:{port}"
        
        try:
            timeout = aiohttp.ClientTimeout(total=2)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                # Check for PrusaLink
                if service_type == "prusalink":
                    async with session.get(f"{url}/api/version") as response:
                        if response.status == 200:
                            data = await response.json()
                            if "api" in data:
                                return {
                                    "type": "prusalink",
                                    "ip": ip,
                                    "port": port,
                                    "info": data
                                }
                                
                # Check for OctoPrint
                elif service_type == "octoprint":
                    async with session.get(f"{url}/api/version") as response:
                        if response.status == 200:
                            data = await response.json()
                            if "server" in data:
                                return {
                                    "type": "octoprint",
                                    "ip": ip,
                                    "port": port,
                                    "info": data
                                }
                                
        except:
            pass
            
        return None
    
    # Scan common IPs
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
            if 'info' in printer and 'printer' in printer['info']:
                print(f"    Model: {printer['info'].get('printer', 'Unknown')}")
            print()
    else:
        print("❌ No printers found on network")
        print("   Make sure:")
        print("   - Printer is powered on")
        print("   - Connected to same network")
        print("   - PrusaLink/OctoPrint is enabled")
        
    return found_printers


async def setup_prusalink():
    """Setup PrusaLink connection"""
    print("\n🔧 PrusaLink Setup")
    print("-" * 40)
    
    # Get printer IP
    print("\nEnter your printer's IP address")
    print("(Find it on printer: Settings → Network → IP Address)")
    ip = input("IP Address: ").strip()
    
    if not ip:
        print("❌ IP address required")
        return None
        
    # Test basic connection
    print(f"\n🔌 Testing connection to {ip}...")
    
    try:
        url = f"http://{ip}/api/version"
        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    print("✅ Connected to PrusaLink!")
                    print(f"   Printer: {data.get('printer', 'Unknown')}")
                    print(f"   Version: {data.get('api', 'Unknown')}")
                else:
                    print(f"❌ Connection failed (HTTP {response.status})")
                    print("   Is PrusaLink enabled on the printer?")
                    return None
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return None
        
    # Get API key
    print("\n🔑 Enter your PrusaLink API key")
    print("(Get it from: http://{ip} → Settings → API Keys)")
    api_key = input("API Key: ").strip()
    
    if not api_key:
        print("❌ API key required")
        return None
        
    # Test with API key
    print("\n🧪 Testing authentication...")
    
    from software.integrations.prusalink import PrusaLinkClient, PrusaLinkConfig
    
    config = PrusaLinkConfig(
        host=ip,
        api_key=api_key,
        name="Prusa XL"
    )
    
    client = PrusaLinkClient(config)
    
    if await client.connect():
        print("✅ Authentication successful!")
        
        # Get printer details
        status = client.get_status()
        print(f"\n📊 Printer Status:")
        print(f"   State: {status['state']}")
        print(f"   Nozzle: {status['temperatures']['nozzle']['current']}°C")
        print(f"   Bed: {status['temperatures']['bed']['current']}°C")
        
        await client.disconnect()
        
        return {
            "type": "prusalink",
            "host": ip,
            "api_key": api_key,
            "name": input("\nPrinter name (e.g., 'Prusa XL'): ").strip() or "Prusa XL"
        }
    else:
        print("❌ Authentication failed. Check your API key.")
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
                if response.status == 200:
                    data = await response.json()
                    print("✅ Connected to OctoPrint!")
                    print(f"   Version: {data.get('server', 'Unknown')}")
                else:
                    print(f"❌ Connection failed (HTTP {response.status})")
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
    
    from software.integrations.octoprint_integration import OctoPrintClient, OctoPrintConfig
    
    config = OctoPrintConfig(
        url=url,
        api_key=api_key,
        name="Prusa XL"
    )
    
    client = OctoPrintClient(config)
    
    if await client.connect():
        print("✅ Authentication successful!")
        
        # Get printer details
        info = await client.get_printer_info()
        if info:
            print(f"\n📊 Printer Info:")
            print(f"   State: {info.state.value}")
            print(f"   Connected: {info.connected}")
            
        await client.disconnect()
        
        return {
            "type": "octoprint",
            "url": url,
            "api_key": api_key,
            "name": input("\nPrinter name (e.g., 'Prusa XL'): ").strip() or "Prusa XL"
        }
    else:
        print("❌ Authentication failed. Check your API key.")
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
    
    # Save
    with open(config_file, 'w') as f:
        json.dump(existing_config, f, indent=2)
        
    print(f"\n💾 Configuration saved!")
    print(f"   File: {config_file}")
    print(f"   ID: {printer_id}")
    
    return printer_id


async def main():
    """Main setup process"""
    print_header()
    
    while True:
        print_options()
        choice = input("Select option (1-4): ").strip()
        
        if choice == "1":
            # PrusaLink setup
            config = await setup_prusalink()
            if config:
                printer_id = save_config(config)
                print("\n✅ PrusaLink setup complete!")
                print("\n📋 Next steps:")
                print("   1. Start the backend server")
                print("   2. Add printer in dashboard with:")
                print(f"      - Connection: PrusaLink")
                print(f"      - IP: {config['host']}")
                print(f"      - API Key: {config['api_key'][:8]}...")
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
                            # Continue with PrusaLink setup
                            print(f"\nDetected PrusaLink at {selected['ip']}")
                            # You would continue the setup here
                        else:
                            # Continue with OctoPrint setup
                            print(f"\nDetected OctoPrint at {selected['ip']}:{selected['port']}")
                            # You would continue the setup here
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