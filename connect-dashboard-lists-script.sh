#!/bin/bash

# W.I.T. - Test Prusa XL Connection
# Run this script to verify your printer connection is working

echo "🖨️  W.I.T. - Testing Prusa XL Connection"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -d "software/backend" ]; then
    echo -e "${RED}❌ Error: Please run this script from the project root directory${NC}"
    exit 1
fi

# Step 1: Check Python
echo "1️⃣  Checking Python installation..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}✅ Python installed: $PYTHON_VERSION${NC}"
else
    echo -e "${RED}❌ Python 3 not found. Please install Python 3.8+${NC}"
    exit 1
fi

# Step 2: Check pyserial
echo ""
echo "2️⃣  Checking pyserial installation..."
if python3 -c "import serial" 2>/dev/null; then
    echo -e "${GREEN}✅ pyserial is installed${NC}"
else
    echo -e "${YELLOW}⚠️  pyserial not found. Installing...${NC}"
    pip install pyserial
fi

# Step 3: Check for serial ports
echo ""
echo "3️⃣  Scanning for serial ports..."
python3 << 'EOF'
import serial.tools.list_ports
import sys

ports = list(serial.tools.list_ports.comports())

if not ports:
    print("\033[0;31m❌ No serial ports found!\033[0m")
    print("   Please check:")
    print("   - Printer is connected via USB")
    print("   - Printer is powered on")
    sys.exit(1)

print("\033[0;32m✅ Found serial ports:\033[0m")
for i, port in enumerate(ports):
    likely = "⭐" if any(x in port.description.lower() for x in ["prusa", "3d", "printer"]) else "  "
    print(f"{likely} [{i+1}] {port.device} - {port.description}")
EOF

# Step 4: Quick connection test
echo ""
echo "4️⃣  Testing printer connection..."
echo ""
echo "Select a port number from above (or press Enter to skip): "
read -r PORT_NUM

if [ -n "$PORT_NUM" ]; then
    python3 << EOF
import serial
import serial.tools.list_ports
import time

ports = list(serial.tools.list_ports.comports())
try:
    port_idx = int("$PORT_NUM") - 1
    if 0 <= port_idx < len(ports):
        port = ports[port_idx].device
        print(f"Testing connection to {port}...")
        
        # Try to connect
        ser = serial.Serial(port, 115200, timeout=2)
        time.sleep(2)
        
        # Send M115 (firmware info)
        ser.write(b"M115\n")
        time.sleep(0.5)
        
        # Read response
        response = ser.read(ser.in_waiting).decode('utf-8', errors='ignore')
        
        if "FIRMWARE_NAME" in response or "Prusa" in response:
            print("\033[0;32m✅ Successfully connected to Prusa printer!\033[0m")
            print(f"Response: {response[:100]}...")
        else:
            print("\033[0;31m❌ Connected but no valid response\033[0m")
            
        ser.close()
    else:
        print("\033[0;31m❌ Invalid port selection\033[0m")
except Exception as e:
    print(f"\033[0;31m❌ Connection failed: {e}\033[0m")
EOF
fi

# Step 5: Check if backend API is running
echo ""
echo "5️⃣  Checking backend API..."
if curl -s http://localhost:8000/docs > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend API is running${NC}"
    
    # Try to get printer list
    echo "   Fetching printer list..."
    PRINTERS=$(curl -s http://localhost:8000/api/v1/equipment/printers 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ API endpoint accessible${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Backend API not running${NC}"
    echo "   Start it with:"
    echo "   cd software/backend && python3 -m uvicorn main:app --reload"
fi

# Step 6: Summary
echo ""
echo "========================================"
echo "📊 Connection Test Summary"
echo "========================================"

# Create test status file
cat > prusa_test_results.txt << EOF
W.I.T. Prusa XL Connection Test Results
Generated: $(date)

System Checks:
- Python: $(python3 --version)
- pyserial: $(python3 -c "import serial; print('Installed')" 2>/dev/null || echo "Not installed")
- Backend API: $(curl -s http://localhost:8000/docs > /dev/null 2>&1 && echo "Running" || echo "Not running")

Available Ports:
$(python3 -c "import serial.tools.list_ports; [print(f'  - {p.device}: {p.description}') for p in serial.tools.list_ports.comports()]" 2>/dev/null)

Next Steps:
1. Run setup script: python3 setup-prusa-xl.py
2. Start backend: cd software/backend && python3 -m uvicorn main:app --reload
3. Open dashboard: http://localhost:3000
4. Add printer via UI
EOF

echo -e "${GREEN}✅ Test complete! Results saved to prusa_test_results.txt${NC}"
echo ""
echo "🚀 Next steps:"
echo "   1. Run the setup script: python3 setup-prusa-xl.py"
echo "   2. Follow the connection guide in connect-prusa-guide.md"
echo ""
echo "Need help? Check the troubleshooting section in the guide!"