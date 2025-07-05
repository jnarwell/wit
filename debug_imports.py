#!/usr/bin/env python3
"""
Debug W.I.T. Import Issues

This script helps identify why imports are failing.
"""

import os
import sys
from pathlib import Path

# Colors
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    END = '\033[0m'

print(f"{Colors.BLUE}🔍 W.I.T. Import Debugger{Colors.END}")
print("=" * 60)

# Check current directory
print(f"\n{Colors.YELLOW}📁 Current Directory:{Colors.END}")
print(f"   {os.getcwd()}")

# Check Python path
print(f"\n{Colors.YELLOW}🐍 Python Path:{Colors.END}")
for p in sys.path[:5]:  # First 5 entries
    print(f"   {p}")

# Check file existence
print(f"\n{Colors.YELLOW}📄 Checking Required Files:{Colors.END}")

files_to_check = [
    "software/backend/api/voice_api.py",
    "software/backend/api/memory_voice_api.py",
    "software/ai/voice/claude_voice_processor.py",
    "software/ai/voice/memory/memory_system.py",
    "software/ai/voice/memory/memory_voice_processor.py",
    "memory_server.py",
    "dev_server.py"
]

missing_files = []
for file in files_to_check:
    if Path(file).exists():
        size = Path(file).stat().st_size
        if size < 100:  # Likely a placeholder
            print(f"{Colors.YELLOW}⚠️  {file} (only {size} bytes - might be placeholder){Colors.END}")
        else:
            print(f"{Colors.GREEN}✅ {file} ({size} bytes){Colors.END}")
    else:
        print(f"{Colors.RED}❌ {file} - NOT FOUND{Colors.END}")
        missing_files.append(file)

# Check imports
print(f"\n{Colors.YELLOW}🔧 Testing Imports:{Colors.END}")

# Add current directory to path
sys.path.insert(0, os.getcwd())

# Test imports
imports_to_test = [
    ("software.backend.api.voice_api", "voice_api"),
    ("software.backend.api.memory_voice_api", "memory_voice_api"),
    ("software.ai.voice.claude_voice_processor", "claude_voice_processor"),
    ("software.ai.voice.memory.memory_system", "memory_system"),
    ("software.ai.voice.memory.memory_voice_processor", "memory_voice_processor"),
]

failed_imports = []
for module_path, module_name in imports_to_test:
    try:
        module = __import__(module_path, fromlist=[module_name])
        print(f"{Colors.GREEN}✅ Can import: {module_path}{Colors.END}")
    except ImportError as e:
        print(f"{Colors.RED}❌ Cannot import: {module_path}{Colors.END}")
        print(f"   Error: {e}")
        failed_imports.append((module_path, str(e)))

# Check __init__.py files
print(f"\n{Colors.YELLOW}📦 Checking __init__.py files:{Colors.END}")

init_files = [
    "software/__init__.py",
    "software/backend/__init__.py",
    "software/backend/api/__init__.py",
    "software/ai/__init__.py",
    "software/ai/voice/__init__.py",
    "software/ai/voice/memory/__init__.py",
]

for init_file in init_files:
    if Path(init_file).exists():
        print(f"{Colors.GREEN}✅ {init_file}{Colors.END}")
    else:
        print(f"{Colors.YELLOW}⚠️  {init_file} - Missing (creating it){Colors.END}")
        # Create the __init__.py file
        Path(init_file).parent.mkdir(parents=True, exist_ok=True)
        Path(init_file).touch()

# Diagnosis
print(f"\n{Colors.BLUE}💊 Diagnosis:{Colors.END}")

if missing_files:
    print(f"{Colors.RED}Missing files:{Colors.END}")
    for f in missing_files:
        print(f"   - {f}")
        
if failed_imports:
    print(f"\n{Colors.RED}Import failures:{Colors.END}")
    for module, error in failed_imports:
        print(f"   - {module}: {error}")

# Solution
print(f"\n{Colors.BLUE}💡 Solution:{Colors.END}")

if not Path("software/__init__.py").exists():
    print("1. Creating missing __init__.py files...")
    # Create all __init__.py files
    for init_file in init_files:
        Path(init_file).parent.mkdir(parents=True, exist_ok=True)
        Path(init_file).touch()
    print("   ✅ Created __init__.py files")

print("\n2. Try running the server with explicit path:")
print(f"   {Colors.YELLOW}PYTHONPATH=. python3 memory_server.py{Colors.END}")

print("\n3. Or modify memory_server.py to add path at the top:")
print("   import sys")
print("   sys.path.insert(0, '.')")

# Create a fixed server file
print(f"\n{Colors.BLUE}🔧 Creating fixed server file...{Colors.END}")

fixed_server_content = '''#!/usr/bin/env python3
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
        
    print("\\n🚀 Starting W.I.T. with Memory System...")
    print("📚 API docs: http://localhost:8000/docs\\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
'''

with open("memory_server_fixed.py", "w") as f:
    f.write(fixed_server_content)
os.chmod("memory_server_fixed.py", 0o755)

print(f"{Colors.GREEN}✅ Created memory_server_fixed.py{Colors.END}")
print(f"\n{Colors.YELLOW}Try running:{Colors.END}")
print(f"   python3 memory_server_fixed.py")