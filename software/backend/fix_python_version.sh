#!/bin/bash
# Fix Python version compatibility issue
# File: software/backend/fix_python_version.sh

set -e

echo "=== Fixing Python Version Compatibility ==="
echo
echo "Python 3.13 is too new for many packages."
echo "We need to use Python 3.12 or 3.11."
echo

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check available Python versions
echo -e "${YELLOW}Checking available Python versions...${NC}"

# Function to check Python version
check_python() {
    local cmd=$1
    if command -v $cmd &> /dev/null; then
        version=$($cmd --version 2>&1 | awk '{print $2}')
        echo -e "  ${GREEN}✓${NC} $cmd: $version"
        return 0
    else
        return 1
    fi
}

# Check for different Python versions
PYTHON_CMD=""
if check_python "python3.12"; then
    PYTHON_CMD="python3.12"
elif check_python "python3.11"; then
    PYTHON_CMD="python3.11"
elif check_python "python3.10"; then
    PYTHON_CMD="python3.10"
elif check_python "python3.9"; then
    PYTHON_CMD="python3.9"
fi

echo

if [ -z "$PYTHON_CMD" ]; then
    echo -e "${RED}Error: No compatible Python version found (3.9-3.12)${NC}"
    echo
    echo "Please install Python 3.12 or 3.11:"
    echo
    echo "On macOS with Homebrew:"
    echo "  brew install python@3.12"
    echo "  # or"
    echo "  brew install python@3.11"
    echo
    echo "On Ubuntu/Debian:"
    echo "  sudo apt update"
    echo "  sudo apt install python3.12 python3.12-venv"
    echo
    echo "Using pyenv:"
    echo "  pyenv install 3.12.0"
    echo "  pyenv local 3.12.0"
    echo
    exit 1
fi

echo -e "${GREEN}Using $PYTHON_CMD${NC}"
echo

# Remove old virtual environment
if [ -d "venv" ]; then
    echo -e "${YELLOW}Removing old virtual environment...${NC}"
    rm -rf venv
fi

# Create new virtual environment with compatible Python
echo -e "${YELLOW}Creating new virtual environment...${NC}"
$PYTHON_CMD -m venv venv

# Activate virtual environment
source venv/bin/activate

# Verify Python version in venv
VENV_PYTHON_VERSION=$(python --version | awk '{print $2}')
echo -e "${GREEN}✓ Virtual environment created with Python $VENV_PYTHON_VERSION${NC}"

# Upgrade pip
echo -e "${YELLOW}Upgrading pip...${NC}"
python -m pip install --upgrade pip

# Install wheel and setuptools first
pip install wheel setuptools

# Install dependencies one by one to catch errors
echo -e "${YELLOW}Installing core dependencies...${NC}"

# Install in specific order to avoid conflicts
deps=(
    "wheel"
    "setuptools"
    "pydantic==2.5.0"
    "pydantic-settings==2.1.0"
    "python-dotenv==1.0.0"
    "sqlalchemy==2.0.23"
    "aiosqlite==0.19.0"
    "fastapi==0.104.1"
    "uvicorn[standard]==0.24.0"
    "python-multipart==0.0.6"
    "alembic==1.13.1"
    "python-jose[cryptography]==3.3.0"
    "passlib[bcrypt]==1.7.4"
    "aiohttp==3.9.1"
    "httpx==0.25.2"
    "aiofiles==23.2.1"
    "python-dateutil==2.8.2"
    "pytz==2023.3"
    "click==8.1.7"
    "loguru==0.7.2"
)

failed_deps=()

for dep in "${deps[@]}"; do
    echo -n "Installing $dep... "
    if pip install "$dep" &> /dev/null; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
        failed_deps+=("$dep")
    fi
done

if [ ${#failed_deps[@]} -eq 0 ]; then
    echo -e "\n${GREEN}✓ All dependencies installed successfully!${NC}"
else
    echo -e "\n${YELLOW}Warning: Some dependencies failed to install:${NC}"
    for dep in "${failed_deps[@]}"; do
        echo "  - $dep"
    done
fi

# Create minimal requirements file for this Python version
cat > requirements-minimal.txt << EOF
# Minimal requirements for W.I.T. Backend
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
pydantic-settings==2.1.0
python-multipart==0.0.6
sqlalchemy==2.0.23
aiosqlite==0.19.0
alembic==1.13.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-dotenv==1.0.0
aiofiles==23.2.1
loguru==0.7.2
EOF

echo -e "\n${GREEN}Setup complete!${NC}"
echo
echo "Next steps:"
echo "1. Activate the virtual environment:"
echo "   source venv/bin/activate"
echo
echo "2. Run the SQLite test:"
echo "   python test_sqlite_simple.py"
echo
echo "3. Initialize the database:"
echo "   python init_database.py"
echo
echo "4. Start the server:"
echo "   python dev_server.py"