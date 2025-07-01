#!/usr/bin/env python3
"""
Fix all import issues in the W.I.T. project
"""

import os
import re
from pathlib import Path

def fix_file(file_path, replacements):
    """Apply replacements to a file"""
    if not file_path.exists():
        print(f"File not found: {file_path}")
        return False
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    original = content
    for old, new in replacements:
        content = re.sub(old, new, content)
    
    if content != original:
        with open(file_path, 'w') as f:
            f.write(content)
        print(f"Fixed: {file_path}")
        return True
    return False

def main():
    root = Path(__file__).parent
    
    # Fix main.py
    fix_file(root / "software/backend/main.py", [
        (r'from \.services\.database_service import', 'from .services.database_services import'),
        (r'from \.services\.auth_service import', 'from .services.auth_services import'),
    ])
    
    # Fix all API files
    api_files = [
        "software/backend/api/voice_api.py",
        "software/backend/api/vision_api.py", 
        "software/backend/api/equipment_api.py",
        "software/backend/api/workspace_api.py",
        "software/backend/api/system_api.py"
    ]
    
    for api_file in api_files:
        fix_file(root / api_file, [
            # Fix relative imports
            (r'from services\.auth_service import', 'from ..services.auth_services import'),
            (r'from services\.database_service import', 'from ..services.database_services import'),
            (r'from \.\.services\.auth_service import', 'from ..services.auth_services import'),
            (r'from \.\.services\.database_service import', 'from ..services.database_services import'),
            # Fix absolute imports
            (r'from software\.backend\.services\.auth_service import', 'from software.backend.services.auth_services import'),
            (r'from software\.backend\.services\.database_service import', 'from software.backend.services.database_services import'),
            # Fix vision/voice imports
            (r'from vision_processor import', 'from ...ai.vision.vision_processor import'),
            (r'from voice_processor import', 'from ...ai.voice.voice_processor import'),
            # Fix integration imports
            (r'from integrations\.', 'from ...integrations.'),
        ])
    
    # Fix event_service.py
    fix_file(root / "software/backend/services/event_service.py", [
        (r'from \.mqtt_service import', 'from .mqtt_service import'),
    ])
    
    print("\nImport fixes completed!")

if __name__ == "__main__":
    main()