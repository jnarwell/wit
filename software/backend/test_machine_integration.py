#!/usr/bin/env python3
"""
Test script to verify the Machine Manager integration in dev_server
"""
import asyncio
import aiohttp
import json
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def test_machine_manager_integration():
    """Test the Machine Manager integration"""
    base_url = "http://localhost:8000"
    
    # Get auth token
    print("1. Getting auth token...")
    async with aiohttp.ClientSession() as session:
        # Login
        login_data = {"username": "admin", "password": "admin"}
        async with session.post(f"{base_url}/api/v1/auth/token", data=login_data) as resp:
            if resp.status != 200:
                print(f"   ❌ Login failed: {resp.status}")
                return
            token_data = await resp.json()
            token = token_data["access_token"]
            print("   ✅ Logged in successfully")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test 1: List printers
        print("\n2. Listing printers...")
        async with session.get(f"{base_url}/api/v1/equipment/printers", headers=headers) as resp:
            if resp.status == 200:
                data = await resp.json()
                print(f"   ✅ Found {len(data.get('printers', []))} printers")
                for printer in data.get('printers', []):
                    print(f"      - {printer.get('id')}: {printer.get('state', {}).get('text', 'Unknown')}")
            else:
                print(f"   ❌ Failed to list printers: {resp.status}")
        
        # Test 2: Add a simulated printer via Machine Manager
        print("\n3. Adding a test printer...")
        printer_data = {
            "printer_id": "test_machine_001",
            "name": "Test Machine Manager Printer",
            "connection_type": "serial",
            "port": "/dev/ttyUSB0",
            "baudrate": 115200,
            "manufacturer": "Generic",
            "model": "RepRap"
        }
        
        async with session.post(f"{base_url}/api/v1/equipment/printers", 
                               json=printer_data, headers=headers) as resp:
            if resp.status == 200:
                result = await resp.json()
                print(f"   ✅ Printer added: {result.get('message')}")
            else:
                print(f"   ❌ Failed to add printer: {resp.status}")
                error = await resp.text()
                print(f"      Error: {error}")
        
        # Test 3: Get printer status
        print("\n4. Getting printer status...")
        async with session.get(f"{base_url}/api/v1/equipment/printers/test_machine_001", 
                              headers=headers) as resp:
            if resp.status == 200:
                status = await resp.json()
                print(f"   ✅ Status: {status.get('state', 'Unknown')}")
                print(f"      Connected: {status.get('connected', False)}")
                if 'capabilities' in status:
                    print(f"      Capabilities: {', '.join(status['capabilities'][:5])}...")
            else:
                print(f"   ❌ Failed to get status: {resp.status}")
        
        # Test 4: Send command
        print("\n5. Sending test command...")
        command_data = {
            "command": "HOME",
            "kwargs": {"axis": "XYZ"}
        }
        
        async with session.post(f"{base_url}/api/v1/equipment/printers/test_machine_001/commands",
                               json=command_data, headers=headers) as resp:
            if resp.status == 200:
                result = await resp.json()
                print(f"   ✅ Command sent: {result.get('status')}")
                if 'result' in result:
                    print(f"      Result: {result['result']}")
            else:
                print(f"   ❌ Failed to send command: {resp.status}")
        
        # Test 5: Delete printer
        print("\n6. Cleaning up - deleting test printer...")
        async with session.delete(f"{base_url}/api/v1/equipment/printers/test_machine_001",
                                 headers=headers) as resp:
            if resp.status == 200:
                print("   ✅ Test printer deleted")
            else:
                print(f"   ❌ Failed to delete printer: {resp.status}")

async def test_direct_machine_manager():
    """Test Machine Manager directly"""
    print("\n" + "="*50)
    print("DIRECT MACHINE MANAGER TEST")
    print("="*50)
    
    try:
        from core.machine_manager import get_machine_manager
        from core.machine_types import MachineType
        
        manager = get_machine_manager()
        await manager.initialize()
        
        print("\n1. Testing machine manager directly...")
        
        # Test discovery
        print("\n2. Running discovery once...")
        await manager.start_discovery(continuous=False)
        
        # Check discovered machines
        discovered = manager._discovery_service.get_discovered_machines()
        print(f"   Found {len(discovered)} machines via discovery")
        
        for machine in discovered[:3]:  # Show first 3
            print(f"   - {machine.name} ({machine.connection_protocol.value})")
        
        print("\n✅ Direct Machine Manager test complete")
        
    except ImportError as e:
        print(f"\n❌ Could not import Machine Manager: {e}")
    except Exception as e:
        print(f"\n❌ Error testing Machine Manager: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("\n" + "="*50)
    print("MACHINE MANAGER INTEGRATION TEST")
    print("="*50)
    print("\nMake sure dev_server.py is running on port 8000")
    print("This will test the Machine Manager integration\n")
    
    # Run integration test
    asyncio.run(test_machine_manager_integration())
    
    # Run direct test
    asyncio.run(test_direct_machine_manager())
    
    print("\n✅ All tests complete!")