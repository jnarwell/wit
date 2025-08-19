# W.I.T. Quick Start Guide

Get up and running with W.I.T. in under 10 minutes!

## Prerequisites

Before you begin, ensure you have:
- Python 3.8 or higher
- Node.js 16 or higher
- PostgreSQL 12 or higher
- Git

## Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/wit.git
cd wit
```

## Step 2: Database Setup

1. Create a PostgreSQL database:
```bash
createdb wit_db
```

2. Create a database user:
```sql
CREATE USER wit_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE wit_db TO wit_user;
```

## Step 3: Backend Setup

```bash
cd software/backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://wit_user:your_secure_password@localhost/wit_db
SECRET_KEY=$(python -c 'import secrets; print(secrets.token_hex(32))')
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
UPLOAD_FOLDER=./wit_storage/uploads
PROJECT_FOLDER=./wit_storage/projects
EOF

# Run database migrations
alembic upgrade head

# Start the backend server
python dev_server.py
```

The backend should now be running at `http://localhost:8000`

## Step 4: Frontend Setup

Open a new terminal window:

```bash
cd software/frontend/web

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend should now be running at `http://localhost:5173`

## Step 5: Create Your First User

1. Open your browser and go to `http://localhost:5173`
2. Click "Sign Up" or go to `http://localhost:5173/signup`
3. Fill in your details and create an account
4. Log in with your new credentials

## Step 6: Add Your First Printer (Optional)

1. Navigate to the "Machines" page
2. Click "Add Printer"
3. Fill in the printer details:
   - **Name**: My 3D Printer
   - **Type**: Choose your printer type
   - **Connection**: Network or Serial
   - **IP/Port**: Your printer's address
   - **API Key**: If required

4. Click "Test Connection" to verify
5. Click "Add Printer" to save

## Step 7: Create Your First Project

1. Navigate to the "Projects" page
2. Click "New Project"
3. Fill in:
   - **Name**: My First Project
   - **Description**: Testing W.I.T. platform
   - **Status**: Active
   - **Priority**: Medium

4. Click "Create Project"

## Step 8: Try the AI Terminal

1. Navigate to the "Terminal" page (WIT)
2. Try some commands:
   - "What is the status of my printers?"
   - "Create a new task for my project"
   - "Show me the temperature of my printer"

## Optional: Universal Desktop Controller

For desktop integration features:

```bash
cd software/universal-desktop-controller

# Install dependencies
npm install

# Start UDC
npm run dev
```

1. UDC will start in your system tray
2. Get your auth token from Settings → Security in the web UI
3. Configure UDC with your auth token
4. Try the Arduino IDE integration

## Troubleshooting

### Backend won't start
- Check PostgreSQL is running: `pg_isready`
- Verify database credentials in `.env`
- Check Python version: `python --version`

### Frontend won't compile
- Check Node.js version: `node --version`
- Clear npm cache: `npm cache clean --force`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`

### Can't connect to printer
- Verify printer is on the same network
- Check firewall settings
- Ensure API key is correct (for PrusaLink/OctoPrint)
- Try the test connection endpoint first

### Database errors
- Run migrations: `alembic upgrade head`
- Check database exists: `psql -d wit_db -c '\dt'`
- Reset database: `alembic downgrade base && alembic upgrade head`

## Next Steps

- Read the [Architecture Overview](ARCHITECTURE.md)
- Explore the [API Documentation](API.md)
- Set up [AI Providers](AI_SETUP.md)
- Create a [UDC Plugin](PLUGINS.md)
- Join our [Discord Community](https://discord.gg/wit-makers)

## Getting Help

- Check the [documentation](https://github.com/yourusername/wit/docs)
- Search [existing issues](https://github.com/yourusername/wit/issues)
- Ask in [discussions](https://github.com/yourusername/wit/discussions)
- Join our Discord server

## Quick Commands Reference

### Backend
```bash
# Start backend
python dev_server.py

# Run tests
pytest

# Database migrations
alembic upgrade head
alembic revision --autogenerate -m "Description"

# Format code
black .
```

### Frontend
```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

### Docker (Alternative)
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Happy making with W.I.T.! 🛠️