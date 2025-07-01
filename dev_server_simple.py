#!/usr/bin/env python3
"""
Simple development server for W.I.T. - No external dependencies required
"""
import os
import sys
from pathlib import Path

# Add project to path
project_root = Path(__file__).resolve()
sys.path.insert(0, str(project_root))

# Set up minimal logging
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import FastAPI and create a minimal app
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
import uvicorn

# Create the app
app = FastAPI(
    title="W.I.T. Terminal API - Dev Mode",
    description="Workspace Integrated Terminal Development Server",
    version="1.0.0"
)

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Redirect to API docs"""
    return RedirectResponse(url="/docs")

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "mode": "development"}

# Try to import and mount the main app routes
try:
    from software.backend.api.voice_api import router as voice_router
    app.include_router(voice_router, prefix="/api/voice", tags=["voice"])
    logger.info("Voice API mounted")
except Exception as e:
    logger.warning(f"Could not mount voice API: {e}")

try:
    from software.backend.api.vision_api import router as vision_router
    app.include_router(vision_router, prefix="/api/vision", tags=["vision"])
    logger.info("Vision API mounted")
except Exception as e:
    logger.warning(f"Could not mount vision API: {e}")

if __name__ == "__main__":
    print("\n🚀 W.I.T. Simple Development Server")
    print("=" * 50)
    print("✅ No database required")
    print("✅ No MQTT required")
    print("✅ Basic endpoints available")
    print("\n📍 API URL: http://localhost:8000")
    print("📚 API Docs: http://localhost:8000/docs")
    print("=" * 50 + "\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
