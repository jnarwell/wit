#!/usr/bin/env python3
"""
W.I.T. Quick Test - No external dependencies required

This test verifies basic functionality without needing databases, MQTT, etc.
"""

import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

def test_basic_imports():
    """Test that core modules can be imported"""
    print("Testing basic imports...")
    
    modules_to_test = [
        ("FastAPI", "fastapi", "FastAPI"),
        ("Pydantic", "pydantic", "BaseModel"),
        ("NumPy", "numpy", "__version__"),
        ("OpenCV", "cv2", "__version__"),
    ]
    
    passed = 0
    failed = 0
    
    for name, module, attr in modules_to_test:
        try:
            mod = __import__(module)
            if hasattr(mod, attr):
                print(f"  ✓ {name} imported successfully")
                passed += 1
            else:
                print(f"  ✗ {name} missing attribute: {attr}")
                failed += 1
        except ImportError as e:
            print(f"  ✗ {name} import failed: {e}")
            failed += 1
    
    return passed, failed


def test_project_structure():
    """Test that project structure exists"""
    print("\nTesting project structure...")
    
    required_files = [
        "software/backend/main.py",
        "software/config/voice_config.json",
        "docker-compose.yml",
        "Makefile",
        "README.md"
    ]
    
    passed = 0
    failed = 0
    
    for file_path in required_files:
        full_path = project_root / file_path
        if full_path.exists():
            print(f"  ✓ {file_path}")
            passed += 1
        else:
            print(f"  ✗ {file_path} - NOT FOUND")
            failed += 1
    
    return passed, failed


def test_wit_modules():
    """Test W.I.T. specific modules"""
    print("\nTesting W.I.T. modules...")
    
    wit_modules = [
        ("Backend Main", "software.backend.main", "app"),
        ("Auth Service", "software.backend.services.auth_service", "AuthService"),
        ("Voice API", "software.backend.api.voice_api", "router"),
    ]
    
    passed = 0
    failed = 0
    
    for name, module_path, attr in wit_modules:
        try:
            parts = module_path.split('.')
            module = __import__(module_path, fromlist=[parts[-1]])
            if hasattr(module, attr):
                print(f"  ✓ {name} loaded successfully")
                passed += 1
            else:
                print(f"  ✗ {name} missing attribute: {attr}")
                failed += 1
        except Exception as e:
            print(f"  ✗ {name} failed: {str(e)[:50]}...")
            failed += 1
    
    return passed, failed


def test_audio_processing():
    """Test basic audio processing without external deps"""
    print("\nTesting audio processing...")
    
    try:
        import numpy as np
        
        # Create test audio
        sample_rate = 16000
        duration = 0.1
        samples = int(sample_rate * duration)
        
        # Generate sine wave
        t = np.linspace(0, duration, samples)
        frequency = 440  # A4 note
        audio = np.sin(2 * np.pi * frequency * t)
        
        # Convert to int16
        audio_int16 = (audio * 32767).astype(np.int16)
        
        # Basic checks
        assert len(audio_int16) == samples
        assert audio_int16.dtype == np.int16
        assert -32768 <= audio_int16.min() <= audio_int16.max() <= 32767
        
        print("  ✓ Audio generation works")
        print(f"  ✓ Generated {samples} samples at {sample_rate}Hz")
        return 2, 0
        
    except Exception as e:
        print(f"  ✗ Audio processing failed: {e}")
        return 0, 1


def main():
    """Run all quick tests"""
    print("="*50)
    print("W.I.T. Quick Test Suite")
    print("="*50)
    print(f"Python: {sys.version.split()[0]}")
    print(f"Project: {project_root}")
    print("="*50)
    
    total_passed = 0
    total_failed = 0
    
    # Run all tests
    tests = [
        test_basic_imports,
        test_project_structure,
        test_wit_modules,
        test_audio_processing,
    ]
    
    for test_func in tests:
        passed, failed = test_func()
        total_passed += passed
        total_failed += failed
    
    # Summary
    print("\n" + "="*50)
    print("SUMMARY")
    print("="*50)
    print(f"✅ Passed: {total_passed}")
    print(f"❌ Failed: {total_failed}")
    print(f"📊 Total: {total_passed + total_failed}")
    
    if total_failed == 0:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {total_failed} tests failed")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)