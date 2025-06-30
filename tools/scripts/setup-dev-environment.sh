#!/bin/bash

echo "Setting up W.I.T. development environment..."

# Check for required tools
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required but not installed."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed."; exit 1; }

# Create Python virtual environment
echo "Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r software/backend/requirements.txt

# Install Node dependencies
echo "Installing Node.js dependencies..."
cd software/frontend && npm install
cd ../mobile && npm install
cd ../..

# Setup pre-commit hooks
echo "Setting up Git hooks..."
cat > .git/hooks/pre-commit << 'HOOK'
#!/bin/bash
# Run tests before commit
make test
HOOK
chmod +x .git/hooks/pre-commit

# Create environment file template
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << 'ENV'
# Database
DB_PASSWORD=your_secure_password_here

# API Keys
OPENAI_API_KEY=your_api_key_here

# Hardware Configuration
SERIAL_PORT=/dev/ttyUSB0
NPU_DEVICE=/dev/hailo0

# Development
DEBUG=true
ENV
fi

echo "Development environment setup complete!"
echo "Next steps:"
echo "1. Update .env with your configuration"
echo "2. Run 'make dev' to start development servers"
echo "3. Visit http://localhost:3000 for the web interface"
