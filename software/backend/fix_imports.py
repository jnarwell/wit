#!/usr/bin/env python3
"""
Fix imports and dependencies for SQLite mode

File: software/backend/fix_imports.py
"""

import os
import sys
import subprocess

def main():
    print("=== Fixing imports and dependencies ===\n")
    
    # First, ensure we have pip
    try:
        import pip
    except ImportError:
        print("Installing pip...")
        subprocess.check_call([sys.executable, "-m", "ensurepip"])
    
    # Install critical dependencies one by one
    critical_deps = [
        "pydantic==2.5.0",
        "pydantic-settings==2.1.0",
        "python-dotenv==1.0.0",
        "sqlalchemy==2.0.23",
        "aiosqlite==0.19.0"
    ]
    
    for dep in critical_deps:
        print(f"Installing {dep}...")
        try:
            subprocess.check_call([
                sys.executable, "-m", "pip", "install", dep
            ])
            print(f"✓ {dep} installed successfully")
        except subprocess.CalledProcessError as e:
            print(f"✗ Failed to install {dep}: {e}")
    
    # Create a minimal config.py if needed
    if not os.path.exists("config.py"):
        print("\nCreating minimal config.py...")
        with open("config.py", "w") as f:
            f.write('''"""
Minimal W.I.T. Configuration for SQLite
"""
import os
from pathlib import Path

class Settings:
    # Application
    APP_NAME = "W.I.T. Terminal"
    APP_VERSION = "0.1.0"
    DEBUG = True
    
    # API
    API_V1_STR = "/api/v1"
    PROJECT_NAME = "W.I.T. Terminal API"
    
    # Security
    SECRET_KEY = os.getenv("WIT_SECRET_KEY", "change-this-secret-key")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-jwt-secret")
    JWT_ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
    
    # Database - SQLite
    DATABASE_URL = f"sqlite:///{Path(__file__).parent}/data/wit_local.db"
    STORAGE_MODE = "local"
    
    # File Storage
    FILE_STORAGE_PATH = "storage/files"
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    
    # CORS
    BACKEND_CORS_ORIGINS = ["http://localhost:3000", "http://localhost:5173"]

settings = Settings()
''')
        print("✓ Created minimal config.py")
    
    # Create necessary __init__.py files
    dirs_needing_init = ["auth", "models", "services", "routers", "schemas"]
    for dir_name in dirs_needing_init:
        os.makedirs(dir_name, exist_ok=True)
        init_file = os.path.join(dir_name, "__init__.py")
        if not os.path.exists(init_file):
            with open(init_file, "w") as f:
                f.write("")
            print(f"✓ Created {init_file}")
    
    print("\n✓ Import fixes completed!")
    print("\nNow run:")
    print("  chmod +x quick_setup_sqlite.sh")
    print("  ./quick_setup_sqlite.sh")

if __name__ == "__main__":
    main()