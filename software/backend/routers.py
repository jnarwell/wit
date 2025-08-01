"""
Router imports for W.I.T. Backend
This module centralizes all router imports for the dev server
"""

from fastapi import APIRouter

# Import API routers from the api directory
from api.equipment_api_simple import router as equipment_router
from api.voice_api import router as voice_router
from api.vision_api import router as vision_router
from api.workspace_api import router as workspace_router
from api.system_api import router as system_router
from api.network_api import router as network_router
from api.accounts_api_simple import router as accounts_router
from api.files_api_simple import router as files_router
from api.admin_api import router as admin_router
from api.terminal_api import router as terminal_router
from api.projects_api import router as projects_router
from api.ai_config_api import router as ai_config_router

# Import the auth router with email verification from frontend
# We'll create a proper backend auth router
from auth.auth_router import router as auth_router

# Create placeholder routers for missing ones
projects = projects_router  # Use the actual projects router
tasks = APIRouter()
teams = APIRouter()
materials = APIRouter()
# files router is now imported from files_api

# Add basic endpoints to placeholder routers
@projects.get("/")
async def list_projects():
    return []

@tasks.get("/")
async def list_tasks():
    return {"tasks": []}

@teams.get("/")
async def list_teams():
    return {"teams": []}

@materials.get("/")
async def list_materials():
    return {"materials": []}

# files endpoints are now in files_api

# Export all routers
__all__ = [
    "projects",
    "tasks",
    "teams",
    "materials",
    "files_router",
    "auth_router",
    "voice_router",
    "vision_router",
    "equipment_router",
    "workspace_router",
    "system_router",
    "network_router",
    "accounts_router",
    "admin_router",
    "terminal_router",
    "ai_config_router"
]