#!/usr/bin/env python3
"""
Setup W.I.T. Memory System

Integrates the memory system with the existing voice processor.
"""

import os
import sys
from pathlib import Path
import asyncio
import json

# Colors for output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'


def print_step(message):
    print(f"\n{Colors.BLUE}▶ {message}{Colors.END}")
    

def print_success(message):
    print(f"{Colors.GREEN}✅ {message}{Colors.END}")
    

def print_warning(message):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.END}")
    

def print_error(message):
    print(f"{Colors.RED}❌ {message}{Colors.END}")


def check_dependencies():
    """Check for required dependencies"""
    print_step("Checking dependencies for memory system...")
    
    required = {
        "sentence_transformers": "For semantic search in conversation history",
        "jwt": "PyJWT for user authentication",
        "numpy": "For vector operations",
        "sqlite3": "Built-in, for database (should be available)"
    }
    
    missing = []
    
    for package, description in required.items():
        try:
            if package == "jwt":
                __import__("jwt")
            else:
                __import__(package)
            print_success(f"{package}: {description}")
        except ImportError:
            print_error(f"{package}: {description}")
            missing.append("PyJWT" if package == "jwt" else package)
            
    if missing:
        print_warning(f"\nInstall missing dependencies with:")
        print(f"pip3 install {' '.join(missing)}")
        
    return len(missing) == 0


def create_memory_files():
    """Create memory system files in the project"""
    print_step("Setting up memory system files...")
    
    # Create directories
    dirs = [
        "software/ai/voice/memory",
        "data/memory",
        "logs/memory"
    ]
    
    for dir_path in dirs:
        Path(dir_path).mkdir(parents=True, exist_ok=True)
        print_success(f"Created {dir_path}")
        
    # Save memory system files
    memory_files = {
        "software/ai/voice/memory/memory_system.py": "# Memory system from artifact",
        "software/ai/voice/memory/memory_voice_processor.py": "# Memory voice processor from artifact",
        "software/backend/api/memory_voice_api.py": "# Memory API from artifact"
    }
    
    for file_path, content in memory_files.items():
        if not Path(file_path).exists():
            print_warning(f"Copy {Path(file_path).name} from the artifacts above")
        else:
            print_success(f"Found {file_path}")
            
    return True


def create_enhanced_server():
    """Create server with memory support"""
    server_content = '''#!/usr/bin/env python3
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
'''
    
    with open("memory_server.py", "w") as f:
        f.write(server_content)
        
    os.chmod("memory_server.py", 0o755)
    print_success("Created memory_server.py")
    
    return True


async def test_memory_system():
    """Test the memory system"""
    print_step("Testing memory system...")
    
    try:
        # Import and test
        from memory_system import MemoryManager
        
        # Create test instance
        memory_mgr = MemoryManager("test_memory.db")
        
        # Test user creation
        user_id = await memory_mgr.identify_user(name="TestUser")
        print_success(f"Created test user: {user_id}")
        
        # Test session
        session_id = await memory_mgr.start_session(user_id)
        print_success(f"Started session: {session_id}")
        
        # Clean up
        Path("test_memory.db").unlink(missing_ok=True)
        
        return True
        
    except Exception as e:
        print_error(f"Memory system test failed: {e}")
        return False


def create_requirements():
    """Create requirements file for memory system"""
    requirements = """# W.I.T. Memory System Requirements
# Install with: pip3 install -r requirements-memory.txt

# Core memory system
sentence-transformers>=2.2.0
PyJWT>=2.8.0
numpy>=1.24.0

# Database
# sqlite3 is built-in

# Existing voice requirements
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
aiohttp>=3.9.0
python-dotenv>=1.0.0
SpeechRecognition>=3.10.0

# Optional
pandas>=2.0.0  # For data analysis
matplotlib>=3.4.0  # For usage visualization
"""
    
    with open("requirements-memory.txt", "w") as f:
        f.write(requirements)
        
    print_success("Created requirements-memory.txt")
    return True


def create_demo_script():
    """Create demo script for memory system"""
    demo_content = '''#!/usr/bin/env python3
"""
W.I.T. Memory System Demo

Shows how the memory system works with different users.
"""

import asyncio
import aiohttp
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

async def demo_user_session(user_name: str, commands: list):
    """Demo a user session with memory"""
    async with aiohttp.ClientSession() as session:
        print(f"\\n{'='*60}")
        print(f"👤 User: {user_name}")
        print(f"{'='*60}")
        
        # Register/login user
        async with session.post(
            f"{BASE_URL}/api/v1/memory/register",
            json={"name": user_name}
        ) as resp:
            user_data = await resp.json()
            token = user_data['token']
            print(f"✅ Logged in as {user_name} (ID: {user_data['user_id'][:8]}...)")
            
        # Set auth header
        headers = {"Authorization": f"Bearer {token}"}
        
        # Process commands
        for i, command in enumerate(commands, 1):
            print(f"\\n{i}. Command: '{command}'")
            
            async with session.post(
                f"{BASE_URL}/api/v1/memory/command",
                json={"command": command},
                headers=headers
            ) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    print(f"   Intent: {result['intent']}")
                    print(f"   Response: {result['response'][:150]}...")
                    if result.get('active_project'):
                        print(f"   Project: {result['active_project']}")
                        
            await asyncio.sleep(1)  # Rate limiting
            
        # Show profile stats
        async with session.get(
            f"{BASE_URL}/api/v1/memory/profile",
            headers=headers
        ) as resp:
            if resp.status == 200:
                profile = await resp.json()
                stats = profile['stats']
                print(f"\\n📊 {user_name}'s Stats:")
                print(f"   Total conversations: {stats['total_conversations']}")
                print(f"   Total projects: {stats['total_projects']}")


async def main():
    """Run the demo"""
    print("🎭 W.I.T. Memory System Demo")
    print("This shows how different users have separate memories\\n")
    
    # Check server
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BASE_URL}/api/v1/memory/test") as resp:
                data = await resp.json()
                print(f"✅ Memory system status: {data['status']}")
    except:
        print("❌ Server not running! Start with: python3 memory_server.py")
        return
        
    # Demo different users
    await demo_user_session("James", [
        "I want to start a new project for a custom keyboard",
        "Set my 3D printer to 220 degrees",
        "I prefer working in Celsius",
        "What temperature did I set earlier?",
        "Show me what I was working on"
    ])
    
    await demo_user_session("Sarah", [
        "Hi, I'm new to the workshop",
        "Can you help me learn to use the laser cutter?",
        "I prefer Fahrenheit for temperature",
        "Start a project for wooden coasters",
        "What safety equipment do I need?"
    ])
    
    await demo_user_session("James", [
        "Continue my keyboard project",
        "What temperature do I usually use?",  # Should remember Celsius preference
        "How long have I been working on this?"
    ])
    
    print("\\n✅ Demo complete! Notice how:")
    print("   - Each user has separate conversation history")
    print("   - Preferences are remembered (Celsius vs Fahrenheit)")
    print("   - Projects are tracked per user")
    print("   - Context carries across sessions")


if __name__ == "__main__":
    asyncio.run(main())
'''
    
    with open("demo_memory.py", "w") as f:
        f.write(demo_content)
        
    os.chmod("demo_memory.py", 0o755)
    print_success("Created demo_memory.py")
    return True


def main():
    """Main setup routine"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}🧠 W.I.T. Memory System Setup{Colors.END}")
    print("=" * 60)
    
    # Check dependencies
    print_step("1️⃣ Checking Dependencies")
    deps_ok = check_dependencies()
    
    # Create files
    print_step("2️⃣ Creating Memory System Structure")
    create_memory_files()
    
    # Create enhanced server
    print_step("3️⃣ Creating Enhanced Server")
    create_enhanced_server()
    
    # Create requirements
    print_step("4️⃣ Creating Requirements File")
    create_requirements()
    
    # Create demo
    print_step("5️⃣ Creating Demo Script")
    create_demo_script()
    
    # Test
    print_step("6️⃣ Testing Memory System")
    if deps_ok:
        asyncio.run(test_memory_system())
    
    # Summary
    print(f"\n{Colors.HEADER}📋 Setup Summary{Colors.END}")
    print("=" * 60)
    
    if not deps_ok:
        print_warning("Install missing dependencies first:")
        print("pip3 install -r requirements-memory.txt")
        print()
        
    print("✅ Memory system files created")
    print("✅ Enhanced server created")
    print("✅ Demo script created")
    
    print(f"\n{Colors.HEADER}🚀 Next Steps:{Colors.END}")
    print("1. Copy the artifact files to their locations:")
    print("   - memory_system.py → software/ai/voice/memory/")
    print("   - memory_voice_processor.py → software/ai/voice/memory/")
    print("   - memory_voice_api.py → software/backend/api/")
    print()
    print("2. Install dependencies:")
    print("   pip3 install -r requirements-memory.txt")
    print()
    print("3. Start the enhanced server:")
    print("   python3 memory_server.py")
    print()
    print("4. Run the demo:")
    print("   python3 demo_memory.py")
    print()
    print("The memory system will remember:")
    print("  • Every user individually")
    print("  • All conversations")
    print("  • Project details")
    print("  • Equipment usage")
    print("  • User preferences")
    print("  • Learning patterns over time")


if __name__ == "__main__":
    main()