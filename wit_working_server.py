#!/usr/bin/env python3
"""
W.I.T. Working Server - Fixed to Stay Running
"""

import os
import sys
from pathlib import Path

# Ensure we can import from project root
sys.path.insert(0, os.getcwd())

# Load environment first
if Path(".env").exists():
    try:
        from dotenv import load_dotenv
        load_dotenv()
        print("✅ Environment loaded")
    except ImportError:
        print("⚠️  python-dotenv not installed")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

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

# Import and include routers
voice_loaded = False
memory_loaded = False

try:
    from software.backend.api.voice_api import router as voice_router
    app.include_router(voice_router)
    voice_loaded = True
    print("✅ Voice API loaded")
except ImportError as e:
    print(f"⚠️  Voice API not loaded: {e}")

try:
    from software.backend.api.memory_voice_api import router as memory_router
    app.include_router(memory_router)
    memory_loaded = True
    print("✅ Memory API loaded")
except ImportError as e:
    print(f"⚠️  Memory API not loaded: {e}")

@app.get("/")
async def root():
    return {
        "message": "W.I.T. API Server",
        "status": "running",
        "apis": {
            "voice": {
                "status": "loaded" if voice_loaded else "not loaded",
                "endpoints": ["/api/v1/voice/status", "/api/v1/voice/test"] if voice_loaded else []
            },
            "memory": {
                "status": "loaded" if memory_loaded else "not loaded", 
                "endpoints": ["/api/v1/memory/register", "/api/v1/memory/test"] if memory_loaded else []
            }
        },
        "docs": "/docs"
    }

@app.get("/health")
async def health():
    return {"status": "healthy", "voice": voice_loaded, "memory": memory_loaded}

if __name__ == "__main__":
    # Check critical settings
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("\n⚠️  WARNING: ANTHROPIC_API_KEY not set in environment!")
        print("   Set it in .env file or export ANTHROPIC_API_KEY='your-key'")
    
    print("\n🚀 Starting W.I.T. Server...")
    print("📚 API Documentation: http://localhost:8000/docs")
    print("🔍 API Status: http://localhost:8000/")
    print("\nPress CTRL+C to stop\n")
    
    # Run with the app object directly - this should fix the immediate exit
    try:
        uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
    except KeyboardInterrupt:
        print("\n👋 Server stopped")