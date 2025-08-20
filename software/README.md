# W.I.T. Software Components

This directory contains all software components of the W.I.T. platform.

## Directory Structure

```
software/
├── backend/                    # FastAPI backend server
├── frontend/                   # Web interfaces
│   └── web/                   # React web application
├── universal-desktop-controller/  # Electron desktop app
├── ai/                        # AI/ML components (planned)
└── mobile/                    # Mobile applications (planned)
```

## Components

### Backend (`backend/`)
The core API server built with FastAPI that handles:
- Authentication and user management
- Equipment control and monitoring
- Project and task management
- Connected accounts system (AI providers, procurement, project management)
- AI service integration
- WebSocket real-time updates
- File storage and management

**Tech Stack**: Python, FastAPI, PostgreSQL, SQLAlchemy, WebSocket

### Frontend Web (`frontend/web/`)
The main web interface for W.I.T. featuring:
- Industrial design system
- Real-time equipment monitoring
- Project management interface
- AI-powered terminal
- Settings and configuration
- Connected accounts for procurement integrations

**Tech Stack**: React, TypeScript, Tailwind CSS, Vite

### Universal Desktop Controller (`universal-desktop-controller/`)
Desktop companion application that provides:
- Plugin architecture for desktop integrations
- Arduino IDE integration
- MATLAB integration with real computational engine
- Unified 3D slicer control (PrusaSlicer, OrcaSlicer, BambuStudio)
- KiCad EDA integration for PCB design
- Node-RED visual IoT automation
- File Browser with complete file system access and management
- OpenSCAD programmatic 3D CAD modeling
- System tray interface
- Cross-platform support (Windows, macOS, Linux)
- Application launching capabilities

**Tech Stack**: Electron, Node.js, JavaScript

**Integrated Applications**:
- Arduino IDE - Full development environment integration
- MATLAB - Real-time code execution and visualization
- 3D Slicers - Unified control for multiple slicer applications

## Quick Start

Each component has its own setup instructions:

1. **Backend**: See [backend/README.md](backend/README.md)
2. **Frontend**: See [frontend/web/README.md](frontend/web/README.md)
3. **UDC**: See [universal-desktop-controller/README.md](universal-desktop-controller/README.md)

## Development

For detailed development instructions, see the main [Development Guide](../docs/DEVELOPMENT.md).

### Running All Components

```bash
# Terminal 1: Backend
cd backend
source venv/bin/activate
python dev_server.py

# Terminal 2: Frontend
cd frontend/web
npm run dev

# Terminal 3: UDC (optional)
cd universal-desktop-controller
npm run dev
```

## Architecture

The software follows a microservices-inspired architecture:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Web UI    │     │     UDC     │     │   Mobile    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                    │
       └───────────────────┴────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Backend   │
                    │     API      │
                    └──────┬──────┘
                           │
       ┌───────────────────┴────────────────────┐
       │                                        │
┌──────▼──────┐                         ┌──────▼──────┐
│  Database   │                         │   Hardware  │
└─────────────┘                         └─────────────┘
```

## Testing

Each component includes its own test suite:

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend/web
npm test

# UDC tests
cd universal-desktop-controller
npm test
```

## Deployment

See the main [Deployment Guide](../docs/DEPLOYMENT.md) for production deployment instructions.