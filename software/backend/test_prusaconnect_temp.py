#!/usr/bin/env python3
"""Test script for PrusaConnect temperature control"""

import asyncio
import aiohttp
import json
import sys

async def test_prusaconnect_temp_control(printer_id: str, api_token: str, temp_nozzle: float = 50.0, temp_bed: float = 40.0):
    """Test temperature control via PrusaConnect API"""
    
    print(f"Testing PrusaConnect temperature control for printer {printer_id}")
    print(f"Setting nozzle to {temp_nozzle}°C and bed to {temp_bed}°C")
    
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json"
    }
    
    async with aiohttp.ClientSession() as session:
        # Test nozzle temperature
        print("\n1. Testing nozzle temperature control...")
        try:
            async with session.post(
                f"https://connect.prusa3d.com/api/v1/printers/{printer_id}/command",
                json={
                    "command": "set_target_hotend",
                    "target": temp_nozzle,
                    "tool": 0
                },
                headers=headers
            ) as resp:
                print(f"   Response status: {resp.status}")
                if resp.status == 200:
                    print("   ✓ Nozzle temperature command sent successfully")
                else:
                    text = await resp.text()
                    print(f"   ✗ Failed: {text}")
        except Exception as e:
            print(f"   ✗ Error: {e}")
        
        # Test bed temperature
        print("\n2. Testing bed temperature control...")
        try:
            async with session.post(
                f"https://connect.prusa3d.com/api/v1/printers/{printer_id}/command",
                json={
                    "command": "set_target_bed",
                    "target": temp_bed
                },
                headers=headers
            ) as resp:
                print(f"   Response status: {resp.status}")
                if resp.status == 200:
                    print("   ✓ Bed temperature command sent successfully")
                else:
                    text = await resp.text()
                    print(f"   ✗ Failed: {text}")
        except Exception as e:
            print(f"   ✗ Error: {e}")
        
        # Get printer status to verify
        print("\n3. Fetching printer status...")
        try:
            async with session.get(
                f"https://connect.prusa3d.com/api/v1/printers/{printer_id}",
                headers=headers
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print("   Current temperatures:")
                    print(f"   - Nozzle: {data.get('telemetry', {}).get('temp-nozzle', 'N/A')}°C")
                    print(f"   - Bed: {data.get('telemetry', {}).get('temp-bed', 'N/A')}°C")
                    print(f"   - Target Nozzle: {data.get('telemetry', {}).get('target-nozzle', 'N/A')}°C")
                    print(f"   - Target Bed: {data.get('telemetry', {}).get('target-bed', 'N/A')}°C")
                else:
                    print(f"   Failed to get status: {resp.status}")
        except Exception as e:
            print(f"   Error getting status: {e}")

def main():
    if len(sys.argv) < 3:
        print("Usage: python test_prusaconnect_temp.py <printer_id> <api_token> [nozzle_temp] [bed_temp]")
        print("\nExample:")
        print("  python test_prusaconnect_temp.py ABCD1234 your-api-token-here 50 40")
        sys.exit(1)
    
    printer_id = sys.argv[1]
    api_token = sys.argv[2]
    nozzle_temp = float(sys.argv[3]) if len(sys.argv) > 3 else 50.0
    bed_temp = float(sys.argv[4]) if len(sys.argv) > 4 else 40.0
    
    asyncio.run(test_prusaconnect_temp_control(printer_id, api_token, nozzle_temp, bed_temp))

if __name__ == "__main__":
    main()