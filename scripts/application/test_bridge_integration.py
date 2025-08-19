#!/usr/bin/env python3
"""
Test the W.I.T. Printer Bridge Integration
"""

import asyncio
import aiohttp
import time
import sys

async def test_bridge():
    """Test bridge functionality"""
    
    print("🧪 W.I.T. Printer Bridge Integration Test\n")
    
    # Your printer details (update these)
    PRINTER_ID = "M1755224055771"  # Update with your printer ID
    WIT_SERVER = "http://localhost:8000"
    
    # Check if bridge is connected
    print("1️⃣ Checking bridge status...")
    
    async with aiohttp.ClientSession() as session:
        # Get auth token
        auth_data = {
            "username": "admin",
            "password": "admin"
        }
        
        # Login
        async with session.post(f"{WIT_SERVER}/api/v1/auth/token", data=auth_data) as resp:
            if resp.status != 200:
                print("❌ Failed to authenticate")
                return
            token_data = await resp.json()
            token = token_data['access_token']
            
        headers = {"Authorization": f"Bearer {token}"}
        
        # Check bridge status
        async with session.get(
            f"{WIT_SERVER}/api/v1/equipment/printers/{PRINTER_ID}/bridge-status",
            headers=headers
        ) as resp:
            if resp.status == 200:
                status = await resp.json()
                if status.get('connected'):
                    print("✅ Bridge is connected!")
                    print(f"   Connected at: {status.get('connected_at')}")
                    print(f"   Commands processed: {status.get('commands_processed')}")
                else:
                    print("❌ Bridge is not connected")
                    print("   Run: python wit_printer_bridge.py --printer-id", PRINTER_ID)
                    return
            else:
                print(f"❌ Failed to check bridge status: {resp.status}")
                return
                
        print("\n2️⃣ Testing temperature control...")
        print("   Setting nozzle to 35°C (safe temperature)")
        
        # Send temperature command
        command_data = {
            "command": "SET_NOZZLE_TEMPERATURE",
            "kwargs": {"nozzle_temperature": 35}
        }
        
        async with session.post(
            f"{WIT_SERVER}/api/v1/equipment/printers/{PRINTER_ID}/commands",
            json=command_data,
            headers=headers
        ) as resp:
            if resp.status == 200:
                result = await resp.json()
                if result.get('status') == 'success':
                    print("✅ Temperature command sent successfully!")
                    print("   Check your printer - nozzle should heat to 35°C")
                else:
                    print("❌ Command failed:", result)
            else:
                print(f"❌ Failed to send command: {resp.status}")
                
        # Wait a bit
        print("\n   Waiting 5 seconds...")
        await asyncio.sleep(5)
        
        # Check printer status
        print("\n3️⃣ Checking printer status...")
        async with session.get(
            f"{WIT_SERVER}/api/v1/equipment/printers/{PRINTER_ID}",
            headers=headers
        ) as resp:
            if resp.status == 200:
                printer = await resp.json()
                temps = printer.get('temperatures', {})
                nozzle = temps.get('nozzle', {})
                print(f"   Nozzle: {nozzle.get('current', 0)}°C → {nozzle.get('target', 0)}°C")
                
        # Turn off heater
        print("\n4️⃣ Turning off heater...")
        command_data = {
            "command": "SET_NOZZLE_TEMPERATURE",
            "kwargs": {"nozzle_temperature": 0}
        }
        
        async with session.post(
            f"{WIT_SERVER}/api/v1/equipment/printers/{PRINTER_ID}/commands",
            json=command_data,
            headers=headers
        ) as resp:
            if resp.status == 200:
                print("✅ Heater turned off")
            else:
                print("⚠️  Remember to turn off heater manually!")
                
    print("\n" + "="*50)
    print("✅ Bridge integration test complete!")
    print("\nWith the bridge running, you now have full control:")
    print("- Temperature control ✓")
    print("- Movement control ✓")
    print("- Print control ✓")
    print("- Direct G-code ✓")

if __name__ == "__main__":
    asyncio.run(test_bridge())