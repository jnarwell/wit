#!/usr/bin/env python3
"""
W.I.T. Voice System Setup and Test

This script helps set up and test the Claude-powered voice system.
"""

import os
import sys
import asyncio
import json
from pathlib import Path

# Add project to path
project_root = Path(__file__).parent
if project_root.name == 'scripts':
    project_root = project_root.parent
sys.path.insert(0, str(project_root))


def check_dependencies():
    """Check if required dependencies are installed"""
    dependencies = {
        "fastapi": "FastAPI web framework",
        "aiohttp": "Async HTTP client for Claude API",
        "speech_recognition": "Speech recognition (optional but recommended)",
        "pyaudio": "Audio I/O (optional, for microphone)"
    }
    
    missing = []
    for package, description in dependencies.items():
        try:
            __import__(package.replace("-", "_"))
            print(f"✅ {package}: {description}")
        except ImportError:
            print(f"❌ {package}: {description}")
            missing.append(package)
    
    if missing:
        print(f"\n⚠️  Missing dependencies. Install with:")
        print(f"pip install {' '.join(missing)}")
        
    return len(missing) == 0


def check_api_key():
    """Check if Anthropic API key is configured"""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    
    if api_key:
        print(f"✅ Anthropic API key configured (starts with {api_key[:8]}...)")
        return True
    else:
        print("❌ Anthropic API key not found")
        print("\nTo set your API key:")
        print("  export ANTHROPIC_API_KEY='your-key-here'")
        print("\nOr add to .env file:")
        print("  ANTHROPIC_API_KEY=your-key-here")
        return False


async def test_voice_processor():
    """Test the voice processor directly"""
    try:
        from software.ai.voice.claude_voice_processor import (
            ClaudeVoiceProcessor, ProcessingConfig, WorkshopVoiceAssistant
        )
    except ImportError:
        try:
            from claude_voice_processor import (
                ClaudeVoiceProcessor, ProcessingConfig, WorkshopVoiceAssistant
            )
        except ImportError:
            print("❌ Could not import voice processor")
            return False
    
    print("\n🧪 Testing Voice Processor...")
    
    # Create processor
    config = ProcessingConfig(
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", ""),
        claude_model="claude-3-sonnet-20240229"
    )
    
    processor = ClaudeVoiceProcessor(config)
    assistant = WorkshopVoiceAssistant(processor)
    
    await processor.start()
    
    # Test commands
    test_commands = [
        "Start the 3D printer",
        "What's the status of the laser cutter?",
        "Emergency stop all machines",
        "How do I level the print bed?"
    ]
    
    for cmd in test_commands:
        print(f"\n📢 Testing: '{cmd}'")
        
        try:
            command = await processor.understand_with_claude(cmd)
            
            print(f"  Intent: {command.intent}")
            print(f"  Entities: {json.dumps(command.entities, indent=2)}")
            print(f"  Confidence: {command.confidence:.2f}")
            if command.claude_response:
                print(f"  Response: {command.claude_response}")
                
        except Exception as e:
            print(f"  ❌ Error: {e}")
    
    await processor.stop()
    
    # Print stats
    stats = processor.get_statistics()
    print(f"\n📊 Statistics:")
    print(f"  Commands processed: {stats['commands_processed']}")
    print(f"  API calls: {stats['api_calls']}")
    print(f"  Errors: {stats['errors']}")
    
    return True


async def test_api_endpoints():
    """Test the API endpoints"""
    import aiohttp
    
    print("\n🌐 Testing API Endpoints...")
    
    base_url = "http://localhost:8000/api/v1/voice"
    
    async with aiohttp.ClientSession() as session:
        # Test health endpoint
        try:
            async with session.get(f"{base_url}/health") as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Health check: {data['status']}")
                else:
                    print(f"❌ Health check failed: {response.status}")
        except Exception as e:
            print(f"❌ Could not connect to API: {e}")
            print("   Make sure the server is running: python3 dev_server.py")
            return False
            
        # Test status endpoint
        try:
            async with session.get(f"{base_url}/status") as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Status: {data['state']}")
                    print(f"   API key configured: {data['api_key_configured']}")
        except Exception as e:
            print(f"⚠️  Status check error: {e}")
            
        # Test command endpoint
        try:
            async with session.post(
                f"{base_url}/command",
                json={
                    "text": "Start the 3D printer",
                    "context": {"test": True}
                }
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Command test successful")
                    print(f"   Intent: {data['intent']}")
                else:
                    print(f"⚠️  Command test returned: {response.status}")
        except Exception as e:
            print(f"⚠️  Command test error: {e}")
    
    return True


def setup_voice_files():
    """Create necessary voice system files"""
    print("\n📁 Setting up voice system files...")
    
    # Create directories
    dirs = [
        "software/ai/voice",
        "software/config",
        "logs"
    ]
    
    for dir_path in dirs:
        Path(dir_path).mkdir(parents=True, exist_ok=True)
        print(f"✅ Created {dir_path}")
    
    # Save the voice processor if it doesn't exist
    voice_processor_path = Path("software/ai/voice/claude_voice_processor.py")
    if not voice_processor_path.exists():
        print("⚠️  Voice processor file not found")
        print("   Copy the claude_voice_processor.py from the artifact")
    
    # Save config
    config_path = Path("software/config/voice_config.json")
    if not config_path.exists():
        print("⚠️  Voice config not found")
        print("   Copy the voice_config.json from the artifact")
    
    return True


async def main():
    """Main setup and test routine"""
    print("🎙️  W.I.T. Voice System Setup & Test")
    print("=" * 50)
    
    # Check dependencies
    print("\n1️⃣ Checking Dependencies...")
    deps_ok = check_dependencies()
    
    # Check API key
    print("\n2️⃣ Checking API Key...")
    api_key_ok = check_api_key()
    
    if not api_key_ok:
        print("\n⚠️  Cannot proceed without API key")
        return
    
    # Setup files
    print("\n3️⃣ Setting up files...")
    setup_voice_files()
    
    # Test processor
    print("\n4️⃣ Testing Voice Processor...")
    try:
        await test_voice_processor()
    except Exception as e:
        print(f"❌ Voice processor test failed: {e}")
    
    # Test API
    print("\n5️⃣ Testing API Endpoints...")
    try:
        await test_api_endpoints()
    except Exception as e:
        print(f"⚠️  API test skipped: {e}")
    
    print("\n" + "=" * 50)
    print("✅ Voice system setup complete!")
    print("\nNext steps:")
    print("1. Start the backend: python3 dev_server.py")
    print("2. Test the API: http://localhost:8000/api/v1/voice/test")
    print("3. Try voice commands via the API")
    
    if not deps_ok:
        print("\n⚠️  Remember to install missing dependencies!")


if __name__ == "__main__":
    asyncio.run(main())