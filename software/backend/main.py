"""
W.I.T. Backend Main Application

File: software/backend/main.py

FastAPI application entry point that initializes all services and routers.
"""

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
from datetime import datetime

# Import routers with relative imports
from .api.voice_api import router as voice_router
from .api.vision_api import router as vision_router
from .api.equipment_api import router as equipment_router
from .api.workspace_api import router as workspace_router
from .api.system_api import router as system_router

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


# Create FastAPI app
app = FastAPI(
    title="W.I.T. Terminal API",
    description="Workspace Integrated Terminal - JARVIS for the Workshop",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "type": type(exc).__name__
        }
    )


# Include routers
app.include_router(auth_router)
app.include_router(voice_router)
app.include_router(vision_router)
app.include_router(equipment_router)
app.include_router(workspace_router)
app.include_router(system_router)


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "W.I.T. Terminal API",
        "version": "1.0.0",
        "status": "operational",
        "docs": "/docs",
        "timestamp": datetime.now().isoformat()
    }


# Health check endpoint
@app.get("/health")
async def health_check():
    """Basic health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }


# Static files (if needed for web UI)
# app.mount("/static", StaticFiles(directory="static"), name="static")


# Middleware to add request ID
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Add request ID to all requests"""
    import uuid
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    
    return response


# Middleware to log requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests"""
    start_time = datetime.now()
    
    # Log request
    logger.info(f"Request: {request.method} {request.url.path}")
    
    response = await call_next(request)
    
    # Log response
    duration = (datetime.now() - start_time).total_seconds()
    logger.info(
        f"Response: {request.method} {request.url.path} "
        f"- Status: {response.status_code} - Duration: {duration:.3f}s"
    )
    
    return response


def create_app() -> FastAPI:
    """Factory function to create the app"""
    return app


if __name__ == "__main__":
    # Development server
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("RELOAD", "true").lower() == "true",
        log_level=os.getenv("LOG_LEVEL", "info").lower()
    )