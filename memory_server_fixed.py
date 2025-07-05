#!/usr/bin/env python3
"""
W.I.T. Development Server with Memory System - Fixed Imports
"""

import os
import sys
from pathlib import Path

# Fix imports by adding current directory to path
sys.path.insert(0, os.getcwd())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Debug imports
print("Current directory:", os.getcwd())
print("Python path:", sys.path[:3])

try:
    # Try importing with full path
    from software.backend.api.voice_api import router as voice_router
    print("✅ Imported voice_api")
except ImportError as e:
    print(f"❌ Could not import voice_api: {e}")
    voice_router = None

try:
    from software.backend.api.memory_voice_api import router as memory_router
    print("✅ Imported memory_voice_api")
except ImportError as e:
    print(f"❌ Could not import memory_voice_api: {e}")
    memory_router = None

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

# Include routers if available
if voice_router:
    app.include_router(voice_router)
    print("✅ Added voice router")
else:
    print("⚠️  Voice router not available")

if memory_router:
    app.include_router(memory_router)
    print("✅ Added memory router")
else:
    print("⚠️  Memory router not available")

@app.get("/")
async def root():
    return {
        "message": "W.I.T. API with Memory System",
        "voice_api": "available" if voice_router else "not loaded",
        "memory_api": "available" if memory_router else "not loaded",
        "docs": "/docs"
    }

if __name__ == "__main__":
    if Path(".env").exists():
        try:
            from dotenv import load_dotenv
            load_dotenv()
            print("✅ Loaded .env file")
        except ImportError:
            print("⚠️  python-dotenv not installed")
    
    # Check API key
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("⚠️  ANTHROPIC_API_KEY not set!")
        
    print("\n🚀 Starting W.I.T. with Memory System...")
    print("📚 API docs: http://localhost:8000/docs\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
