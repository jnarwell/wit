#!/usr/bin/env python3
"""
W.I.T. Development Server - REWRITTEN for stability
"""
import logging
import asyncio
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# Adjust imports to match the new structure
from software.backend.services.database_services import create_db_and_tables
# Import all models to ensure they're registered
import software.backend.models
from software.backend.services.claude_service import claude_terminal_service
from software.frontend.web.routers import (
    auth_router, 
    users_router,
    projects_router,
    tasks_router,
    equipment_router,
    files_router,
    members_router,
    terminal_router,
    files_api,
    file_operations_router,
    team_members_router,
    project_files_router,
    microcontrollers_router
)
from software.frontend.web.routers.file_operations_router import active_file_connections

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

# --- FastAPI App Initialization ---
app = FastAPI(
    title="W.I.T. Terminal API",
    lifespan=lifespan
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include all API routers
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users_router, prefix="/api/v1/users", tags=["users"])
app.include_router(projects_router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(tasks_router, prefix="/api/v1", tags=["tasks"])
app.include_router(equipment_router, prefix="/api/v1", tags=["equipment"])
app.include_router(microcontrollers_router.router, prefix="/api/v1/microcontrollers", tags=["microcontrollers"])
app.include_router(files_router, prefix="/api/v1", tags=["files"])
app.include_router(members_router, prefix="/api/v1", tags=["members"])
app.include_router(team_members_router, prefix="/api/v1", tags=["team_members"])
app.include_router(terminal_router.router, prefix="/api/v1/terminal", tags=["terminal"])
app.include_router(files_api.router, prefix="/api/v1", tags=["files_api"])
app.include_router(file_operations_router.router, prefix="/api/v1", tags=["file_operations"])
app.include_router(project_files_router, prefix="/api/v1", tags=["project_files"])

@app.websocket("/api/v1/files/ws/files")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_file_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in active_file_connections:
            active_file_connections.remove(websocket)

@app.websocket("/api/v1/files/ws/project/{project_id}")
async def project_websocket_endpoint(websocket: WebSocket, project_id: str):
    await websocket.accept()
    # For now, just add to the main connections list
    active_file_connections.append(websocket)
    
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in active_file_connections:
            active_file_connections.remove(websocket)


# --- Root Endpoint ---
@app.get("/")
async def root():
    """Root endpoint with system info."""
    return {"message": "W.I.T. Terminal API is running."}

# --- Main Execution ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)