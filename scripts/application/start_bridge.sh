#!/bin/bash
# Start W.I.T. Printer Bridge

echo "🌉 W.I.T. Printer Bridge Launcher"
echo "================================="
echo

# Default values
PRINTER_ID=""
PRINTER_URL="http://192.168.1.131"
PRINTER_USER="maker"
PRINTER_PASS=""
WIT_SERVER="http://localhost:8000"

# Check if printer ID is provided
if [ -z "$1" ]; then
    echo "Usage: ./start_bridge.sh PRINTER_ID [PRINTER_PASSWORD]"
    echo
    echo "Example:"
    echo "  ./start_bridge.sh M1755224055771 YourPassword"
    echo
    echo "To find your printer ID:"
    echo "  1. Open W.I.T. web interface"
    echo "  2. Go to Machines page"
    echo "  3. Look at the printer widget or URL"
    echo
    exit 1
fi

PRINTER_ID=$1

# Check if password is provided
if [ -n "$2" ]; then
    PRINTER_PASS=$2
else
    echo -n "Enter PrusaLink password: "
    read -s PRINTER_PASS
    echo
fi

echo "Starting bridge with:"
echo "  Printer ID: $PRINTER_ID"
echo "  Printer URL: $PRINTER_URL"
echo "  W.I.T. Server: $WIT_SERVER"
echo

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed"
    exit 1
fi

# Install required packages if needed
echo "Checking Python packages..."
pip3 install -q websockets aiohttp requests 2>/dev/null || true

# Start the bridge
echo "Starting bridge..."
# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
python3 "$SCRIPT_DIR/wit_printer_bridge.py" \
    --printer-id "$PRINTER_ID" \
    --printer-url "$PRINTER_URL" \
    --printer-user "$PRINTER_USER" \
    --printer-pass "$PRINTER_PASS" \
    --wit-server "$WIT_SERVER"