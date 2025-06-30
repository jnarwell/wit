#!/bin/bash

# W.I.T. (Workspace Integrated Terminal) Project
# GitHub Repository Initialization Script
# Run this script in your desired project directory

echo "Initializing W.I.T. Project Repository Structure..."

# Create main project directories
mkdir -p hardware/{electrical,mechanical,testing}
mkdir -p hardware/electrical/{schematics,pcb,bom,datasheets,simulations}
mkdir -p hardware/mechanical/{cad,drawings,assemblies,enclosure,thermal}
mkdir -p hardware/testing/{emc,environmental,safety,validation}

mkdir -p firmware/{core,drivers,bootloader,hal,tests}
mkdir -p firmware/core/{voice,vision,control,communication}
mkdir -p firmware/drivers/{sensors,actuators,display,network}

mkdir -p software/{backend,frontend,mobile,ai,integrations}
mkdir -p software/backend/{api,database,services,auth,mqtt}
mkdir -p software/frontend/{web,desktop,components,assets}
mkdir -p software/mobile/{android,ios,shared}
mkdir -p software/ai/{voice,vision,models,training,inference}
mkdir -p software/integrations/{octoprint,grbl,linuxcnc,modbus}

mkdir -p manufacturing/{bom,assembly,suppliers,quality,compliance}
mkdir -p manufacturing/compliance/{fcc,ce,ul,rohs}

mkdir -p docs/{technical,user,api,design,research}
mkdir -p docs/technical/{architecture,protocols,specifications}
mkdir -p docs/design/{industrial,ui-ux,branding}

mkdir -p tools/{scripts,utilities,testing,deployment}
mkdir -p tests/{unit,integration,system,performance}
mkdir -p deployment/{docker,kubernetes,ci-cd,infrastructure}

mkdir -p resources/{logos,images,videos,presentations}
mkdir -p project-management/{roadmap,sprints,meetings,decisions}

# Create root README.md
cat > README.md << 'EOF'
# W.I.T. (Workspace Integrated Terminal)
### JARVIS for the Workshop - A Modular AI-Powered Maker Assistant

![W.I.T. Logo](resources/logos/wit-logo.png)

## 🎯 Vision
Create the first truly integrated, voice-controlled, hands-free maker assistant platform that enables makers, engineers, and technical professionals to work hands-free through voice AI, computer vision, and universal device integration.

## 🚀 Quick Start
```bash
# Clone the repository
git clone https://github.com/[organization]/wit-terminal.git
cd wit-terminal

# Install development dependencies
./tools/scripts/setup-dev-environment.sh

# Run tests
make test

# Build firmware
cd firmware && make build

# Start backend services
cd software/backend && docker-compose up
```

## 📋 Project Structure
```
wit-terminal/
├── hardware/          # Electrical and mechanical design files
├── firmware/          # Embedded software for W.I.T. Core
├── software/          # Backend, frontend, and AI software
├── manufacturing/     # Production and compliance documentation
├── docs/             # Technical and user documentation
├── tests/            # Test suites and validation
└── tools/            # Development utilities and scripts
```

## 🏗️ Architecture Overview
- **Core Unit**: High-performance computing platform with AI acceleration
- **Modular System**: Hot-swappable modules for different workshop tools
- **Voice Interface**: Sub-100ms latency voice processing
- **Computer Vision**: Real-time workshop monitoring and safety
- **Universal Integration**: Support for all major maker equipment

## 🛠️ Key Features
- ✅ Hands-free workshop control
- ✅ Real-time safety monitoring
- ✅ Equipment integration (3D printers, CNC, laser cutters)
- ✅ Local AI processing for privacy
- ✅ Modular expansion system
- ✅ Professional and maker editions

## 📊 Technical Specifications
- **Processor**: AMD Ryzen 9 9950X / Intel Core i9-13900K
- **AI Acceleration**: Hailo-8L NPU (13 TOPS)
- **Memory**: 64GB DDR5 (expandable to 128GB)
- **Connectivity**: Thunderbolt 5, USB4, CAN bus
- **Environment**: IP65 rated, -40°C to +85°C operation

## 🤝 Contributing
We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License
This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links
- [Documentation](https://docs.wit-terminal.com)
- [Discord Community](https://discord.gg/wit-makers)
- [Hardware Files](https://github.com/[organization]/wit-hardware)
- [Issue Tracker](https://github.com/[organization]/wit-terminal/issues)

## 📞 Contact
- Email: team@wit-terminal.com
- Twitter: [@WITTerminal](https://twitter.com/WITTerminal)
EOF

# Create .gitignore
cat > .gitignore << 'EOF'
# Operating System Files
.DS_Store
Thumbs.db
*.swp
*.swo
*~

# IDE and Editor Files
.vscode/
.idea/
*.sublime-*
.project
.classpath
.settings/

# Build Outputs
build/
dist/
out/
target/
*.o
*.a
*.so
*.exe
*.dll
*.dylib

# Hardware Design Files
*.bak
*.bck
*.kicad_pcb-bak
*-cache.lib
*-rescue.lib
*-save.pro
*-save.kicad_pcb
*.net
*.dsn
*.ses
\#auto_saved_files\#
*.tmp
*-backups/

# Firmware/Embedded
*.hex
*.bin
*.elf
*.map
*.lst

# Python
__pycache__/
*.py[cod]
*$py.class
.Python
env/
venv/
.env
*.egg-info/

# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.npm
.yarn

# Documentation
docs/_build/
*.pdf
!docs/datasheets/*.pdf

# Test Coverage
coverage/
*.coverage
.coverage.*
htmlcov/

# Logs
*.log
logs/

# Sensitive Data
secrets/
*.key
*.pem
*.p12
credentials.json
config.local.json

# Manufacturing
gerbers/*.zip
*.step
*.stp
*.iges
*.igs
!reference_models/*.st*

# Large Files
*.weights
*.model
*.h5
datasets/
EOF

# Create LICENSE
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2024 W.I.T. Terminal Project

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF

# Create CONTRIBUTING.md
cat > CONTRIBUTING.md << 'EOF'
# Contributing to W.I.T. Terminal

We're excited that you're interested in contributing to the W.I.T. Terminal project!

## Code of Conduct
Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Issues
- Check existing issues first
- Use issue templates
- Include relevant system information
- Provide steps to reproduce

### Submitting Changes
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Coding Standards
- Follow existing code style
- Add tests for new features
- Update documentation
- Keep commits atomic and well-described

### Areas We Need Help
- 🔌 Hardware driver development
- 🎤 Voice processing optimization
- 👁️ Computer vision algorithms
- 🔧 Equipment integrations
- 📚 Documentation
- 🧪 Testing and validation

## Development Setup
See [docs/technical/development-setup.md](docs/technical/development-setup.md)

## Questions?
Join our [Discord community](https://discord.gg/wit-makers) or open a discussion.
EOF

# Create hardware README files
cat > hardware/README.md << 'EOF'
# W.I.T. Hardware Design

This directory contains all hardware design files for the W.I.T. Terminal system.

## Directory Structure
- `electrical/` - PCB designs, schematics, and electrical documentation
- `mechanical/` - CAD files, enclosure designs, and mechanical drawings
- `testing/` - Test procedures, validation reports, and compliance documentation

## Design Tools
- **Electrical**: KiCad 7.0+ (open source) or Altium Designer
- **Mechanical**: Fusion 360 or FreeCAD
- **Simulation**: LTSpice for circuits, Ansys for thermal

## Key Components
- Main processing board with AMD/Intel CPU
- Hailo-8L NPU expansion card
- Power distribution board
- Modular interface boards
- Voice processing array board

## Design Guidelines
- Follow IPC standards for PCB design
- Maintain 10% component derating
- Design for manufacturing (DFM) from the start
- Consider thermal management in all designs
EOF

# Create firmware README
cat > firmware/README.md << 'EOF'
# W.I.T. Firmware

Real-time embedded software for the W.I.T. Terminal hardware platform.

## Architecture
- **RTOS**: FreeRTOS or Zephyr
- **HAL**: Hardware abstraction layer for portability
- **Drivers**: Low-level hardware drivers
- **Core**: Main application logic

## Building
```bash
# Setup toolchain
./tools/setup-toolchain.sh

# Configure for target
make menuconfig

# Build firmware
make -j$(nproc)

# Flash to device
make flash
```

## Key Modules
- Voice wake word detection
- Real-time sensor processing
- Equipment communication protocols
- Safety monitoring system
- OTA update system

## Development Guidelines
- Keep ISR code minimal
- Use DMA for high-speed transfers
- Implement watchdog timers
- Follow MISRA-C guidelines where applicable
EOF

# Create software README
cat > software/README.md << 'EOF'
# W.I.T. Software Stack

High-level software components for the W.I.T. Terminal ecosystem.

## Components
- **Backend**: RESTful API, WebSocket services, MQTT broker
- **Frontend**: Web dashboard, system configuration UI
- **Mobile**: iOS/Android companion apps
- **AI**: Voice and vision processing pipelines
- **Integrations**: Equipment-specific adapters

## Tech Stack
- **Backend**: Python (FastAPI), Node.js services
- **Frontend**: React, TypeScript, Tailwind CSS
- **Mobile**: React Native
- **AI**: PyTorch, ONNX Runtime
- **Database**: PostgreSQL, TimescaleDB, Redis

## Quick Start
```bash
# Start all services
docker-compose up -d

# Run development servers
cd backend && python -m uvicorn main:app --reload
cd frontend && npm run dev
```

## API Documentation
API docs available at `http://localhost:8000/docs` when running locally.
EOF

# Create key configuration files
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: timescale/timescaledb:latest-pg15
    environment:
      POSTGRES_DB: wit_db
      POSTGRES_USER: wit_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  mqtt:
    image: eclipse-mosquitto:2
    volumes:
      - ./deployment/mosquitto/config:/mosquitto/config
      - mosquitto_data:/mosquitto/data
      - mosquitto_logs:/mosquitto/log
    ports:
      - "1883:1883"
      - "9001:9001"

  backend:
    build: ./software/backend
    depends_on:
      - postgres
      - redis
      - mqtt
    environment:
      DATABASE_URL: postgresql://wit_user:${DB_PASSWORD}@postgres:5432/wit_db
      REDIS_URL: redis://redis:6379
      MQTT_BROKER: mqtt://mqtt:1883
    ports:
      - "8000:8000"
    volumes:
      - ./software/backend:/app

  frontend:
    build: ./software/frontend
    depends_on:
      - backend
    ports:
      - "3000:3000"
    environment:
      REACT_APP_API_URL: http://localhost:8000

volumes:
  postgres_data:
  redis_data:
  mosquitto_data:
  mosquitto_logs:
EOF

# Create Makefile
cat > Makefile << 'EOF'
# W.I.T. Terminal Project Makefile

.PHONY: all build test clean install dev docs

all: build

build:
	@echo "Building all components..."
	$(MAKE) -C firmware build
	$(MAKE) -C software/backend build
	cd software/frontend && npm run build

test:
	@echo "Running all tests..."
	$(MAKE) -C firmware test
	cd software/backend && python -m pytest
	cd software/frontend && npm test
	$(MAKE) -C tests integration

clean:
	@echo "Cleaning build artifacts..."
	$(MAKE) -C firmware clean
	rm -rf software/backend/__pycache__
	rm -rf software/frontend/build
	find . -type f -name "*.pyc" -delete

install:
	@echo "Installing dependencies..."
	pip install -r software/backend/requirements.txt
	cd software/frontend && npm install
	cd software/mobile && npm install

dev:
	@echo "Starting development environment..."
	docker-compose up -d postgres redis mqtt
	cd software/backend && python -m uvicorn main:app --reload &
	cd software/frontend && npm run dev

docs:
	@echo "Building documentation..."
	cd docs && make html

firmware-flash:
	$(MAKE) -C firmware flash

hardware-check:
	@echo "Running hardware design checks..."
	cd hardware/electrical && python tools/drc_check.py
	cd hardware/mechanical && python tools/interference_check.py
EOF

# Create initial Python requirements
cat > software/backend/requirements.txt << 'EOF'
fastapi==0.104.1
uvicorn==0.24.0
pydantic==2.5.0
sqlalchemy==2.0.23
asyncpg==0.29.0
redis==5.0.1
paho-mqtt==1.6.1
numpy==1.26.2
opencv-python==4.8.1
torch==2.1.1
onnxruntime==1.16.3
whisper==1.1.10
pytest==7.4.3
pytest-asyncio==0.21.1
black==23.11.0
flake8==6.1.0
alembic==1.12.1
python-multipart==0.0.6
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
EOF

# Create frontend package.json
cat > software/frontend/package.json << 'EOF'
{
  "name": "wit-terminal-frontend",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "typescript": "^5.3.2",
    "axios": "^1.6.2",
    "socket.io-client": "^4.7.2",
    "@reduxjs/toolkit": "^1.9.7",
    "react-redux": "^8.1.3",
    "tailwindcss": "^3.3.6",
    "recharts": "^2.10.3",
    "react-three-fiber": "^8.15.11",
    "@react-three/drei": "^9.88.17",
    "lucide-react": "^0.294.0"
  },
  "scripts": {
    "start": "vite",
    "build": "tsc && vite build",
    "test": "vitest",
    "lint": "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
  },
  "devDependencies": {
    "@types/react": "^18.2.42",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.7",
    "vitest": "^1.0.1",
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.13.2",
    "@typescript-eslint/parser": "^6.13.2"
  }
}
EOF

# Create development setup script
cat > tools/scripts/setup-dev-environment.sh << 'EOF'
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
EOF

chmod +x tools/scripts/setup-dev-environment.sh

# Create initial test structure
cat > tests/README.md << 'EOF'
# W.I.T. Test Suite

Comprehensive testing for all W.I.T. components.

## Test Categories
- **Unit Tests**: Individual component testing
- **Integration Tests**: Inter-component communication
- **System Tests**: End-to-end functionality
- **Performance Tests**: Latency, throughput, resource usage

## Running Tests
```bash
# Run all tests
make test

# Run specific test suite
pytest tests/unit/
pytest tests/integration/

# Run with coverage
pytest --cov=software/backend tests/
```

## Test Requirements
- Voice latency: <100ms end-to-end
- Vision processing: 30fps minimum
- API response time: <50ms p95
- Equipment control latency: <10ms
EOF

# Create GitHub Actions workflow
mkdir -p .github/workflows
cat > .github/workflows/ci.yml << 'EOF'
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test-firmware:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup ARM toolchain
        run: |
          sudo apt-get update
          sudo apt-get install -y gcc-arm-none-eabi
      - name: Build firmware
        run: make -C firmware build
      - name: Run firmware tests
        run: make -C firmware test

  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          pip install -r software/backend/requirements.txt
      - name: Run tests
        run: |
          cd software/backend
          pytest --cov=.

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install dependencies
        run: |
          cd software/frontend
          npm ci
      - name: Run tests
        run: |
          cd software/frontend
          npm test
      - name: Build
        run: |
          cd software/frontend
          npm run build
EOF

echo "✅ W.I.T. Project repository structure initialized!"
echo ""
echo "Next steps:"
echo "1. Initialize git repository: git init"
echo "2. Add files: git add ."
echo "3. Initial commit: git commit -m 'Initial W.I.T. project structure'"
echo "4. Add remote: git remote add origin https://github.com/[your-org]/wit-terminal.git"
echo "5. Push: git push -u origin main"
echo ""
echo "To set up development environment:"
echo "./tools/scripts/setup-dev-environment.sh"