# W.I.T. (Workshop Interface Technology)

<div align="center">
  <img src="docs/images/wit-logo.png" alt="W.I.T. Logo" width="200">
  
  **An Industrial Workshop Terminal System**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Status: Active Development](https://img.shields.io/badge/Status-Active%20Development-green.svg)]()
  
  [Documentation](docs/) | [Quick Start](docs/QUICKSTART.md) | [Contributing](CONTRIBUTING.md) | [Changelog](CHANGELOG.md)
</div>

## Overview

W.I.T. is a comprehensive industrial workshop terminal system that unifies equipment control, project management, and AI assistance into a single platform. Built with security, extensibility, and industrial reliability in mind, W.I.T. serves as the central hub for modern workshops, makerspaces, and small-scale manufacturing facilities.

## 🎯 Key Features

### Equipment Management
- **Universal Machine Control**: Unified interface for 3D printers, CNC machines, and other workshop equipment
- **Auto-Discovery**: Automatic detection of network-connected and USB devices
- **Real-time Monitoring**: Live status updates via WebSocket connections
- **Multi-Protocol Support**: PrusaLink, OctoPrint, GRBL, LinuxCNC, and more

### AI Integration
- **Multi-Provider Support**: Claude, OpenAI, Google Gemini, and local models via Ollama
- **Voice Commands**: Natural language control with wake word detection
- **Vision Processing**: Computer vision for safety monitoring and quality control
- **Context-Aware Assistance**: AI that understands your workshop context

### Project Management
- **Task Tracking**: Organize work with projects, tasks, and team collaboration
- **File Management**: Integrated file browser with version control support
- **Documentation**: Built-in documentation viewer for PDFs, images, and code

### Desktop Integration
- **Universal Desktop Controller (UDC)**: Plugin-based desktop companion app
- **Arduino IDE Integration**: Direct integration with Arduino development
- **MATLAB Integration**: Full computational analysis with real MATLAB engine
- **3D Slicer Control**: Unified interface for PrusaSlicer, OrcaSlicer, and more
- **KiCad Integration**: PCB design and schematic capture
- **Node-RED Integration**: Visual IoT automation and sensor workflows
- **Application Launcher**: Launch and control desktop applications
- **File System Monitoring**: Watch for project file changes

### Procurement Integration
- **Component Suppliers**: DigiKey, Mouser for electronic parts
- **Hardware Suppliers**: McMaster-Carr for mechanical components  
- **PCB Manufacturing**: JLCPCB, PCBWay, OSHCut for board fabrication
- **Custom Manufacturing**: Xometry, Protolabs for CNC and 3D printing

### Industrial Interface
- **No-Scroll Design**: All critical information visible without scrolling
- **High-Contrast Theme**: Black-on-white blocky design for workshop visibility
- **Touch-Optimized**: Large touch targets for gloved hands
- **Status at a Glance**: Color-coded status indicators

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- PostgreSQL 12+
- Redis (optional, for caching)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/wit.git
   cd wit
   ```

2. **Backend Setup**
   ```bash
   cd software/backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   
   # Configure environment
   cp .env.example .env
   # Edit .env with your settings
   
   # Run migrations
   alembic upgrade head
   
   # Start backend
   python dev_server.py
   ```

3. **Frontend Setup**
   ```bash
   cd software/frontend/web
   npm install
   npm run dev
   ```

4. **Universal Desktop Controller (Optional)**
   ```bash
   cd software/universal-desktop-controller
   npm install
   npm run dev
   ```

Visit `http://localhost:5173` to access the web interface.

## 📚 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md) - System design and components
- [API Reference](docs/API.md) - REST and WebSocket API documentation
- [Development Guide](docs/DEVELOPMENT.md) - Setup and contribution guidelines
- [Plugin Development](docs/PLUGINS.md) - Creating UDC plugins
- [Hardware Integration](docs/HARDWARE.md) - Connecting workshop equipment
- [Deployment Guide](docs/DEPLOYMENT.md) - Production deployment instructions

## 🏗️ Project Structure

```
wit/
├── docs/                    # Documentation
├── hardware/               # Hardware designs and specifications
├── firmware/               # Embedded system firmware
├── software/
│   ├── backend/           # FastAPI backend server
│   ├── frontend/          # React web interface
│   └── universal-desktop-controller/  # Electron desktop app
├── tests/                  # Test suites
└── tools/                  # Development utilities
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:
- Code of conduct
- Development setup
- Submitting pull requests
- Coding standards

### Areas We Need Help
- 🔌 Hardware driver development
- 🎤 Voice processing optimization
- 👁️ Computer vision algorithms
- 🔧 Equipment integrations
- 📚 Documentation improvements
- 🧪 Testing and validation

## 🛠️ Technology Stack

### Backend
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Real-time**: WebSocket connections
- **Message Queue**: MQTT for IoT communication
- **AI Integration**: LangChain, Anthropic SDK

### Frontend
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS with industrial theme
- **State Management**: React Context API
- **Real-time Updates**: WebSocket client
- **3D Visualization**: Three.js

### Desktop Controller
- **Framework**: Electron
- **Plugin System**: Dynamic module loading
- **IPC**: Secure inter-process communication
- **Native Integration**: Node.js native modules

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

This project incorporates ideas and architectural patterns learned from studying various open-source projects. See [ATTRIBUTIONS.md](docs/ATTRIBUTIONS.md) for detailed acknowledgments.

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/yourusername/wit/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/wit/discussions)
- **Discord**: [W.I.T. Community](https://discord.gg/wit-makers)

---

<div align="center">
  Built with ❤️ for the maker community
</div>