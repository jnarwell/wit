#!/usr/bin/env python3
"""
W.I.T. Development Server
Quick server to test the voice API (without memory)
"""

import os
import sys
from pathlib import Path

# Add project to path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Import the voice API router
try:
    from software.backend.api.voice_api import router as voice_router
except ImportError:
    print("Could not import voice API")
    sys.exit(1)

# Create FastAPI app
app = FastAPI(
    title="W.I.T. Voice API",
    description="Workshop Integrated Terminal - Voice Processing API",
    version="0.1.0"
)

# Add CORS middleware for web testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include voice router
app.include_router(voice_router)

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "W.I.T. Voice API",
        "status": "running",
        "endpoints": {
            "status": "/api/v1/voice/status",
            "test": "/api/v1/voice/test",
            "docs": "/docs"
        }
    }

if __name__ == "__main__":
    # Load .env if exists
    if Path(".env").exists():
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except ImportError:
            pass
    
    # Check API key
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("⚠️  Warning: ANTHROPIC_API_KEY not set!")
        print("Set it with: export ANTHROPIC_API_KEY='your-key'")
    
    # Run server
    print("🚀 Starting W.I.T. Voice API server...")
    print("📚 API docs: http://localhost:8000/docs")
    
    try:
        # Use the app object directly to avoid the reload issue
        uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
    except KeyboardInterrupt:
        print("\n👋 Server stopped")