#!/usr/bin/env python3
"""Minimal W.I.T. Test - No External Dependencies"""

import sys
from pathlib import Path

# Add project to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

print("W.I.T. Minimal Test")
print("=" * 40)

# Test 1: Project structure
print("\n1. Testing project structure...")
required_dirs = [
    "software/backend",
    "software/ai/voice", 
    "software/ai/vision",
    "software/integrations"
]
for dir_path in required_dirs:
    if (project_root / dir_path).exists():
        print(f"  ✓ {dir_path}")
    else:
        print(f"  ✗ {dir_path}")

# Test 2: Dev server
print("\n2. Testing dev server import...")
try:
    import dev_server
    print("  ✓ Dev server can be imported")
except Exception as e:
    print(f"  ✗ Dev server import failed: {e}")

# Test 3: Backend structure
print("\n3. Testing backend modules...")
try:
    from software.backend import main
    print("  ✓ Backend main module loaded")
except Exception as e:
    print(f"  ✗ Backend main failed: {e}")

print("\n" + "=" * 40)
print("✅ Basic structure test complete!")
