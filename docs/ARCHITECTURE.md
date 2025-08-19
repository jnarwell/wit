# W.I.T. Architecture Overview

## System Architecture

W.I.T. follows a multi-layered architecture designed for modularity, scalability, and industrial reliability.

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interfaces                           │
├─────────────┬───────────────┬───────────────┬──────────────────┤
│   Web UI    │ Desktop App   │  Mobile App   │   Hardware UI    │
│  (React)    │    (UDC)      │ (React Native)│   (Terminal)     │
├─────────────┴───────────────┴───────────────┴──────────────────┤
│                      API Gateway Layer                           │
│              (FastAPI + WebSocket + MQTT)                        │
├─────────────────────────────────────────────────────────────────┤
│                    Business Logic Layer                          │
├──────────────┬────────────────┬─────────────┬──────────────────┤
│   Machine    │    Project     │     AI      │    Security      │
│  Management  │  Management    │  Services   │   & Auth         │
├──────────────┴────────────────┴─────────────┴──────────────────┤
│                      Data Access Layer                           │
│           (PostgreSQL + Redis + File Storage)                    │
├─────────────────────────────────────────────────────────────────┤
│                   Hardware Integration Layer                     │
├──────────────┬────────────────┬─────────────┬──────────────────┤
│   Serial/USB │  Network APIs  │    MQTT     │   GPIO/I2C       │
│  Connections │  (REST/WS)     │   Broker    │  Interfaces      │
└──────────────┴────────────────┴─────────────┴──────────────────┘
```

## Core Components

### 1. Backend Server (`software/backend/`)

The FastAPI-based backend serves as the central hub for all system operations.

#### Key Services:
- **Authentication Service**: JWT-based auth with OAuth2 support
- **Machine Manager**: Universal interface for all workshop equipment
- **AI Service**: Multi-provider AI integration (Claude, OpenAI, Gemini, Ollama)
- **Project Service**: Project and task management
- **File Service**: Secure file storage and management
- **Terminal Service**: Command-line interface with AI assistance

#### API Structure:
```
/api/v1/
├── auth/           # Authentication endpoints
├── equipment/      # Machine control and monitoring
├── projects/       # Project management
├── files/          # File operations
├── ai-config/      # AI provider configuration
├── terminal/       # Terminal interface
└── system/         # System monitoring
```

### 2. Web Frontend (`software/frontend/web/`)

React-based SPA with industrial design language.

#### Key Features:
- **No-scroll design**: All critical info visible without scrolling
- **Real-time updates**: WebSocket integration for live data
- **Component library**: Reusable industrial UI components
- **Responsive layout**: Works on desktop and tablet

#### Page Structure:
```
Pages/
├── Dashboard       # System overview
├── Machines        # Equipment management
├── Projects        # Project tracking
├── Terminal        # CLI interface
├── Settings        # Configuration
└── Software        # Integration management
```

### 3. Universal Desktop Controller (`software/universal-desktop-controller/`)

Electron-based desktop companion app with plugin architecture.

#### Core Modules:
- **EventBus**: Central event system for plugin communication
- **PluginManager**: Dynamic plugin loading and lifecycle
- **WebSocketManager**: Backend communication
- **SecurityManager**: Permission-based security model
- **ConfigManager**: User preferences and settings

#### Plugin System:
```javascript
class Plugin extends WITPlugin {
  async initialize() {
    // Plugin setup
  }
  
  async handleCommand(command, args) {
    // Command processing
  }
  
  async cleanup() {
    // Resource cleanup
  }
}
```

### 4. Machine Integration Layer

Provides unified control for diverse workshop equipment.

#### Supported Protocols:
- **Serial/USB**: Direct GCODE communication
- **OctoPrint API**: Full OctoPrint integration
- **PrusaLink**: Native Prusa printer support
- **GRBL**: CNC machine control
- **LinuxCNC**: Advanced CNC integration
- **Modbus**: Industrial equipment

#### Connection Types:
```python
class IMachineConnection(Protocol):
    async def connect(self) -> bool
    async def disconnect(self) -> None
    async def send_command(self, command: str) -> str
    async def get_status(self) -> Dict[str, Any]
```

### 5. AI Integration

Multi-provider AI system with tool support.

#### Providers:
- **Anthropic Claude**: Primary AI assistant
- **OpenAI GPT**: Alternative LLM support
- **Google Gemini**: Multimodal capabilities
- **Ollama**: Local model hosting

#### Capabilities:
- Natural language equipment control
- Code generation and analysis
- Vision-based quality control
- Voice command processing

## Data Flow

### Real-time Updates
```
Equipment → Backend → WebSocket → UI
    ↓          ↓          ↓        ↓
  Serial    Process    Broadcast  Update
```

### Command Execution
```
UI → API → Validation → Machine Manager → Equipment
 ↓     ↓        ↓             ↓              ↓
Input POST   Security    Route Command    Execute
```

### AI Processing
```
User Query → Terminal API → AI Service → Provider
     ↓            ↓             ↓           ↓
   Input      Parse Tools   Select Model  Process
```

## Security Model

### Authentication
- JWT tokens with refresh mechanism
- OAuth2 support (Google, GitHub)
- Role-based access control (RBAC)
- API key authentication for services

### Authorization
- Resource-based permissions
- Plugin sandboxing in UDC
- Secure file access controls
- Equipment operation restrictions

### Data Protection
- Encrypted sensitive data at rest
- TLS for all network communication
- Secure credential storage
- Audit logging for critical operations

## Deployment Architecture

### Development
```
├── Backend (port 8000)
├── Frontend Dev Server (port 5173)
├── PostgreSQL (port 5432)
├── Redis (port 6379)
└── MQTT Broker (port 1883)
```

### Production
```
├── Load Balancer
│   ├── Backend Cluster
│   ├── Static Asset CDN
│   └── WebSocket Server
├── Database Cluster
│   ├── Primary PostgreSQL
│   └── Read Replicas
├── Cache Layer
│   └── Redis Cluster
└── Message Queue
    └── MQTT Cluster
```

## Scalability Considerations

### Horizontal Scaling
- Stateless backend design
- WebSocket session affinity
- Database connection pooling
- Distributed caching

### Performance Optimization
- Lazy loading in frontend
- API response caching
- Database query optimization
- Asset bundling and compression

### Monitoring
- Prometheus metrics
- Distributed tracing
- Error tracking (Sentry)
- Performance monitoring

## Extension Points

### Adding New Equipment Types
1. Implement `IMachine` interface
2. Create connection handler
3. Add discovery mechanism
4. Register with Machine Manager

### Creating UDC Plugins
1. Extend `WITPlugin` base class
2. Define manifest.json
3. Implement required methods
4. Package and distribute

### Custom AI Tools
1. Define tool specification
2. Implement tool handler
3. Register with AI Service
4. Add frontend support

## Technology Decisions

### Why FastAPI?
- Async/await support for concurrent operations
- Automatic API documentation
- WebSocket support built-in
- High performance with Python

### Why React?
- Component reusability
- Large ecosystem
- TypeScript support
- Proven in production

### Why PostgreSQL?
- ACID compliance for critical data
- JSON support for flexible schemas
- Full-text search capabilities
- Excellent performance

### Why MQTT?
- Lightweight for IoT devices
- Pub/sub model for equipment events
- QoS levels for reliability
- Industry standard protocol