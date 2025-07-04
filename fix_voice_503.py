#!/usr/bin/env python3
"""
Quick fix for the 503 Voice Processor error
Run this from your project root directory
"""

import os
import shutil
from pathlib import Path

print("🔧 W.I.T. Voice System 503 Error Fix")
print("=" * 50)

# Create all necessary directories
dirs_to_create = [
    "software/ai/voice",
    "software/config",
    "scripts"
]

for dir_path in dirs_to_create:
    Path(dir_path).mkdir(parents=True, exist_ok=True)
    print(f"✅ Created directory: {dir_path}")

# Create __init__.py files
init_files = [
    "software/__init__.py",
    "software/ai/__init__.py",
    "software/ai/voice/__init__.py",
    "software/backend/__init__.py",
    "software/backend/api/__init__.py"
]

for init_file in init_files:
    Path(init_file).touch()
    print(f"✅ Created {init_file}")

# Check if the full voice processor exists
full_processor = Path("software/ai/voice/claude_voice_processor.py")
mock_processor = Path("software/ai/voice/mock_voice_processor.py")

if not full_processor.exists() and not mock_processor.exists():
    print("\n⚠️  No voice processor found!")
    print("📝 Creating a temporary mock processor...")
    
    # Create a minimal mock processor
    mock_content = '''"""Minimal mock voice processor to fix 503 error"""
from datetime import datetime
from typing import Dict, Any, Optional

class VoiceState:
    IDLE = "idle"
    LISTENING = "listening"

class ProcessingConfig:
    def __init__(self, **kwargs):
        self.anthropic_api_key = kwargs.get("anthropic_api_key", "")
        self.claude_model = kwargs.get("claude_model", "claude-3-sonnet-20240229")

class VoiceCommand:
    def __init__(self, **kwargs):
        self.text = kwargs.get("text", "")
        self.intent = kwargs.get("intent", "unknown")
        self.entities = kwargs.get("entities", {})
        self.confidence = kwargs.get("confidence", 0.0)
        self.timestamp = kwargs.get("timestamp", datetime.now())
        self.claude_response = kwargs.get("claude_response", "")

class ClaudeVoiceProcessor:
    def __init__(self, config):
        self.config = config
        self.state = VoiceState.IDLE
        self.stats = {"state": "idle", "commands_processed": 0, "api_calls": 0, "errors": 0}
    
    async def start(self):
        self.state = VoiceState.LISTENING
        
    async def stop(self):
        self.state = VoiceState.IDLE
        
    def get_statistics(self):
        return self.stats
        
    async def transcribe_audio(self, audio):
        return "mock transcription"
        
    async def understand_with_claude(self, text, context=None):
        return VoiceCommand(
            text=text,
            intent="control_equipment" if "start" in text.lower() else "unknown",
            entities={"equipment": "3d_printer"} if "printer" in text.lower() else {},
            confidence=0.8,
            claude_response="Mock response: Command received"
        )
        
    async def process_audio_chunk(self, chunk, timestamp):
        pass

class WorkshopVoiceAssistant:
    def __init__(self, processor):
        self.processor = processor
'''
    
    # Save as claude_voice_processor.py
    with open(full_processor, 'w') as f:
        f.write(mock_content)
    print(f"✅ Created mock processor at: {full_processor}")

# Create a test script
test_script = Path("test_voice_api.py")
test_content = '''#!/usr/bin/env python3
"""Test if the voice API is working"""
import requests

# Test the voice API
url = "http://localhost:8000/api/v1/voice/test"
try:
    response = requests.get(url)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
    print("Make sure the server is running: python3 dev_server.py")
'''

with open(test_script, 'w') as f:
    f.write(test_content)
print(f"\n✅ Created test script: {test_script}")

print("\n" + "=" * 50)
print("✅ FIX COMPLETE!")
print("=" * 50)
print("\n🚀 Next steps:")
print("1. Restart your backend server:")
print("   python3 dev_server.py")
print("\n2. Test the API:")
print("   python3 test_voice_api.py")
print("\n3. Or visit in browser:")
print("   http://localhost:8000/api/v1/voice/test")
print("\n📝 Note: This is a mock implementation.")
print("To enable full Claude AI integration:")
print("- Copy the full claude_voice_processor.py from the artifact")
print("- Set ANTHROPIC_API_KEY environment variable")
print("- Install: pip install aiohttp speech_recognition")