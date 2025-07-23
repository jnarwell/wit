"""
W.I.T. Backend Main Application

File: software/backend/main.py

FastAPI application entry point that initializes all services and routers.
"""

import sys
sys.path.insert(0, '/app')

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
from datetime import datetime

# Import services with relative imports
from .services.database_services import DatabaseService
from .services.mqtt_service import MQTTService
from .services.event_service import EventService
from .services.auth_services import auth_router



# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global service instances
db_service: DatabaseService = None
mqtt_service: MQTTService = None
event_service: EventService = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage application lifecycle - startup and shutdown
    """
    # Startup
    logger.info("Starting W.I.T. Backend Services...")
    
    # Initialize database
    global db_service
    db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://wit_user:password@localhost/wit_db")
    db_service = DatabaseService(db_url)
    await db_service.connect()
    await db_service.create_tables()
    logger.info("Database connected")
    
    # Initialize MQTT
    global mqtt_service
    mqtt_service = MQTTService(
        host=os.getenv("MQTT_HOST", "localhost"),
        port=int(os.getenv("MQTT_PORT", 1883)),
        username=os.getenv("MQTT_USERNAME"),
        password=os.getenv("MQTT_PASSWORD")
    )
    await mqtt_service.connect()
    logger.info("MQTT connected")
    
    # Initialize Event Service
    global event_service
    event_service = EventService(mqtt_service)
    
    # Publish startup event
    await event_service.publish_system_event(
        "startup",
        "W.I.T. Backend started successfully",
        {
            "version": "1.0.0",
            "timestamp": datetime.now().isoformat()
        }
    )
    
    # Make services available to routers
    app.state.db = db_service
    app.state.mqtt = mqtt_service
    app.state.events = event_service
    
    logger.info("W.I.T. Backend ready!")
    
    yield
    
    # Shutdown
    logger.info("Shutting down W.I.T. Backend Services...")
    
    # Publish shutdown event
    await event_service.publish_system_event(
        "shutdown",
        "W.I.T. Backend shutting down"
    )
    
    # Cleanup services
    await mqtt_service.disconnect()
    await db_service.disconnect()
    
    logger.info("W.I.T. Backend stopped")


# Import routers with relative imports
from .api.voice_api import router as voice_router
from .api.vision_api import router as vision_router
from .api.equipment_api import router as equipment_router
from .api.workspace_api import router as workspace_router
from .api.system_api import router as system_router
from .api.network_api import router as network_router

from .routers import projects, tasks, teams, materials, files

# Create FastAPI app
app = FastAPI(
    title="W.I.T. Terminal API",
    description="Workspace Integrated Terminal - JARVIS for the Workshop",
    version="1.0.0",
    lifespan=lifespan
)

@app.get("/")
async def read_root():
    return {"message": "W.I.T. Terminal API"}

app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(teams.router)
app.include_router(materials.router)
app.include_router(files.router)
app.include_router(system_router)