#!/usr/bin/env python3
"""
W.I.T. Development Server - No Database Required
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Patch the main app to skip database and MQTT
from software.backend import main
from contextlib import asynccontextmanager
from fastapi import FastAPI
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Mock services
class MockDB:
    async def connect(self): logger.info("Mock DB connected")
    async def disconnect(self): pass
    async def create_tables(self): pass

class MockMQTT:
    async def connect(self): logger.info("Mock MQTT connected") 
    async def disconnect(self): pass

class MockEvents:
    async def publish_system_event(self, *args, **kwargs): pass

@asynccontextmanager
async def dev_lifespan(app: FastAPI):
    """Development lifespan without external dependencies"""
    logger.info("Starting W.I.T. Development Server (no external dependencies)...")
    
    # Set mock services
    app.state.db = MockDB()
    app.state.mqtt = MockMQTT()
    app.state.events = MockEvents()
    
    yield
    
    logger.info("Shutting down...")

# Replace the lifespan
main.app.router.lifespan_context = dev_lifespan

# Make app available for import
app = main.app

if __name__ == "__main__":
    import uvicorn
    print("\n🚀 W.I.T. Terminal API - Development Mode")
    print("=" * 50)
    print("✅ No database required")
    print("✅ No MQTT required") 
    print("✅ All endpoints available")
    print("\n📍 API URL: http://localhost:8000")
    print("📚 API Docs: http://localhost:8000/docs")
    print("=" * 50 + "\n")
    
    # Use string import for reload to work
    uvicorn.run("dev_server:app", host="0.0.0.0", port=8000, reload=True)
