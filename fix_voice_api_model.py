#!/usr/bin/env python3
"""
Fix Claude model name in voice_api.py
"""

import os
import re

# File to update
file_path = "software/backend/api/voice_api.py"

if os.path.exists(file_path):
    # Read the file
    with open(file_path, 'r') as f:
        content = f.read()

    # Replace the model name
    content = re.sub(
        r'claude_model: str = Field\(default="claude-3-sonnet-20240229"',
        'claude_model: str = Field(default="claude-3-5-sonnet-20241022"',
        content
    )
    
    # Also update in the startup event
    content = re.sub(
        r'claude_model="claude-3-sonnet-20240229"',
        'claude_model="claude-3-5-sonnet-20241022"',
        content
    )

    # Write back
    with open(file_path, 'w') as f:
        f.write(content)

    print("✅ Updated voice_api.py model to claude-3-5-sonnet-20241022")
else:
    print("⚠️  voice_api.py not found at expected location")