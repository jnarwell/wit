#!/bin/bash

# Quick patch for remaining issues

echo "Applying quick fixes..."

# 1. Install missing package
echo "→ Installing python-multipart..."
pip install python-multipart

# 2. Fix the VoiceState enum issue
echo "→ Fixing VoiceState enum..."
# Add the missing enum value to voice_processor.py
sed -i.bak 's/RESPONDING = "responding"/RESPONDING = "responding"\n    WAKE_WORD_DETECTED = "wake_word_detected"/' software/ai/voice/voice_processor.py 2>/dev/null || \
sed -i '' 's/RESPONDING = "responding"/RESPONDING = "responding"\n    WAKE_WORD_DETECTED = "wake_word_detected"/' software/ai/voice/voice_processor.py

# 3. Fix the test file to use pytest_asyncio
echo "→ Fixing async fixtures..."
# Add import
sed -i.bak '1s/^/import pytest_asyncio\n/' tests/test_voice_system.py 2>/dev/null || \
sed -i '' '1s/^/import pytest_asyncio\n/' tests/test_voice_system.py

# Replace @pytest.fixture with @pytest_asyncio.fixture for async fixtures
sed -i.bak 's/@pytest.fixture.*$/&\n    @pytest_asyncio.fixture/' tests/test_voice_system.py 2>/dev/null || \
sed -i '' 's/@pytest.fixture.*$/&\n    @pytest_asyncio.fixture/' tests/test_voice_system.py

# Actually, let's do a more targeted fix
python3 << 'EOF'
import re

# Fix test file
with open("tests/test_voice_system.py", "r") as f:
    content = f.read()

# Add import if not present
if "import pytest_asyncio" not in content:
    content = "import pytest_asyncio\n" + content

# Fix the async fixture
content = re.sub(
    r'@pytest\.fixture\s*\n\s*async def voice_processor',
    '@pytest_asyncio.fixture\nasync def voice_processor',
    content
)

# Fix the WAKE_DETECTED reference
content = content.replace("VoiceState.WAKE_DETECTED", "VoiceState.WAKE_WORD_DETECTED")

with open("tests/test_voice_system.py", "w") as f:
    f.write(content)

print("✓ Fixed test file")

# Fix voice_processor.py enum
try:
    with open("software/ai/voice/voice_processor.py", "r") as f:
        content = f.read()
    
    # Add WAKE_WORD_DETECTED if not present
    if "WAKE_WORD_DETECTED" not in content and "class VoiceState" in content:
        content = content.replace(
            'ERROR = "error"',
            'ERROR = "error"\n    WAKE_WORD_DETECTED = "wake_word_detected"'
        )
    
    with open("software/ai/voice/voice_processor.py", "w") as f:
        f.write(content)
    
    print("✓ Fixed VoiceState enum")
except:
    print("⚠ Could not fix VoiceState enum - do it manually")
EOF

# 4. Create better pytest.ini
echo "→ Creating pytest.ini..."
cat > pytest.ini << 'EOF'
[pytest]
asyncio_mode = auto
testpaths = tests
filterwarnings =
    ignore::DeprecationWarning
    ignore::pytest.PytestDeprecationWarning
EOF

echo ""
echo "✅ Quick fixes applied!"
echo ""
echo "Now run tests with:"
echo "  pytest tests/test_voice_system.py -v"
echo ""
echo "Working tests you can run right now:"
echo "  pytest tests/test_voice_system.py::TestAudioDriver -v"
echo "  pytest tests/test_voice_system.py::TestWakeWordDetection -v"
echo "  pytest tests/test_voice_system.py::TestPerformance -v"