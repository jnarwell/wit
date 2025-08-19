# W.I.T. Current Functionality

This document describes the currently implemented and working features in the W.I.T. platform as of January 2025.

## ✅ Implemented Features

### 1. Authentication & User Management

#### Working:
- User registration with email/password
- JWT-based authentication
- Login/logout functionality
- User profile management
- Session persistence
- Protected routes

#### API Endpoints:
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/token` - OAuth2 token login
- `POST /api/v1/auth/login` - JSON login
- `GET /api/v1/auth/me` - Get current user

### 2. 3D Printer Management

#### Working:
- Add/remove printers
- Real-time status monitoring via WebSocket
- Temperature control (bed and nozzle)
- Manual printer discovery
- PrusaLink integration (with limitations)
- Command sending (limited by printer API)

#### API Endpoints:
- `GET /api/v1/equipment/printers` - List all printers
- `POST /api/v1/equipment/printers` - Add new printer
- `GET /api/v1/equipment/printers/{id}` - Get printer status
- `DELETE /api/v1/equipment/printers/{id}` - Remove printer
- `POST /api/v1/equipment/printers/{id}/commands` - Send commands
- `POST /api/v1/equipment/printers/{id}/temperature` - Set temperature
- `GET /api/v1/equipment/printers/discover` - Discover printers
- `POST /api/v1/equipment/printers/test` - Test connection

#### WebSocket Endpoints:
- `/ws/printers` - Real-time printer updates
- `/ws/printers/{id}` - Printer-specific updates
- `/ws/printer-bridge/{id}` - Printer bridge connection

### 3. Project Management

#### Working:
- Create/edit/delete projects
- Task management within projects
- Project member management
- File association with projects
- Project status tracking

#### API Endpoints:
- `GET /api/v1/projects/` - List projects
- `POST /api/v1/projects/` - Create project
- `GET /api/v1/projects/{id}` - Get project details
- `PUT /api/v1/projects/{id}` - Update project
- `DELETE /api/v1/projects/{id}` - Delete project
- `GET /api/v1/projects/{id}/tasks` - Get project tasks
- `POST /api/v1/projects/{id}/tasks` - Create task
- `GET /api/v1/projects/{id}/members` - Get members
- `DELETE /api/v1/projects/{id}/members/{user_id}` - Remove member

### 4. AI Integration

#### Working:
- Multi-provider support (Claude, OpenAI, Gemini, Ollama)
- Provider configuration management
- Terminal AI queries
- Context-aware responses
- Tool execution support

#### Configuration:
- Environment variable fallback
- Per-user provider settings
- Model selection
- API key management

### 5. Universal Desktop Controller (UDC)

#### Working:
- Core plugin architecture
- WebSocket connection to backend
- System tray integration
- Settings UI with IPC
- Security permission system
- Arduino IDE plugin

#### Components:
- EventBus for inter-component communication
- PluginManager for plugin lifecycle
- WebSocketManager for backend connection
- SecurityManager for permissions
- ConfigManager for settings

#### Arduino Plugin Features:
- Launch Arduino IDE
- Sketch file detection
- Board detection
- Compile functionality
- Upload to board
- Serial monitor

### 6. Web Interface

#### Working Pages:
- **Dashboard**: System overview with widget grid
- **Machines**: Equipment list and management
- **Machine Detail**: Individual machine control
- **Projects**: Project list and creation
- **Project Detail**: Tabbed interface with tasks, files, team
- **Terminal**: AI-powered command interface
- **Settings**: User preferences and system configuration
- **Software Integrations**: External software management

#### UI Features:
- Industrial black-on-white theme
- No-scroll design philosophy
- Responsive grid layouts
- Real-time WebSocket updates
- Status color coding
- Touch-optimized controls

### 7. File Management

#### Working:
- File upload system
- Project file browser
- User file storage
- File type detection
- Preview for images and PDFs

### 8. Real-time Communication

#### Working:
- WebSocket server implementation
- Automatic reconnection
- Event-based updates
- Multi-client broadcasting
- Connection state management

## 🚧 Partially Implemented

### 1. Voice Control
- Backend structure exists
- Wake word detection planned
- Speech-to-text integration ready
- Not connected to frontend

### 2. Vision Processing
- API endpoints defined
- YOLO model integration planned
- Safety monitoring framework
- Requires hardware integration

### 3. OAuth Integration
- Google OAuth callback implemented
- Frontend flow incomplete
- Token exchange working
- UI integration needed

### 4. Machine Discovery
- Manual discovery working
- Auto-discovery framework exists
- Network scanning implemented
- mDNS discovery for OctoPrint ready

### 5. MQTT Integration
- Broker configuration exists
- Service implementation ready
- Not fully integrated with machines
- Topic structure defined

## ❌ Not Yet Implemented

### 1. Mobile App
- React Native structure exists
- No functional implementation
- API compatibility ready

### 2. Hardware Terminal
- Firmware structure defined
- No hardware implementation
- Protocol specifications ready

### 3. Advanced CNC Support
- GRBL structure exists
- LinuxCNC framework ready
- No active implementation

### 4. Production Deployment
- Docker configurations exist
- Kubernetes manifests defined
- CI/CD pipeline planned
- Not production-ready

## 🔧 Known Limitations

### 1. PrusaLink Integration
- Cannot send direct G-code commands
- Temperature control works via API
- File upload method required for G-code
- Status polling has rate limits

### 2. Authentication
- No email verification active
- Password reset not implemented
- Role-based permissions defined but not enforced
- API key authentication incomplete

### 3. File Storage
- Local filesystem only
- No cloud storage integration
- No versioning system
- Limited file type support

### 4. Performance
- No caching layer active
- Database queries not optimized
- No horizontal scaling support
- WebSocket connections not clustered

## 🎯 Testing Coverage

### Backend
- Unit tests for core services
- Integration tests for API endpoints
- Machine manager test suite
- Database service tests

### Frontend
- Component rendering tests
- No end-to-end tests
- Limited integration tests

### UDC
- Plugin system tests
- IPC communication tests
- No automated UI tests

## 📝 Configuration Requirements

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost/wit

# Authentication
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# AI Providers (optional)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# File Storage
UPLOAD_FOLDER=./wit_storage/uploads
PROJECT_FOLDER=./wit_storage/projects
```

### Required Services
- PostgreSQL 12+
- Python 3.8+
- Node.js 16+
- Redis (optional)

### Network Requirements
- Port 8000: Backend API
- Port 5173: Frontend dev server
- Port 3000: UDC application
- WebSocket support required

## 🚀 Getting Started

To use the current functionality:

1. Start the backend server
2. Run database migrations
3. Start the frontend dev server
4. Create a user account
5. Add equipment via the UI
6. Create projects and tasks
7. Optionally run UDC for desktop integration

See [QUICKSTART.md](QUICKSTART.md) for detailed setup instructions.