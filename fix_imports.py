#!/usr/bin/env python3
"""
Fix import paths in W.I.T. memory files

This script updates the import statements to use correct paths.
"""

import re
from pathlib import Path

# Colors
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

print(f"{Colors.BLUE}🔧 Fixing Import Paths in W.I.T. Files{Colors.END}")
print("=" * 60)

# Define the fixes needed
import_fixes = [
    {
        'file': 'software/backend/api/memory_voice_api.py',
        'replacements': [
            (
                r'from memory_voice_processor import',
                'from software.ai.voice.memory.memory_voice_processor import'
            ),
            (
                r'from memory_system import',
                'from software.ai.voice.memory.memory_system import'
            )
        ]
    },
    {
        'file': 'software/ai/voice/memory/memory_voice_processor.py',
        'replacements': [
            (
                r'from claude_voice_processor import',
                'from software.ai.voice.claude_voice_processor import'
            ),
            (
                r'from memory_system import',
                'from software.ai.voice.memory.memory_system import'
            ),
            # Also fix relative import
            (
                r'from \.memory_system import',
                'from software.ai.voice.memory.memory_system import'
            )
        ]
    }
]

# Apply fixes
for fix_info in import_fixes:
    filepath = Path(fix_info['file'])
    
    if not filepath.exists():
        print(f"{Colors.YELLOW}⚠️  {filepath} not found{Colors.END}")
        continue
        
    print(f"\n{Colors.YELLOW}📄 Fixing {filepath}{Colors.END}")
    
    # Read the file
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Apply replacements
    original_content = content
    for old_import, new_import in fix_info['replacements']:
        if re.search(old_import, content):
            content = re.sub(old_import, new_import, content)
            print(f"  ✅ Fixed: {old_import[:30]}... → {new_import[:30]}...")
    
    # Write back if changed
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"  {Colors.GREEN}✅ File updated{Colors.END}")
    else:
        print(f"  {Colors.BLUE}ℹ️  No changes needed{Colors.END}")

# Also create a simple test script
print(f"\n{Colors.BLUE}Creating test script...{Colors.END}")

test_content = '''#!/usr/bin/env python3
"""Test imports after fixing"""

import sys
import os
sys.path.insert(0, os.getcwd())

print("Testing fixed imports...")

try:
    from software.backend.api.memory_voice_api import router as memory_router
    print("✅ Successfully imported memory_voice_api")
except ImportError as e:
    print(f"❌ Failed to import memory_voice_api: {e}")

try:
    from software.ai.voice.memory.memory_voice_processor import MemoryEnabledVoiceProcessor
    print("✅ Successfully imported MemoryEnabledVoiceProcessor")
except ImportError as e:
    print(f"❌ Failed to import MemoryEnabledVoiceProcessor: {e}")

print("\\nImport test complete!")
'''

with open('test_imports.py', 'w') as f:
    f.write(test_content)
os.chmod('test_imports.py', 0o755)

print(f"{Colors.GREEN}✅ Created test_imports.py{Colors.END}")

# Create a working server that handles imports correctly
print(f"\n{Colors.BLUE}Creating final working server...{Colors.END}")

final_server_content = '''#!/usr/bin/env python3
"""
W.I.T. Server with Correct Imports
"""

import os
import sys
from pathlib import Path

# Ensure we can import from project root
sys.path.insert(0, os.getcwd())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Create app first
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
try:
    from software.backend.api.voice_api import router as voice_router
    app.include_router(voice_router)
    print("✅ Voice API loaded")
except ImportError as e:
    print(f"⚠️  Voice API not loaded: {e}")
    voice_router = None

try:
    from software.backend.api.memory_voice_api import router as memory_router
    app.include_router(memory_router)
    print("✅ Memory API loaded")
except ImportError as e:
    print(f"⚠️  Memory API not loaded: {e}")
    memory_router = None

@app.get("/")
async def root():
    return {
        "message": "W.I.T. API Server",
        "status": "running",
        "apis": {
            "voice": {
                "status": "loaded" if voice_router else "not loaded",
                "endpoints": ["/api/v1/voice/status", "/api/v1/voice/test"]
            },
            "memory": {
                "status": "loaded" if memory_router else "not loaded", 
                "endpoints": ["/api/v1/memory/register", "/api/v1/memory/test"]
            }
        },
        "docs": "/docs"
    }

if __name__ == "__main__":
    # Load environment
    if Path(".env").exists():
        try:
            from dotenv import load_dotenv
            load_dotenv()
            print("✅ Environment loaded")
        except ImportError:
            print("⚠️  python-dotenv not installed")
    
    # Check critical settings
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("\\n⚠️  WARNING: ANTHROPIC_API_KEY not set in environment!")
        print("   Set it in .env file or export ANTHROPIC_API_KEY='your-key'")
    
    print("\\n🚀 Starting W.I.T. Server...")
    print("📚 API Documentation: http://localhost:8000/docs")
    print("🔍 API Status: http://localhost:8000/")
    print("\\nPress CTRL+C to stop\\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
'''

with open('wit_server.py', 'w') as f:
    f.write(final_server_content)
os.chmod('wit_server.py', 0o755)

print(f"{Colors.GREEN}✅ Created wit_server.py{Colors.END}")

print(f"\n{Colors.GREEN}{'='*60}{Colors.END}")
print(f"{Colors.GREEN}✅ Import fixes complete!{Colors.END}")
print(f"{Colors.GREEN}{'='*60}{Colors.END}")

print(f"\n{Colors.BLUE}Next steps:{Colors.END}")
print("1. Test the fixes:")
print(f"   {Colors.YELLOW}python3 test_imports.py{Colors.END}")
print("\n2. Run the server:")
print(f"   {Colors.YELLOW}python3 wit_server.py{Colors.END}")
print("\n3. Check the APIs:")
print("   - http://localhost:8000/ (status)")
print("   - http://localhost:8000/docs (interactive docs)")
print("   - http://localhost:8000/api/v1/voice/test")
print("   - http://localhost:8000/api/v1/memory/test")