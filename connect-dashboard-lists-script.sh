#!/bin/bash
# Install dependencies for real printer connections

echo "🖨️  Installing W.I.T. Printer Integration Dependencies"
echo "===================================================="

# Check if in virtual environment
if [[ "$VIRTUAL_ENV" == "" ]]; then
    echo "⚠️  Warning: Not in a virtual environment"
    echo "   Recommended: source venv/bin/activate"
    echo ""
fi

echo "📦 Installing Python packages..."

# Core printer communication
pip install pyserial           # Serial port communication
pip install aiohttp           # Async HTTP for OctoPrint
pip install requests          # HTTP for PrusaLink

# Additional useful packages
pip install python-prusa-link  # PrusaLink API client (if available)

echo ""
echo "🔍 Checking serial ports..."
python3 -c "
import serial.tools.list_ports
ports = list(serial.tools.list_ports.comports())
if ports:
    print('✅ Found serial ports:')
    for p in ports:
        print(f'   • {p.device}: {p.description}')
else:
    print('❌ No serial ports found')
    print('   Make sure your printer is connected via USB')
"

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "📋 Next steps:"
echo "1. Connect your printer via USB or network"
echo "2. Restart the backend server"
echo "3. Use the 'Discover Printers' option in the UI"
echo ""
echo "🖨️  Supported connections:"
echo "   • USB/Serial: Direct connection to printer"
echo "   • PrusaLink: Prusa XL, MK4, MINI+ with network"
echo "   • OctoPrint: Any printer with OctoPrint server"