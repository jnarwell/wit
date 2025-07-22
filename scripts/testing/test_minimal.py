#!/usr/bin/env python3
"""
Minimal test to verify W.I.T. voice system structure

This requires NO external dependencies beyond Python standard library.
Run this first to check the basic project structure.
"""

import os
import sys
import json
from pathlib import Path

def check_file_structure():
    """Check if all key files exist"""
    print("Checking W.I.T. Voice System File Structure...\n")
    
    required_files = {
        "firmware/core/voice/voice_core.h": "Voice core header",
        "firmware/core/voice/voice_core.c": "Voice core implementation",
        "firmware/core/voice/wake_word.h": "Wake word detection",
        "firmware/drivers/audio/audio_driver.h": "Audio driver",
        "software/ai/voice/voice_processor.py": "Voice AI processor",
        "software/backend/api/voice_api.py": "Voice REST API",
        "software/config/voice_config.json": "Voice configuration",
        "tests/test_voice_system.py": "Voice system tests",
    }
    
    all_exist = True
    for file_path, description in required_files.items():
        path = Path(file_path)
        if path.exists():
            print(f"✓ {description}: {file_path}")
        else:
            print(f"✗ {description}: {file_path} - NOT FOUND")
            all_exist = False
    
    return all_exist

def check_config():
    """Check and display configuration"""
    print("\n\nChecking Voice Configuration...")
    
    config_path = Path("software/config/voice_config.json")
    if config_path.exists():
        with open(config_path) as f:
            config = json.load(f)
        
        print("✓ Configuration loaded successfully")
        print(f"  - Whisper model: {config['voice_processing']['model']['whisper_model_size']}")
        print(f"  - Sample rate: {config['voice_processing']['audio']['sample_rate']} Hz")
        print(f"  - Channels: {config['voice_processing']['audio']['channels']}")
        print(f"  - Wake words: {len(config['voice_processing']['wake_word']['models'])}")
        return True
    else:
        print("✗ Configuration file not found")
        return False

def test_basic_imports():
    """Test importing our modules (not external deps)"""
    print("\n\nTesting Basic Module Structure...")
    
    # Add project root to path
    project_root = Path(__file__).parent
    if project_root.name == 'tests':
        project_root = project_root.parent
    
    sys.path.insert(0, str(project_root))
    
    modules_to_test = [
        ("software.ai.voice.voice_processor", "Voice Processor"),
        ("software.backend.api.voice_api", "Voice API"),
    ]
    
    for module_name, description in modules_to_test:
        try:
            # Try importing without external dependencies
            parts = module_name.split('.')
            module_path = Path(project_root) / Path(*parts[:-1]) / f"{parts[-1]}.py"
            
            if module_path.exists():
                print(f"✓ {description} module exists: {module_path}")
                
                # Check for class/function definitions
                with open(module_path) as f:
                    content = f.read()
                    if 'class VoiceProcessor' in content:
                        print(f"  - Found VoiceProcessor class")
                    if 'router = APIRouter' in content:
                        print(f"  - Found API router")
            else:
                print(f"✗ {description} module not found")
                
        except Exception as e:
            print(f"✗ Error checking {description}: {e}")

def create_minimal_test_audio():
    """Create minimal test audio using only standard library"""
    print("\n\nCreating Test Audio (using standard library only)...")
    
    import wave
    import struct
    import math
    
    # Create test directory
    test_dir = Path("tests/fixtures/audio")
    test_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate simple sine wave
    sample_rate = 16000
    duration = 1.0
    frequency = 440
    
    samples = []
    for i in range(int(sample_rate * duration)):
        t = i / sample_rate
        value = int(32767 * 0.5 * math.sin(2 * math.pi * frequency * t))
        samples.append(struct.pack('<h', value))  # 16-bit little-endian
    
    # Write WAV file
    output_path = test_dir / "minimal_test.wav"
    with wave.open(str(output_path), 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)  # 16-bit
        wav.setframerate(sample_rate)
        wav.writeframes(b''.join(samples))
    
    print(f"✓ Created test audio: {output_path}")
    print(f"  - Duration: {duration}s")
    print(f"  - Sample rate: {sample_rate} Hz")
    print(f"  - Frequency: {frequency} Hz")
    
    return True

def display_next_steps():
    """Display next steps for the user"""
    print("\n\n" + "="*60)
    print("NEXT STEPS")
    print("="*60)
    
    print("\n1. Install Python dependencies:")
    print("   pip install -r software/backend/requirements.txt")
    print("   pip install openai-whisper")
    
    print("\n2. Run the quick test:")
    print("   python tests/quick_voice_test.py")
    
    print("\n3. Run full test suite:")
    print("   python tests/run_voice_tests.py --all")
    
    print("\n4. For C/firmware testing:")
    print("   cd firmware && make test")
    
    print("\n5. Start the API server:")
    print("   cd software/backend")
    print("   uvicorn main:app --reload")

def main():
    """Run minimal tests"""
    print("W.I.T. Voice System - Minimal Test")
    print("==================================")
    print("This test requires NO external dependencies\n")
    
    all_passed = True
    
    # Check files
    if not check_file_structure():
        all_passed = False
        print("\n⚠️  Some files are missing. Make sure you're in the project root.")
    
    # Check config
    if not check_config():
        all_passed = False
    
    # Test imports
    test_basic_imports()
    
    # Create test audio
    if not create_minimal_test_audio():
        all_passed = False
    
    # Summary
    print("\n\n" + "="*60)
    if all_passed:
        print("✅ Basic structure looks good!")
        print("   Your W.I.T. voice system files are in place.")
    else:
        print("⚠️  Some issues were found.")
        print("   Check the messages above for details.")
    
    display_next_steps()

if __name__ == "__main__":
    main()