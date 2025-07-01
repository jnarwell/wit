#!/bin/bash

echo "🔧 Applying instant fixes..."

# 1. Install python-multipart (fixes 3 errors)
pip install python-multipart

# 2. Fix VoiceState enum - add WAKE_WORD_DETECTED
python3 -c "
import re
# Add the missing enum value
with open('software/ai/voice/voice_processor.py', 'r') as f:
    content = f.read()

if 'WAKE_WORD_DETECTED' not in content:
    # Find ERROR = and add after it
    content = re.sub(
        r'(ERROR = \"error\")',
        r'\1\n    WAKE_WORD_DETECTED = \"wake_word_detected\"',
        content
    )
    
    with open('software/ai/voice/voice_processor.py', 'w') as f:
        f.write(content)
    print('✓ Added WAKE_WORD_DETECTED to VoiceState enum')
"

# 3. Fix test file - change _execute_command to use processor
python3 -c "
# Fix the test
with open('tests/test_voice_system.py', 'r') as f:
    content = f.read()

# Fix the execute command call
content = content.replace(
    'await assistant._execute_command(command)',
    'await voice_processor._execute_command(command)'
)

with open('tests/test_voice_system.py', 'w') as f:
    f.write(content)
print('✓ Fixed _execute_command call')
"

echo ""
echo "✅ All fixes applied!"
echo ""
echo "Run tests again:"
echo "pytest tests/test_voice_system.py -v"