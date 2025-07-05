#!/bin/bash

# W.I.T. Voice & Memory System - File Creation Script
# This script creates all necessary files and directories

echo "🚀 Creating W.I.T. Voice & Memory System Files"
echo "============================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create directories
echo -e "\n${BLUE}Creating directories...${NC}"

directories=(
    "software/ai/voice"
    "software/ai/voice/memory"
    "software/backend/api"
    "software/config"
    "data/memory"
    "logs/memory"
    "logs/voice"
)

for dir in "${directories[@]}"; do
    mkdir -p "$dir"
    echo -e "${GREEN}✓${NC} Created $dir"
done

# Create Memory System Files
echo -e "\n${BLUE}Creating Memory System files...${NC}"

# 1. Memory System Core
cat > software/ai/voice/memory/memory_system.py << 'EOF'
#!/usr/bin/env python3
"""
W.I.T. Memory System - Complete User Context & History

COPY FROM ARTIFACT: wit-memory-system

This file should contain:
- User profile management
- Complete conversation history
- Project tracking
- Equipment usage logs
- Learning insights
- Context building for Claude
"""

# Placeholder - Copy content from artifact: wit-memory-system
print("Memory system placeholder - copy from artifact")
EOF
chmod +x software/ai/voice/memory/memory_system.py
echo -e "${GREEN}✓${NC} Created software/ai/voice/memory/memory_system.py"

# 2. Memory Voice Processor
cat > software/ai/voice/memory/memory_voice_processor.py << 'EOF'
#!/usr/bin/env python3
"""
W.I.T. Voice Processor with Memory Integration

COPY FROM ARTIFACT: wit-memory-voice-processor

This file should contain:
- Enhanced voice processor with memory
- Context-aware command processing
- Learning from interactions
- Session management
"""

# Placeholder - Copy content from artifact: wit-memory-voice-processor
print("Memory voice processor placeholder - copy from artifact")
EOF
chmod +x software/ai/voice/memory/memory_voice_processor.py
echo -e "${GREEN}✓${NC} Created software/ai/voice/memory/memory_voice_processor.py"

# 3. Memory API
cat > software/backend/api/memory_voice_api.py << 'EOF'
#!/usr/bin/env python3
"""
W.I.T. Voice API with Memory System

COPY FROM ARTIFACT: wit-memory-api

This file should contain:
- User authentication endpoints
- Memory-enhanced command processing
- Project management API
- Conversation history API
- Equipment tracking API
"""

# Placeholder - Copy content from artifact: wit-memory-api
print("Memory API placeholder - copy from artifact")
EOF
chmod +x software/backend/api/memory_voice_api.py
echo -e "${GREEN}✓${NC} Created software/backend/api/memory_voice_api.py"

# Create Setup and Utility Files
echo -e "\n${BLUE}Creating setup and utility files...${NC}"

# 4. Memory System Setup
cat > setup_memory_system.py << 'EOF'
#!/usr/bin/env python3
"""
Setup W.I.T. Memory System

COPY FROM ARTIFACT: wit-memory-setup

This script:
- Checks dependencies
- Creates directory structure
- Tests memory system
- Creates demo scripts
"""

# Placeholder - Copy content from artifact: wit-memory-setup
print("Setup script placeholder - copy from artifact")
EOF
chmod +x setup_memory_system.py
echo -e "${GREEN}✓${NC} Created setup_memory_system.py"

# Create Test and Demo Files
echo -e "\n${BLUE}Creating test and demo files...${NC}"

# 5. Development Server
cat > dev_server.py << 'EOF'
#!/usr/bin/env python3
"""
W.I.T. Development Server

COPY FROM ARTIFACT: wit-dev-server

Basic server for testing voice API
"""

# Placeholder - Copy content from artifact: wit-dev-server
print("Dev server placeholder - copy from artifact")
EOF
chmod +x dev_server.py
echo -e "${GREEN}✓${NC} Created dev_server.py"

# 6. Test Voice Commands
cat > test_voice_commands.py << 'EOF'
#!/usr/bin/env python3
"""
Test W.I.T. Voice Commands

COPY FROM ARTIFACT: wit-test-voice

Interactive test script for voice processing
"""

# Placeholder - Copy content from artifact: wit-test-voice
print("Test script placeholder - copy from artifact")
EOF
chmod +x test_voice_commands.py
echo -e "${GREEN}✓${NC} Created test_voice_commands.py"

# Create Configuration Files
echo -e "\n${BLUE}Creating configuration files...${NC}"

# 7. Voice Config
cat > software/config/voice_config.json << 'EOF'
{
  "voice_processing": {
    "anthropic_api_key": "${ANTHROPIC_API_KEY}",
    "claude_model": "claude-3-5-sonnet-20241022",
    "language": "en",
    "sample_rate": 16000,
    "energy_threshold": 4000,
    "silence_duration": 1.0,
    "max_recording_duration": 30.0,
    "enable_wake_word": true,
    "wake_words": ["hey wit", "okay wit", "workshop", "computer"]
  },
  "workshop_commands": {
    "equipment": {
      "3d_printer": {
        "aliases": ["printer", "3d", "prusa", "ender"],
        "commands": ["start", "stop", "pause", "resume", "heat", "cool", "status"]
      },
      "laser_cutter": {
        "aliases": ["laser", "cutter", "engraver"],
        "commands": ["start", "stop", "pause", "focus", "power", "status"]
      },
      "cnc_mill": {
        "aliases": ["cnc", "mill", "router"],
        "commands": ["start", "stop", "pause", "home", "zero", "status"]
      }
    }
  }
}
EOF
echo -e "${GREEN}✓${NC} Created software/config/voice_config.json"

# Create Requirements Files
echo -e "\n${BLUE}Creating requirements files...${NC}"

# 8. Voice Requirements
cat > requirements-voice.txt << 'EOF'
# W.I.T. Voice System Requirements
# COPY FROM ARTIFACT: wit-voice-requirements

# Core requirements
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
aiohttp>=3.9.0
python-dotenv>=1.0.0

# Voice processing (optional but recommended)
SpeechRecognition>=3.10.0
pyaudio>=0.2.13

# Audio processing
numpy>=1.24.0
scipy>=1.11.0

# For development/testing
httpx>=0.25.0
pytest>=7.4.0
pytest-asyncio>=0.21.0
EOF
echo -e "${GREEN}✓${NC} Created requirements-voice.txt"

# 9. Memory Requirements
cat > requirements-memory.txt << 'EOF'
# W.I.T. Memory System Requirements

# Core memory system
sentence-transformers>=2.2.0
PyJWT>=2.8.0
numpy>=1.24.0

# Existing voice requirements
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
aiohttp>=3.9.0
python-dotenv>=1.0.0
SpeechRecognition>=3.10.0

# Optional
pandas>=2.0.0
matplotlib>=3.4.0
EOF
echo -e "${GREEN}✓${NC} Created requirements-memory.txt"

# Create model fix scripts
echo -e "\n${BLUE}Creating fix scripts...${NC}"

# 10. Fix Claude Model Script
cat > fix_claude_model.py << 'EOF'
#!/usr/bin/env python3
"""
Fix Claude model name in voice processor

COPY FROM ARTIFACT: fix-claude-model
"""

# Placeholder - Copy content from artifact: fix-claude-model
print("Model fix placeholder - copy from artifact")
EOF
chmod +x fix_claude_model.py
echo -e "${GREEN}✓${NC} Created fix_claude_model.py"

# Create .env template if it doesn't exist
if [ ! -f .env ]; then
    echo -e "\n${BLUE}Creating .env template...${NC}"
    cat > .env << 'EOF'
# W.I.T. Environment Variables
ANTHROPIC_API_KEY=your-api-key-here
JWT_SECRET_KEY=your-secret-key-change-this
EOF
    echo -e "${GREEN}✓${NC} Created .env template"
fi

# Create .gitignore if it doesn't exist
if [ ! -f .gitignore ]; then
    echo -e "\n${BLUE}Creating .gitignore...${NC}"
    cat > .gitignore << 'EOF'
# Environment variables
.env

# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/

# Database
*.db
*.sqlite
*.sqlite3

# Logs
logs/
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Memory data
data/memory/
wit_memory.db
test_memory.db
EOF
    echo -e "${GREEN}✓${NC} Created .gitignore"
fi

# Summary
echo -e "\n${YELLOW}========================================${NC}"
echo -e "${YELLOW}✅ All files created successfully!${NC}"
echo -e "${YELLOW}========================================${NC}"

echo -e "\n${BLUE}📁 File Structure Created:${NC}"
echo "
wit/
├── software/
│   ├── ai/
│   │   └── voice/
│   │       ├── claude_voice_processor.py (existing)
│   │       └── memory/
│   │           ├── memory_system.py ⭐
│   │           └── memory_voice_processor.py ⭐
│   ├── backend/
│   │   └── api/
│   │       ├── voice_api.py (existing)
│   │       └── memory_voice_api.py ⭐
│   └── config/
│       └── voice_config.json
├── data/
│   └── memory/
├── logs/
│   ├── memory/
│   └── voice/
├── setup_memory_system.py ⭐
├── dev_server.py
├── test_voice_commands.py
├── fix_claude_model.py
├── requirements-voice.txt
├── requirements-memory.txt
├── .env (template)
└── .gitignore

⭐ = Core memory system files
"

echo -e "\n${BLUE}📋 Next Steps:${NC}"
echo "1. Copy the content from each artifact to its corresponding file:"
echo "   - Each file has a comment showing which artifact to copy from"
echo ""
echo "2. Update your .env file with your API key:"
echo "   nano .env"
echo ""
echo "3. Install dependencies:"
echo "   pip3 install -r requirements-voice.txt"
echo "   pip3 install -r requirements-memory.txt"
echo ""
echo "4. Run the memory system setup:"
echo "   python3 setup_memory_system.py"
echo ""
echo "5. Start the server:"
echo "   python3 memory_server.py"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"