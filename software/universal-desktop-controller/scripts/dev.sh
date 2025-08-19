#!/bin/bash
# Development runner for W.I.T. Universal Desktop Controller

echo "🚀 W.I.T. Universal Desktop Controller - Development Mode"
echo "========================================================"
echo

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo
fi

# Check if electron is installed locally
if [ ! -f "node_modules/.bin/electron" ]; then
    echo "⚡ Installing Electron locally..."
    npm install electron --save-dev
    echo
fi

# Set development environment
export NODE_ENV=development
export ELECTRON_DISABLE_SECURITY_WARNINGS=true

echo "🔧 Starting in development mode..."
echo "   - Auto-reload enabled"
echo "   - DevTools available"
echo "   - Verbose logging"
echo

# Run electron
./node_modules/.bin/electron . --dev