#!/usr/bin/env python3
"""
W.I.T. - Prusa XL Setup Script

This script helps you connect your Prusa XL 3D printer to the W.I.T. system.
Run this from the project root directory.
"""

import asyncio
import sys
import os
import json
import serial.tools.list_ports
from datetime import datetime

# Add project paths
sys.path.append(os.path.join(os.path.dirname(__file__), 'software'))

# Import Prusa integration
from software.integrations.prusa_serial import PrusaSerial, PrusaConfig, PrinterState


def print_header():
    """Print setup header"""
    print("\n" + "="*60)
    print("🖨️  W.I.T. - Prusa XL Connection Setup")
    print("="*60 + "\n")


def find_printer_ports():
    """Find available serial ports that might have a printer"""
    print("🔍 Scanning for printers...")
    
    ports = []
    for port in serial.tools.list_ports.comports():
        port_info = {
            "port": port.device,
            "description": port.description,
            "manufacturer": port.manufacturer,
            "serial": port.serial_number,
            "likely_printer": False
        }
        
        # Check if it's likely a printer
        desc_lower = str(port.description).lower()
        mfg_lower = str(port.manufacturer).lower() if port.manufacturer else ""
        
        if any(x in desc_lower for x in ["prusa", "3d", "printer", "arduino", "ch340", "ft232"]):
            port_info["likely_printer"] = True
        elif any(x in mfg_lower for x in ["prusa", "ultimachine"]):
            port_info["likely_printer"] = True
            
        ports.append(port_info)
        
    return sorted(ports, key=lambda x: not x["likely_printer"])


def select_port(ports):
    """Let user select a port"""
    if not ports:
        print("❌ No serial ports found!")
        print("   Please check:")
        print("   - Printer is connected via USB")
        print("   - Printer is powered on")
        print("   - USB drivers are installed")
        return None
        
    print("\n📡 Found serial ports:")
    for i, port in enumerate(ports):
        star = "⭐" if port["likely_printer"] else "  "
        print(f"{star} [{i+1}] {port['port']} - {port['description']}")
        
    print("\n💡 Ports marked with ⭐ are likely printers")
    
    while True:
        try:
            choice = input("\nSelect port number (or 'q' to quit): ").strip()
            if choice.lower() == 'q':
                return None
                
            idx = int(choice) - 1
            if 0 <= idx < len(ports):
                return ports[idx]["port"]
            else:
                print("Invalid selection, please try again.")
        except ValueError:
            print("Please enter a number.")


async def test_connection(port, baudrate=115200):
    """Test connection to printer"""
    print(f"\n🔌 Testing connection to {port} at {baudrate} baud...")
    
    config = PrusaConfig(
        port=port,
        baudrate=baudrate,
        model="Prusa XL"
    )
    
    printer = PrusaSerial(config)
    
    try:
        if await printer.connect():
            print("✅ Successfully connected to printer!")
            
            # Get initial status
            await asyncio.sleep(2)  # Let it stabilize
            status = printer.get_status()
            
            print("\n📊 Printer Information:")
            print(f"   Firmware: {status['info']['firmware'] or 'Unknown'}")
            print(f"   State: {status['state']}")
            print(f"   Hotend: {status['temperatures']['hotend']['current']}°C")
            print(f"   Bed: {status['temperatures']['bed']['current']}°C")
            
            return printer
        else:
            print("❌ Failed to connect. The device might not be a Prusa printer.")
            return None
            
    except Exception as e:
        print(f"❌ Connection error: {e}")
        return None


async def interactive_test(printer):
    """Interactive printer testing"""
    print("\n🎮 Interactive Test Mode")
    print("   Commands:")
    print("   - status : Get current status")
    print("   - home   : Home all axes")
    print("   - temp   : Set temperatures")
    print("   - move   : Move to position")
    print("   - quit   : Exit test mode")
    
    while True:
        try:
            cmd = input("\nCommand: ").strip().lower()
            
            if cmd == "quit":
                break
                
            elif cmd == "status":
                await printer.update_status()
                status = printer.get_status()
                print(json.dumps(status, indent=2))
                
            elif cmd == "home":
                confirm = input("Home all axes? (y/n): ").strip().lower()
                if confirm == 'y':
                    print("Homing...")
                    await printer.home_axes()
                    print("✅ Homing complete")
                    
            elif cmd == "temp":
                hotend = input("Hotend temperature (0-280°C, or Enter to skip): ").strip()
                bed = input("Bed temperature (0-120°C, or Enter to skip): ").strip()
                
                if hotend:
                    await printer.set_temperature(hotend=float(hotend))
                if bed:
                    await printer.set_temperature(bed=float(bed))
                    
                print("✅ Temperature commands sent")
                
            elif cmd == "move":
                print("Enter target position (or Enter to skip):")
                x = input("X (mm): ").strip()
                y = input("Y (mm): ").strip()
                z = input("Z (mm): ").strip()
                
                kwargs = {}
                if x: kwargs['x'] = float(x)
                if y: kwargs['y'] = float(y)
                if z: kwargs['z'] = float(z)
                
                if kwargs:
                    await printer.move_to(**kwargs, feedrate=3000)
                    print("✅ Movement command sent")
                    
            else:
                print("Unknown command")
                
        except Exception as e:
            print(f"Error: {e}")


def save_config(port, baudrate):
    """Save printer configuration"""
    config = {
        "printers": {
            "prusa_xl": {
                "name": "Prusa XL",
                "type": "serial",
                "port": port,
                "baudrate": baudrate,
                "model": "Prusa XL",
                "added": datetime.now().isoformat()
            }
        }
    }
    
    config_dir = "software/backend/config"
    os.makedirs(config_dir, exist_ok=True)
    
    config_file = os.path.join(config_dir, "printers.json")
    
    # Load existing config if it exists
    if os.path.exists(config_file):
        try:
            with open(config_file, 'r') as f:
                existing = json.load(f)
                existing["printers"].update(config["printers"])
                config = existing
        except:
            pass
            
    # Save config
    with open(config_file, 'w') as f:
        json.dump(config, f, indent=2)
        
    print(f"\n💾 Configuration saved to {config_file}")


async def main():
    """Main setup process"""
    print_header()
    
    # Find ports
    ports = find_printer_ports()
    
    # Select port
    selected_port = select_port(ports)
    if not selected_port:
        print("\n👋 Setup cancelled.")
        return
        
    # Test connection
    printer = await test_connection(selected_port)
    if not printer:
        # Try different baud rates
        for baud in [250000, 57600]:
            print(f"\n🔄 Trying {baud} baud...")
            printer = await test_connection(selected_port, baud)
            if printer:
                baudrate = baud
                break
        else:
            print("\n❌ Could not connect to printer.")
            return
    else:
        baudrate = 115200
        
    # Save configuration
    save_config(selected_port, baudrate)
    
    # Interactive test
    test = input("\n🧪 Would you like to test the printer interactively? (y/n): ").strip().lower()
    if test == 'y':
        await interactive_test(printer)
        
    # Disconnect
    await printer.disconnect()
    
    print("\n✅ Setup complete!")
    print("\n📋 Next steps:")
    print("   1. Start the backend server:")
    print("      cd software/backend && python3 -m uvicorn main:app --reload")
    print("   2. The printer will appear in your W.I.T. dashboard")
    print("   3. You can control it via the web interface or voice commands")
    print("\n🎉 Happy printing!")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n👋 Setup interrupted.")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()