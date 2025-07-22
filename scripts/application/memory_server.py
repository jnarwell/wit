#!/usr/bin/env python3
"""
W.I.T. Development Server with Memory System
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Import both APIs
try:
    from software.backend.api.voice_api import router as voice_router
    from software.backend.api.memory_voice_api import router as memory_router
except ImportError:
    print("Could not import API routers")
    sys.exit(1)

# Create app
app = FastAPI(
    title="W.I.T. Voice & Memory API",
    description="Workshop Integrated Terminal with User Memory",
    version="0.2.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(voice_router)  # Original at /api/v1/voice
app.include_router(memory_router)  # Memory at /api/v1/memory

@app.get("/")
async def root():
    return {
        "message": "W.I.T. API with Memory System",
        "endpoints": {
            "voice": {
                "status": "/api/v1/voice/status",
                "test": "/api/v1/voice/test"
            },
            "memory": {
                "register": "/api/v1/memory/register",
                "command": "/api/v1/memory/command",
                "profile": "/api/v1/memory/profile",
                "test": "/api/v1/memory/test"
            },
            "docs": "/docs"
        }
    }

if __name__ == "__main__":
    if Path(".env").exists():
        from dotenv import load_dotenv
        load_dotenv()
        
    print("🚀 Starting W.I.T. with Memory System...")
    print("📚 API docs: http://localhost:8000/docs")
    
    uvicorn.run("memory_server:app", host="0.0.0.0", port=8000, reload=True)
