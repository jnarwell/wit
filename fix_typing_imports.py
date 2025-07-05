#!/usr/bin/env python3
"""
Fix missing typing imports in W.I.T. files
"""

import re
from pathlib import Path

print("🔧 Fixing missing typing imports...")

# Fix memory_voice_processor.py
memory_processor_file = Path("software/ai/voice/memory/memory_voice_processor.py")

if memory_processor_file.exists():
    with open(memory_processor_file, 'r') as f:
        content = f.read()
    
    # Check if Tuple is already imported
    if 'from typing import' in content and 'Tuple' not in content.split('from typing import')[1].split('\n')[0]:
        # Add Tuple to existing typing import
        content = re.sub(
            r'from typing import ([^)]+)',
            r'from typing import \1, Tuple',
            content,
            count=1
        )
        print("✅ Added Tuple to existing typing import")
    elif 'from typing import' not in content:
        # Add typing import at the top after other imports
        lines = content.split('\n')
        import_idx = 0
        for i, line in enumerate(lines):
            if line.startswith('import ') or line.startswith('from '):
                import_idx = i + 1
        lines.insert(import_idx, 'from typing import Tuple')
        content = '\n'.join(lines)
        print("✅ Added typing import line")
    
    # Write back
    with open(memory_processor_file, 'w') as f:
        f.write(content)
    print(f"✅ Fixed {memory_processor_file}")
else:
    print(f"❌ File not found: {memory_processor_file}")

# Also check memory_system.py
memory_system_file = Path("software/ai/voice/memory/memory_system.py")

if memory_system_file.exists():
    with open(memory_system_file, 'r') as f:
        content = f.read()
    
    # Ensure it has proper typing imports
    if 'from typing import' in content:
        typing_line = [line for line in content.split('\n') if line.startswith('from typing import')][0]
        needed_types = ['List', 'Dict', 'Any', 'Optional', 'Tuple']
        missing = []
        for t in needed_types:
            if t not in typing_line:
                missing.append(t)
        
        if missing:
            # Replace the typing import with complete one
            content = re.sub(
                r'from typing import.*',
                f'from typing import {", ".join(needed_types)}',
                content,
                count=1
            )
            print(f"✅ Updated typing imports in memory_system.py")
            
            with open(memory_system_file, 'w') as f:
                f.write(content)

print("\n✅ Typing imports fixed!")
print("\nNow try:")
print("  python3 test_imports.py")