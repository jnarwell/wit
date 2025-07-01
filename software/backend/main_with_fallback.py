"""
W.I.T. Backend with Fallback Imports
"""
import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

logger = logging.getLogger(__name__)

# Try to import routers, fall back to mocks if needed
try:
    from .api.voice_api import router as voice_router
    logger.info("Loaded full voice API")
except ImportError as e:
    logger.warning(f"Could not load voice API: {e}")
    from .api.voice_api_mock import router as voice_router
    logger.info("Using mock voice API")

# Import other routers that don't need AI
from .api.equipment_api import router as equipment_router
from .api.system_api import router as system_router

# Create app...
# (rest of the file)
