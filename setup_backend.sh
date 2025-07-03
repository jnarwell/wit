#!/bin/bash

echo "🔧 Setting up W.I.T. Backend..."

# Check if in virtual environment
if [[ "$VIRTUAL_ENV" == "" ]]; then
    echo "⚠️  Not in virtual environment. Creating one..."
    python3 -m venv venv
    source venv/bin/activate
fi

echo "📦 Installing backend dependencies..."
pip install fastapi uvicorn python-jose passlib python-multipart sqlalchemy asyncpg redis pydantic-settings python-dotenv

echo "✅ Backend dependencies installed!"
echo ""
echo "Now run: python3 dev_server.py"