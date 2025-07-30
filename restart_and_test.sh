#!/bin/bash
echo "Restarting backend server..."
pkill -f "python3 -m software.frontend.web.dev_server" || true
sleep 2

# Start server in background
python3 -m software.frontend.web.dev_server &
SERVER_PID=$!

# Wait for server to start
echo "Waiting for server to start..."
sleep 5

# Test authentication
echo -e "\nTesting authentication..."
python3 final_auth_test.py

# Kill server
kill $SERVER_PID 2>/dev/null || true