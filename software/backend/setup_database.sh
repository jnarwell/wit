#!/bin/bash
# W.I.T. Database Setup Script
# File: software/backend/setup_database.sh

set -e

echo "=== W.I.T. Database Setup ==="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "main.py" ]; then
    echo -e "${RED}Error: Please run this script from the software/backend directory${NC}"
    exit 1
fi

# Function to check if PostgreSQL is running
check_postgres() {
    if command -v pg_isready &> /dev/null; then
        pg_isready -h localhost -p 5432 &> /dev/null
        return $?
    else
        # Try to connect using Python
        python3 -c "
import psycopg2
try:
    conn = psycopg2.connect(host='localhost', port=5432, connect_timeout=3)
    conn.close()
    exit(0)
except:
    exit(1)
" 2>/dev/null
        return $?
    fi
}

# Function to check if Docker is running
check_docker() {
    if command -v docker &> /dev/null; then
        docker info &> /dev/null
        return $?
    else
        return 1
    fi
}

# Parse command line arguments
SETUP_MODE="auto"
FORCE_RECREATE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --docker)
            SETUP_MODE="docker"
            shift
            ;;
        --local)
            SETUP_MODE="local"
            shift
            ;;
        --sqlite)
            SETUP_MODE="sqlite"
            shift
            ;;
        --force)
            FORCE_RECREATE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --docker    Use Docker PostgreSQL container"
            echo "  --local     Use local PostgreSQL installation"
            echo "  --sqlite    Use SQLite (for edge deployment)"
            echo "  --force     Force recreate database"
            echo "  -h, --help  Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Auto-detect setup mode if not specified
if [ "$SETUP_MODE" = "auto" ]; then
    echo "Auto-detecting database setup mode..."
    
    if check_docker; then
        echo -e "${GREEN}✓ Docker is available${NC}"
        SETUP_MODE="docker"
    elif check_postgres; then
        echo -e "${GREEN}✓ Local PostgreSQL is available${NC}"
        SETUP_MODE="local"
    else
        echo -e "${YELLOW}Neither Docker nor PostgreSQL found, using SQLite${NC}"
        SETUP_MODE="sqlite"
    fi
fi

echo -e "\nUsing setup mode: ${GREEN}$SETUP_MODE${NC}"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "\nCreating .env file..."
    cat > .env << EOF
# W.I.T. Backend Configuration

# Database
WIT_STORAGE_MODE=$SETUP_MODE
WIT_DB_PASSWORD=wit_secure_password_$(openssl rand -hex 8)

# Security
WIT_SECRET_KEY=$(openssl rand -hex 32)
JWT_SECRET_KEY=$(openssl rand -hex 32)

# API Keys (add your own)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Development
WIT_DEBUG=true
EOF
    echo -e "${GREEN}✓ Created .env file${NC}"
else
    echo -e "${YELLOW}! .env file already exists${NC}"
fi

# Load environment variables
set -a
source .env
set +a

# Setup based on mode
case $SETUP_MODE in
    docker)
        echo -e "\n${YELLOW}Setting up PostgreSQL with Docker...${NC}"
        
        # Check if container already exists
        if docker ps -a | grep -q wit_postgres; then
            if [ "$FORCE_RECREATE" = true ]; then
                echo "Removing existing container..."
                docker stop wit_postgres 2>/dev/null || true
                docker rm wit_postgres 2>/dev/null || true
            else
                echo "Starting existing container..."
                docker start wit_postgres
            fi
        else
            # Create new container
            echo "Creating new PostgreSQL container..."
            docker run -d \
                --name wit_postgres \
                -e POSTGRES_USER=wit_user \
                -e POSTGRES_PASSWORD=$WIT_DB_PASSWORD \
                -e POSTGRES_DB=wit_db \
                -p 5432:5432 \
                -v wit_postgres_data:/var/lib/postgresql/data \
                timescale/timescaledb:latest-pg15
            
            echo "Waiting for PostgreSQL to start..."
            sleep 5
        fi
        
        # Update .env with connection details
        sed -i.bak 's|^DATABASE_URL=.*|DATABASE_URL=postgresql://wit_user:'$WIT_DB_PASSWORD'@localhost:5432/wit_db|' .env 2>/dev/null || \
        echo "DATABASE_URL=postgresql://wit_user:$WIT_DB_PASSWORD@localhost:5432/wit_db" >> .env
        ;;
        
    local)
        echo -e "\n${YELLOW}Using local PostgreSQL...${NC}"
        
        # Create database and user if they don't exist
        echo "Creating database and user (may require sudo password)..."
        
        sudo -u postgres psql << EOF
-- Create user if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'wit_user') THEN
        CREATE USER wit_user WITH PASSWORD '$WIT_DB_PASSWORD';
    END IF;
END\$\$;

-- Create database if not exists
SELECT 'CREATE DATABASE wit_db OWNER wit_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'wit_db')\\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE wit_db TO wit_user;
EOF
        
        # Update .env
        sed -i.bak 's|^DATABASE_URL=.*|DATABASE_URL=postgresql://wit_user:'$WIT_DB_PASSWORD'@localhost:5432/wit_db|' .env 2>/dev/null || \
        echo "DATABASE_URL=postgresql://wit_user:$WIT_DB_PASSWORD@localhost:5432/wit_db" >> .env
        ;;
        
    sqlite)
        echo -e "\n${YELLOW}Using SQLite database...${NC}"
        
        # Create data directory
        mkdir -p data
        
        # Update .env
        sed -i.bak 's|^DATABASE_URL=.*|DATABASE_URL=sqlite:///data/wit_local.db|' .env 2>/dev/null || \
        echo "DATABASE_URL=sqlite:///data/wit_local.db" >> .env
        
        sed -i.bak 's|^WIT_STORAGE_MODE=.*|WIT_STORAGE_MODE=local|' .env
        ;;
esac

# Install Python dependencies
echo -e "\n${YELLOW}Installing Python dependencies...${NC}"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Add any missing dependencies
pip install aiosqlite  # For SQLite support

# Initialize Alembic if needed
if [ ! -d "alembic" ]; then
    echo -e "\n${YELLOW}Initializing Alembic...${NC}"
    alembic init alembic
fi

# Run database initialization
echo -e "\n${YELLOW}Initializing database...${NC}"
python3 init_database.py

echo -e "\n${GREEN}=== Database setup completed! ===${NC}"
echo
echo "Next steps:"
echo "1. Review and update the .env file with your API keys"
echo "2. Start the backend server:"
echo "   source venv/bin/activate"
echo "   python3 dev_server.py"
echo
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Password: changeme123"
echo

# Show database connection info
if [ "$SETUP_MODE" = "docker" ]; then
    echo "PostgreSQL is running in Docker container 'wit_postgres'"
    echo "To connect with psql:"
    echo "  docker exec -it wit_postgres psql -U wit_user -d wit_db"
fi