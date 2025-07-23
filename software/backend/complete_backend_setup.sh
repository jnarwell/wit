#!/bin/bash
# Complete Backend Setup Script for W.I.T.
# Fixes all dependency issues and initializes the database

set -e  # Exit on error

echo "🚀 W.I.T. Complete Backend Setup"
echo "================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the backend directory
if [ ! -f "requirements.txt" ]; then
    echo -e "${RED}Error: Please run this script from the software/backend directory${NC}"
    exit 1
fi

# Step 1: Fix pydantic dependencies
echo -e "\n${YELLOW}Step 1: Fixing pydantic dependencies...${NC}"
python3 fix_pydantic_deps.py
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to fix dependencies${NC}"
    exit 1
fi

# Step 2: Install aiosqlite for SQLite support
echo -e "\n${YELLOW}Step 2: Installing SQLite support...${NC}"
pip install aiosqlite asyncpg

# Step 3: Create necessary directories
echo -e "\n${YELLOW}Step 3: Creating directories...${NC}"
mkdir -p data
mkdir -p logs
mkdir -p storage/files
mkdir -p alembic/versions

# Step 4: Setup environment variables
echo -e "\n${YELLOW}Step 4: Configuring environment...${NC}"
if [ ! -f ".env" ]; then
    cat > .env << EOF
# W.I.T. Backend Configuration - SQLite Mode

# Database
WIT_STORAGE_MODE=local
DATABASE_URL=sqlite:///data/wit_local.db
WIT_SQLITE_PATH=data/wit_local.db

# Security
WIT_SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
JWT_SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_hex(32))')

# API Keys (add your own)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Development
WIT_DEBUG=true

# File Storage
WIT_FILE_STORAGE_PATH=storage/files
WIT_MAX_FILE_SIZE=104857600

# CORS
WIT_CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Server
HOST=0.0.0.0
PORT=8000
EOF
    echo -e "${GREEN}✓ Created .env file${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

# Step 5: Initialize database
echo -e "\n${YELLOW}Step 5: Initializing database...${NC}"
python3 init_database.py
if [ $? -ne 0 ]; then
    echo -e "${RED}Database initialization failed${NC}"
    echo -e "${YELLOW}Trying alternative initialization...${NC}"
    
    # Create a simple init script if the main one fails
    cat > simple_init_db.py << 'EOF'
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from models.database_models import Base
from config import settings

async def init_db():
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables created!")

if __name__ == "__main__":
    asyncio.run(init_db())
EOF
    
    python3 simple_init_db.py
fi

# Step 6: Test the server
echo -e "\n${YELLOW}Step 6: Testing server startup...${NC}"
echo -e "Starting server on http://localhost:8000"
echo -e "Press Ctrl+C to stop when you see 'Application startup complete'"
echo -e "\n${GREEN}Server logs:${NC}"

# Start the server in the background and capture the PID
python3 dev_server.py &
SERVER_PID=$!

# Wait a few seconds for server to start
sleep 5

# Check if server is running
if kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "\n${GREEN}✅ Server started successfully!${NC}"
    echo -e "\n${YELLOW}Testing endpoints...${NC}"
    
    # Test health endpoint
    if curl -s http://localhost:8000/api/v1/system/health > /dev/null; then
        echo -e "${GREEN}✓ Health check passed${NC}"
    fi
    
    # Test auth endpoint
    echo -e "\n${YELLOW}Testing authentication...${NC}"
    AUTH_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/auth/token \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=admin&password=admin123" 2>/dev/null || echo "FAILED")
    
    if [[ $AUTH_RESPONSE == *"access_token"* ]]; then
        echo -e "${GREEN}✓ Authentication working${NC}"
    else
        echo -e "${YELLOW}⚠ Authentication needs setup (this is normal for first run)${NC}"
    fi
    
    # Kill the test server
    kill $SERVER_PID 2>/dev/null
    
    echo -e "\n${GREEN}🎉 Backend setup complete!${NC}"
    echo -e "\n${YELLOW}Next steps:${NC}"
    echo "1. Start the server: ${GREEN}python3 dev_server.py${NC}"
    echo "2. View API docs: ${GREEN}http://localhost:8000/docs${NC}"
    echo "3. Default login: ${GREEN}admin / admin123${NC}"
else
    echo -e "\n${RED}❌ Server failed to start${NC}"
    echo "Check the logs above for errors"
    exit 1
fi

echo -e "\n${GREEN}✅ Setup completed successfully!${NC}"