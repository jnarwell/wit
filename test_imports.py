#!/usr/bin/env python3
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

print("\nImport test complete!")
