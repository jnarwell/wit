#!/bin/bash
# Quick SQLite Setup for W.I.T. Backend
# File: software/backend/quick_setup_sqlite.sh

set -e

echo "=== W.I.T. Quick SQLite Setup ==="
echo

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Ensure we're in the backend directory
if [ ! -f "main.py" ]; then
    echo "Error: Please run this script from the software/backend directory"
    exit 1
fi

# Create/activate virtual environment
echo -e "${YELLOW}Setting up Python virtual environment...${NC}"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Upgrade pip first
echo -e "${YELLOW}Upgrading pip...${NC}"
pip install --upgrade pip

# Install SQLite-compatible requirements
echo -e "${YELLOW}Installing SQLite-compatible dependencies...${NC}"
pip install -r requirements-sqlite.txt

# Update .env for SQLite
echo -e "${YELLOW}Configuring for SQLite...${NC}"
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
EOF
    echo -e "${GREEN}✓ Created .env file${NC}"
else
    # Update existing .env for SQLite
    echo -e "${YELLOW}Updating existing .env for SQLite mode...${NC}"
    sed -i.bak 's/^WIT_STORAGE_MODE=.*/WIT_STORAGE_MODE=local/' .env 2>/dev/null || true
    sed -i.bak 's|^DATABASE_URL=.*|DATABASE_URL=sqlite:///data/wit_local.db|' .env 2>/dev/null || true
fi

# Create necessary directories
echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p data
mkdir -p logs
mkdir -p storage/files
mkdir -p alembic/versions

# Initialize Alembic if needed
if [ ! -f "alembic.ini" ]; then
    echo -e "${YELLOW}Creating alembic.ini...${NC}"
    cat > alembic.ini << 'EOF'
# Alembic Configuration
[alembic]
script_location = alembic
prepend_sys_path = .
version_path_separator = os
sqlalchemy.url = sqlite:///data/wit_local.db

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
EOF
fi

# Create migration directory structure
mkdir -p alembic
if [ ! -f "alembic/script.py.mako" ]; then
    echo -e "${YELLOW}Creating Alembic templates...${NC}"
    cat > alembic/script.py.mako << 'EOF'
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}


def upgrade():
    ${upgrades if upgrades else "pass"}


def downgrade():
    ${downgrades if downgrades else "pass"}
EOF
fi

if [ ! -f "alembic/env.py" ]; then
    cat > alembic/env.py << 'EOF'
from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

# Import your models
from models.database_models_extended import Base

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set target metadata
target_metadata = Base.metadata

# Get database URL from environment
from config import settings
config.set_main_option('sqlalchemy.url', settings.DATABASE_URL)


def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
EOF
fi

# Run database initialization
echo -e "${YELLOW}Initializing database...${NC}"
python3 init_database.py

echo -e "\n${GREEN}=== Setup completed successfully! ===${NC}"
echo
echo "To start the backend server:"
echo "  source venv/bin/activate"
echo "  python3 dev_server.py"
echo
echo "To run tests:"
echo "  source venv/bin/activate"
echo "  python3 test_database.py"
echo
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Password: changeme123"