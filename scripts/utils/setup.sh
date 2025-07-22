#!/bin/bash

# W.I.T. Frontend Setup Script - Industrial Theme
echo "🏭 Setting up W.I.T. Industrial Frontend..."

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install Node.js and npm first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create any missing directories
mkdir -p src/components src/hooks src/services

echo "✅ Setup complete!"
echo ""
echo "To start the development server, run:"
echo "  npm run dev"
echo ""
echo "The app will be available at http://localhost:3000"