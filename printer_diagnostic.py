#!/usr/bin/env python3
"""
Diagnostic script to check printer storage and connections
Run this to debug printer connection issues
"""

import asyncio
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the dev server module
import software.backend.dev_server as dev_server

async def diagnose_printers():
    """Diagnose printer storage and connections"""
    print("\n=== W.I.T. PRINTER DIAGNOSTIC ===\n")
    
    # Check simulated printers
    print(f"Simulated Printers: {len(dev_server.simulated_printers)}")
    for printer_id, printer in dev_server.simulated_printers.items():
        print(f"  - {printer_id}: {printer.get('name', 'Unknown')} ({printer.get('connection_type', 'unknown')})")
        print(f"    Data: {printer}")
    
    # Check PrusaLink printers
    print(f"\nPrusaLink Printers: {len(dev_server.prusalink_printers)}")
    for printer_id, printer in dev_server.prusalink_printers.items():
        print(f"  - {printer_id}: {printer.get('name', 'Unknown')}")
        if printer is None:
            print("    ERROR: Printer data is None!")
        else:
            print(f"    URL: {printer.get('url', 'Not set')}")
            print(f"    Has Password: {'Yes' if printer.get('password') else 'No'}")
    
    # Test get_real_printer_status for each printer
    print("\n=== Testing get_real_printer_status ===")
    all_printer_ids = set()
    all_printer_ids.update(dev_server.simulated_printers.keys())
    all_printer_ids.update(dev_server.prusalink_printers.keys())
    
    for printer_id in all_printer_ids:
        print(f"\nTesting printer: {printer_id}")
        try:
            status = await dev_server.get_real_printer_status(printer_id)
            if status is None:
                print("  ERROR: Status is None!")
            else:
                print(f"  Connected: {status.get('connected', False)}")
                print(f"  State: {status.get('state', {}).get('text', 'Unknown')}")
                print(f"  Telemetry: {status.get('telemetry', {})}")
                if status.get('error'):
                    print(f"  Error: {status['error']}")
        except Exception as e:
            print(f"  EXCEPTION: {e}")
    
    # Test specific printer if provided
    if len(sys.argv) > 1:
        test_id = sys.argv[1]
        print(f"\n=== Detailed test for printer: {test_id} ===")
        
        # Check if printer exists
        if test_id in dev_server.prusalink_printers:
            printer_info = dev_server.prusalink_printers[test_id]
            print(f"Found in PrusaLink printers: {printer_info}")
            
            # Test fetching data
            print("\nTesting fetch_prusalink_data...")
            try:
                data = await dev_server.fetch_prusalink_data(printer_info)
                print(f"Result: {data}")
            except Exception as e:
                print(f"ERROR: {e}")
        elif test_id in dev_server.simulated_printers:
            print(f"Found in simulated printers: {dev_server.simulated_printers[test_id]}")
        else:
            print("Printer not found in any storage!")

if __name__ == "__main__":
    print("Usage: python3 printer_diagnostic.py [printer_id]")
    asyncio.run(diagnose_printers())