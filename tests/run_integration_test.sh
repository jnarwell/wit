#!/bin/bash

# W.I.T. Integration Test Runner
# This script sets up the environment and runs integration tests

echo "=================================="
echo "W.I.T. Integration Test Runner"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Python version
echo "Checking Python version..."
python3 --version

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate || . venv/Scripts/activate

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
pip install --quiet --upgrade pip
pip install --quiet -r software/backend/requirements.txt
pip install --quiet pytest pytest-asyncio python-multipart

# Set test environment variables
export PYTHONPATH="${PWD}:${PYTHONPATH}"
export TEST_DATABASE=false  # Set to true if you have PostgreSQL running
export TEST_MQTT=false      # Set to true if you have MQTT broker running
export TEST_VOICE=false     # Set to true to test voice (requires Whisper)
export TEST_VISION=false    # Set to true to test vision (requires YOLO)

# Check what services are available
echo ""
echo "Checking available services..."
echo "=============================="

# Check PostgreSQL
if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL is running${NC}"
    export TEST_DATABASE=true
else
    echo -e "${YELLOW}⚠ PostgreSQL not running (database tests will be skipped)${NC}"
fi

# Check MQTT
if nc -z localhost 1883 >/dev/null 2>&1; then
    echo -e "${GREEN}✓ MQTT broker is running${NC}"
    export TEST_MQTT=true
else
    echo -e "${YELLOW}⚠ MQTT broker not running (MQTT tests will be skipped)${NC}"
fi

# Check for voice models
if python3 -c "import whisper" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Whisper is installed${NC}"
    export TEST_VOICE=true
else
    echo -e "${YELLOW}⚠ Whisper not installed (voice tests will be skipped)${NC}"
    echo "  Install with: pip install openai-whisper"
fi

# Check for vision models
if python3 -c "from ultralytics import YOLO" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ YOLO is installed${NC}"
    export TEST_VISION=true
else
    echo -e "${YELLOW}⚠ YOLO not installed (vision tests will be skipped)${NC}"
    echo "  Install with: pip install ultralytics"
fi

echo ""
echo "Running integration tests..."
echo "=============================="

# Run the integration test
python3 tests/test_integration.py

# Capture exit code
EXIT_CODE=$?

# Run quick unit tests too
echo ""
echo "Running quick unit tests..."
echo "=============================="
pytest tests/test_voice_system.py::TestAudioDriver -v --tb=short

# Deactivate virtual environment
deactivate

# Exit with the test exit code
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "\n${GREEN}✅ Integration tests completed successfully!${NC}"
else
    echo -e "\n${RED}❌ Integration tests failed!${NC}"
fi

exit $EXIT_CODE