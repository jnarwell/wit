import os
import re

def fix_imports_in_file(filepath):
    """Fix all imports in a single file"""
    if not os.path.exists(filepath):
        print(f"❌ File not found: {filepath}")
        return
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    original_content = content
    
    # Fix all relative imports to absolute imports
    replacements = {
        # Service imports
        r"from services\.": "from software.backend.services.",
        r"from \.\.services\.": "from software.backend.services.",
        r"from \.\.\.services\.": "from software.backend.services.",
        
        # Integration imports
        r"from integrations\.": "from software.integrations.",
        r"from \.\.integrations\.": "from software.integrations.",
        
        # AI imports
        r"from \.\.\.ai\.voice\.": "from software.ai.voice.",
        r"from \.\.\.ai\.vision\.": "from software.ai.vision.",
        r"from vision_processor": "from software.ai.vision.vision_processor",
        r"from voice_processor": "from software.ai.voice.voice_processor",
        
        # Remove sys.path manipulations
        r"sys\.path\.append\([^)]+\)": "# sys.path handled by main module",
        
        # Auth service specific
        r"from auth_service": "from software.backend.services.auth_service",
    }
    
    # Apply regex replacements
    for pattern, replacement in replacements.items():
        content = re.sub(pattern, replacement, content)
    
    # Special case for auth services vs auth_service
    content = content.replace(
        "from software.backend.services.auth_service import",
        "from software.backend.services.auth_services import"
    )
    
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"✅ Fixed imports in {os.path.basename(filepath)}")
    else:
        print(f"ℹ️  No changes needed in {os.path.basename(filepath)}")

# Fix all API files
api_dir = "software/backend/api"
for filename in os.listdir(api_dir):
    if filename.endswith(".py"):
        fix_imports_in_file(os.path.join(api_dir, filename))

# Fix service files
service_dir = "software/backend/services"
for filename in os.listdir(service_dir):
    if filename.endswith(".py"):
        fix_imports_in_file(os.path.join(service_dir, filename))

# Fix main.py
fix_imports_in_file("software/backend/main.py")

print("\n✨ All imports should be fixed now!")
