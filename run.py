#!/usr/bin/env python3
"""
W.I.T. API Server Launcher
"""
import os
import sys

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    import uvicorn
    
    # Set some default environment variables if not set
    # Use sqlite+aiosqlite for async SQLite support
    os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./wit.db")
    os.environ.setdefault("MQTT_HOST", "localhost")
    
    print("Starting W.I.T. Terminal API...")
    print("API docs will be available at: http://localhost:8000/docs")
    
    uvicorn.run(
        "software.backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
