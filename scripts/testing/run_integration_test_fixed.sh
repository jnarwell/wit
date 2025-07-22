#!/bin/bash

# W.I.T. Integration Test Runner - Fixed Version
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

# Ensure we're in the right directory
cd "$(dirname "$0")/.."
echo "Working directory: $(pwd)"

# Set PYTHONPATH
export PYTHONPATH="${PWD}:${PYTHONPATH}"
echo "PYTHONPATH set to: $PYTHONPATH"

# Check what services are available
echo ""
echo "Checking available services..."
echo "=============================="

# Check PostgreSQL
if command -v pg_isready >/dev/null 2>&1 && pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL is running${NC}"
    export TEST_DATABASE=true
else
    echo -e "${YELLOW}⚠ PostgreSQL not running (database tests will be skipped)${NC}"
    export TEST_DATABASE=false
fi

# Check MQTT
if command -v nc >/dev/null 2>&1 && nc -z localhost 1883 >/dev/null 2>&1; then
    echo -e "${GREEN}✓ MQTT broker is running${NC}"
    export TEST_MQTT=true
else
    echo -e "${YELLOW}⚠ MQTT broker not running (MQTT tests will be skipped)${NC}"
    export TEST_MQTT=false
fi

echo ""
echo "Running tests..."
echo "=============================="

# Run different test files
TEST_FILES=(
    "tests/test_startup.py"
    "tests/test_modular.py"
    "tests/test_integrations.py"
)

TOTAL_PASSED=0
TOTAL_FAILED=0

for test_file in "${TEST_FILES[@]}"; do
    if [ -f "$test_file" ]; then
        echo -e "\n${YELLOW}Running $test_file...${NC}"
        if python3 "$test_file"; then
            echo -e "${GREEN}✓ $test_file passed${NC}"
            ((TOTAL_PASSED++))
        else
            echo -e "${RED}✗ $test_file failed${NC}"
            ((TOTAL_FAILED++))
        fi
    else
        echo -e "${YELLOW}⚠ $test_file not found, skipping${NC}"
    fi
done

echo ""
echo "=============================="
echo "FINAL RESULTS"
echo "=============================="
echo -e "${GREEN}Passed: $TOTAL_PASSED${NC}"
echo -e "${RED}Failed: $TOTAL_FAILED${NC}"
echo ""

if [ $TOTAL_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed!${NC}"
    exit 1
fi
