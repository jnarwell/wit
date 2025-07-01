"""
W.I.T. Backend - Working version with graceful fallbacks
"""

import os
import sys
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

# Add parent directories to path
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir.parent.parent))  # Add project root
sys.path.insert(0, str(current_dir.parent))  # Add software dir

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Try to import services with fallbacks
services_available = {}

try:
    from backend.services.database_services import DatabaseService
    services_available['database'] = True
except ImportError as e:
    logger.warning(f"Database service not available: {e}")
    services_available['database'] = False
    DatabaseService = None

try:
    from backend.services.mqtt_service import MQTTService
    services_available['mqtt'] = True
except ImportError as e:
    logger.warning(f"MQTT service not available: {e}")
    services_available['mqtt'] = False
    MQTTService = None

try:
    from backend.services.auth_services import auth_router
    services_available['auth'] = True
except ImportError as e:
    logger.warning(f"Auth service not available: {e}")
    services_available['auth'] = False
    auth_router = None

# Try to import routers
routers_available = {}

try:
    from backend.api.voice_api import router as voice_router
    routers_available['voice'] = True
except ImportError as e:
    logger.warning(f"Voice API not available: {e}")
    routers_available['voice'] = False
    voice_router = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle"""
    logger.info("Starting W.I.T. Backend...")
    logger.info(f"Services available: {services_available}")
    logger.info(f"Routers available: {routers_available}")
    
    # Initialize available services
    if services_available.get('database') and DatabaseService:
        try:
            db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost/wit_test")
            app.state.db = DatabaseService(db_url)
            # Don't connect if no database is running
            logger.info("Database service initialized (connection pending)")
        except Exception as e:
            logger.error(f"Database init error: {e}")
    
    yield
    
    logger.info("Shutting down W.I.T. Backend...")

# Create FastAPI app
app = FastAPI(
    title="W.I.T. Terminal API",
    description="Workspace Integrated Terminal - Working Version",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "W.I.T. Terminal API",
        "version": "1.0.0",
        "status": "operational",
        "services": services_available,
        "apis": routers_available,
        "timestamp": datetime.now().isoformat()
    }

# Health endpoint
@app.get("/health")
async def health():
    """Health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

# Include available routers
if auth_router:
    app.include_router(auth_router)
    logger.info("Auth router included")

if voice_router:
    app.include_router(voice_router)
    logger.info("Voice router included")

# Add other routers as they become available...

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)