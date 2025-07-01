#!/bin/bash
echo "Setting up PostgreSQL for W.I.T..."

# Detect docker-compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "❌ Docker Compose not found. Please install Docker Desktop."
    exit 1
fi

echo "Using: $DOCKER_COMPOSE"

# Start PostgreSQL if not running
$DOCKER_COMPOSE up -d postgres

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to start..."
sleep 5  # Give it a moment to start

# Simple connection test
if $DOCKER_COMPOSE exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready!"
    
    # Create the database
    $DOCKER_COMPOSE exec -T postgres psql -U postgres -c "CREATE DATABASE wit_db;" 2>/dev/null || echo "Database may already exist"
    
    # List databases
    echo "Databases available:"
    $DOCKER_COMPOSE exec -T postgres psql -U postgres -c "\l" | grep wit_db
else
    echo "⚠️  PostgreSQL is not responding. Checking container status..."
    docker ps -a | grep postgres
fi

echo "✅ Setup complete!"
