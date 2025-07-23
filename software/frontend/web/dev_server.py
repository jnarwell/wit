#!/usr/bin/env python3
"""
W.I.T. Development Server - REWRITTEN for stability
"""
import logging
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Adjust imports to match the new structure
from software.backend.services.database_services import create_db_and_tables, close_db_connection
from software.frontend.web.routers import (
    projects_router, tasks_router, teams_router, materials_router, files_router,
    auth_router, voice_router, vision_router, 
    equipment_router, workspace_router, system_router,
    network_router
)

# --- Lifespan Management ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles startup and shutdown events for the application."""
    logging.info("--- Server Starting Up ---")
    try:
        await create_db_and_tables()
        logging.info("Database initialization complete.")
    except Exception as e:
        logging.error(f"FATAL: Database initialization failed: {e}", exc_info=True)
    
    yield
    
    logging.info("--- Server Shutting Down ---")
    await close_db_connection()

# --- FastAPI App Initialization ---
app = FastAPI(
    title="W.I.T. Terminal API",
    lifespan=lifespan
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all API routers
app.include_router(projects_router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(tasks_router, prefix="/api/v1/tasks", tags=["tasks"])
app.include_router(teams_router, prefix="/api/v1/teams", tags=["teams"])
app.include_router(materials_router, prefix="/api/v1/materials", tags=["materials"])
app.include_router(files_router, prefix="/api/v1/files", tags=["files"])
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(voice_router, prefix="/api/v1/voice", tags=["voice"])
app.include_router(vision_router, prefix="/api/v1/vision", tags=["vision"])
app.include_router(equipment_router, prefix="/api/v1/equipment", tags=["equipment"])
app.include_router(workspace_router, prefix="/api/v1/workspace", tags=["workspace"])
app.include_router(system_router, prefix="/api/v1/system", tags=["system"])
app.include_router(network_router, prefix="/api/v1/network", tags=["network"])

# --- Root Endpoint ---
@app.get("/")
async def root():
    """Root endpoint with system info."""
    return {"message": "W.I.T. Terminal API is running."}

# --- Main Execution ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)