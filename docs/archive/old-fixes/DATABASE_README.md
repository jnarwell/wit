# W.I.T. Database Setup Guide

## Overview

The W.I.T. backend uses a flexible database architecture that supports both PostgreSQL (for development/cloud) and SQLite (for edge deployment). The database includes comprehensive models for project management, task tracking, team collaboration, material/BOM management, and file storage.

## Quick Start

### Automatic Setup (Recommended)

```bash
cd software/backend
chmod +x setup_database.sh
./setup_database.sh
```

This script will:
- Auto-detect available database options (Docker, local PostgreSQL, or SQLite)
- Create the database and user
- Set up environment variables
- Install dependencies
- Run migrations
- Create initial data

### Manual Setup Options

#### Option 1: Docker PostgreSQL (Recommended for Development)

```bash
# Start PostgreSQL container
docker run -d \
  --name wit_postgres \
  -e POSTGRES_USER=wit_user \
  -e POSTGRES_PASSWORD=your_secure_password \
  -e POSTGRES_DB=wit_db \
  -p 5432:5432 \
  -v wit_postgres_data:/var/lib/postgresql/data \
  timescale/timescaledb:latest-pg15

# Set DATABASE_URL in .env
DATABASE_URL=postgresql://wit_user:your_secure_password@localhost:5432/wit_db

# Run initialization
python3 init_database.py
```

#### Option 2: Local PostgreSQL

```bash
# Create database and user
sudo -u postgres psql
CREATE USER wit_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE wit_db OWNER wit_user;
\q

# Set DATABASE_URL in .env
DATABASE_URL=postgresql://wit_user:your_secure_password@localhost:5432/wit_db

# Run initialization
python3 init_database.py
```

#### Option 3: SQLite (For Edge Deployment)

```bash
# Set storage mode in .env
WIT_STORAGE_MODE=local
DATABASE_URL=sqlite:///data/wit_local.db

# Run initialization
python3 init_database.py
```

## Database Schema

### Core Models

1. **Users** - Authentication and user management
2. **Projects** - Main project entities
3. **Tasks** - Task management with kanban support
4. **Teams** - Project teams and subteams
5. **TeamMembers** - Team membership and roles
6. **Materials** - Inventory management
7. **ProjectMaterials** - Project BOM (Bill of Materials)
8. **MaterialUsage** - Material allocation tracking
9. **ProjectFiles** - File storage and versioning
10. **FileVersions** - File version history
11. **Jobs** - Manufacturing job queue
12. **Equipment** - Hardware equipment registry
13. **Tags** - Categorization system
14. **Comments** - Discussion threads

### Key Features

- **UUID Primary Keys** - Globally unique identifiers
- **JSONB Fields** - Flexible metadata storage (PostgreSQL)
- **Soft Deletes** - Recoverable file deletion
- **Cascading Deletes** - Automatic cleanup of related records
- **Optimized Indexes** - Fast queries for common operations
- **Audit Trails** - Created/updated timestamps

## Environment Variables

Create a `.env` file with:

```env
# Database Configuration
DATABASE_URL=postgresql://wit_user:password@localhost:5432/wit_db
WIT_STORAGE_MODE=postgres  # Options: postgres, local (sqlite), hybrid

# Security
WIT_SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-key-here

# File Storage
WIT_FILE_STORAGE_PATH=storage/files
WIT_MAX_FILE_SIZE=104857600  # 100MB

# Optional Services
REDIS_URL=redis://localhost:6379
WIT_MQTT_BROKER=localhost
```

## Database Operations

### Running Migrations

```bash
# Create new migration
alembic revision -m "Description of changes"

# Apply migrations
alembic upgrade head

# Rollback one revision
alembic downgrade -1
```

### Testing Database

```bash
# Run database tests
python3 test_database.py

# Check database health
python3 -c "from services.database_services import db_service; import asyncio; print(asyncio.run(db_service.health_check()))"
```

### Database Utilities

```python
from services.database_services import DatabaseUtils

# Get table statistics
stats = await DatabaseUtils.get_table_stats()

# Backup database (SQLite only)
await DatabaseUtils.backup_database("backups/wit_backup.db")

# Vacuum/optimize database
await DatabaseUtils.vacuum_database()
```

## Troubleshooting

### Connection Issues

1. **PostgreSQL Connection Refused**
   ```bash
   # Check if PostgreSQL is running
   sudo systemctl status postgresql
   # or for Docker
   docker ps | grep postgres
   ```

2. **Permission Denied**
   ```bash
   # Fix PostgreSQL permissions
   sudo -u postgres psql -c "ALTER USER wit_user CREATEDB;"
   ```

3. **SQLite Locked**
   ```bash
   # Ensure only one process accesses SQLite
   fuser data/wit_local.db
   ```

### Migration Issues

1. **Alembic Head Conflicts**
   ```bash
   # Check current revision
   alembic current
   
   # Force to specific revision
   alembic stamp head
   ```

2. **Table Already Exists**
   ```bash
   # Drop all tables (CAUTION: Data loss!)
   python3 -c "from models.database_models_extended import Base; from services.database_services import db_service; import asyncio; asyncio.run(db_service.engine.drop_all())"
   ```

## Performance Tips

1. **PostgreSQL Optimization**
   - Enable query statistics: `shared_preload_libraries = 'pg_stat_statements'`
   - Tune shared_buffers: `shared_buffers = 256MB`
   - Set effective_cache_size: `effective_cache_size = 1GB`

2. **SQLite Optimization**
   - Enable WAL mode: `PRAGMA journal_mode=WAL;`
   - Set cache size: `PRAGMA cache_size=10000;`
   - Regular VACUUM: `await DatabaseUtils.vacuum_database()`

3. **Application Level**
   - Use connection pooling (configured by default)
   - Batch operations when possible
   - Use selective loading with SQLAlchemy

## Security Considerations

1. **Always use strong passwords** for database users
2. **Never commit .env files** to version control
3. **Use SSL/TLS** for remote PostgreSQL connections
4. **Regular backups** of production data
5. **Principle of least privilege** for database users

## Default Credentials

After initialization:
- **Username**: admin
- **Password**: changeme123

⚠️ **IMPORTANT**: Change these credentials immediately in production!

## Support

For issues or questions:
1. Check the logs in `logs/wit_backend.log`
2. Run the test script: `python3 test_database.py`
3. Verify environment variables are loaded correctly
4. Ensure all dependencies are installed: `pip install -r requirements.txt`