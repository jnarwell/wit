#!/bin/bash
# Start Mosquitto MQTT Broker

echo "🚀 Starting Mosquitto MQTT Broker..."

# Find mosquitto executable
MOSQUITTO_PATH="/opt/homebrew/opt/mosquitto/sbin/mosquitto"

if [ ! -f "$MOSQUITTO_PATH" ]; then
    echo "❌ Mosquitto not found at $MOSQUITTO_PATH"
    echo "Trying to find it..."
    MOSQUITTO_PATH=$(find /opt/homebrew -name mosquitto -type f 2>/dev/null | grep sbin | head -1)
    
    if [ -z "$MOSQUITTO_PATH" ]; then
        echo "❌ Could not find mosquitto executable"
        echo "Try running: brew reinstall mosquitto"
        exit 1
    fi
fi

echo "✓ Found mosquitto at: $MOSQUITTO_PATH"

# Create a simple config file
cat > /tmp/mosquitto_wit.conf << EOF
# W.I.T. Mosquitto Configuration
listener 1883
allow_anonymous true
log_type all
log_dest stdout
EOF

echo "✓ Created temporary config file"
echo ""
echo "Starting Mosquitto on port 1883..."
echo "Press Ctrl+C to stop"
echo ""

# Run mosquitto
$MOSQUITTO_PATH -c /tmp/mosquitto_wit.conf -v