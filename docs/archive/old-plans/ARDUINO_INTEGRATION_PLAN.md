# W.I.T. Arduino IDE Integration - Comprehensive Implementation Plan

## Overview
This document outlines the complete plan for integrating Arduino IDE with the W.I.T. platform, enabling AI-assisted embedded development directly from the web interface.

## Architecture Diagram
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   W.I.T. Web    │     │  W.I.T. Backend  │     │ Desktop Agent   │
│   Interface     │────▶│   (FastAPI)      │────▶│  (Local)        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                         │
         │                       │                         ▼
         │                       │                 ┌─────────────────┐
         │                       │                 │  Arduino CLI    │
         │                       │                 │  Arduino IDE    │
         │                       │                 └─────────────────┘
         │                       │
         └───────────────────────┴─────── AI Assistant Integration
```

## Phase 1: Desktop Agent Foundation (Week 1)

### 1.1 Desktop Agent Base Structure
**Location**: `/software/desktop-agent/`

```
desktop-agent/
├── src/
│   ├── main.js                 # Main electron/node.js app
│   ├── arduino-controller.js    # Arduino-specific logic
│   ├── websocket-client.js     # WebSocket communication
│   ├── file-monitor.js         # File system watching
│   └── utils/
│       ├── arduino-cli.js      # Arduino CLI wrapper
│       └── security.js         # Permission handling
├── scripts/
│   ├── install.sh              # macOS/Linux installer
│   ├── install.ps1             # Windows installer
│   └── dev-run.sh             # Development runner
├── package.json
└── README.md
```

### 1.2 Core Features
- System tray application (Electron or Node.js + systray)
- Auto-start capability
- WebSocket connection to W.I.T. backend
- Arduino installation detection
- Basic security/permissions

### 1.3 Development Scripts
```bash
# Development mode (for now)
cd software/desktop-agent
npm install
npm run dev

# Future: One-click installer
# User downloads from W.I.T. web interface
```

## Phase 2: Arduino Integration (Week 1-2)

### 2.1 Arduino CLI Integration
**File**: `arduino-controller.js`

```javascript
class ArduinoController {
  constructor() {
    this.cliPath = this.detectArduinoCLI();
    this.sketches = new Map();
    this.boards = [];
    this.ports = [];
  }
  
  // Core functionality
  async detectArduinoCLI() { }
  async listBoards() { }
  async listPorts() { }
  async compileSketch(path, board) { }
  async uploadSketch(path, board, port) { }
  async monitorSerial(port, callback) { }
  
  // File operations
  async readSketch(path) { }
  async writeSketch(path, content) { }
  async createSketch(name, template) { }
}
```

### 2.2 File System Monitoring
**File**: `file-monitor.js`

```javascript
class ArduinoFileMonitor {
  constructor() {
    this.watchedDirs = new Set();
    this.changeCallbacks = new Map();
  }
  
  watchSketchDirectory(path, callback) {
    // Watch .ino, .h, .cpp files
    // Debounce rapid changes
    // Send updates via WebSocket
  }
  
  getArduinoDirectories() {
    // Default: ~/Arduino/
    // Also check Arduino IDE preferences
  }
}
```

### 2.3 Arduino CLI Commands
```bash
# Commands the agent will use
arduino-cli board list
arduino-cli compile --fqbn arduino:avr:uno MySketch
arduino-cli upload -p /dev/ttyUSB0 --fqbn arduino:avr:uno MySketch
arduino-cli monitor -p /dev/ttyUSB0 --config baudrate=115200
arduino-cli lib search <library>
arduino-cli lib install <library>
```

## Phase 3: Backend Integration (Week 2)

### 3.1 New API Endpoints
**Location**: `/software/backend/api/arduino_api.py`

```python
@router.websocket("/ws/arduino-agent/{user_id}")
async def arduino_agent_websocket(websocket: WebSocket, user_id: str):
    """WebSocket for desktop agent connection"""
    
@router.post("/api/v1/arduino/compile")
async def compile_sketch(request: CompileRequest):
    """Trigger compilation via agent"""
    
@router.post("/api/v1/arduino/upload")
async def upload_sketch(request: UploadRequest):
    """Upload to Arduino board"""
    
@router.get("/api/v1/arduino/boards")
async def list_boards():
    """Get available boards from agent"""
    
@router.get("/api/v1/arduino/sketches")
async def list_sketches():
    """List user's Arduino sketches"""
```

### 3.2 WebSocket Protocol
```javascript
// Agent → Backend
{
  type: "sketch_update",
  sketch_id: "MySketch",
  content: "void setup() { ... }",
  timestamp: "2024-01-01T00:00:00Z"
}

// Backend → Agent
{
  type: "compile_request",
  sketch_id: "MySketch",
  board: "arduino:avr:uno",
  request_id: "uuid"
}

// Agent → Backend (response)
{
  type: "compile_result",
  request_id: "uuid",
  success: true,
  output: "Sketch uses 1234 bytes...",
  errors: []
}
```

## Phase 4: Frontend Components (Week 2-3)

### 4.1 Arduino Workspace Page
**Location**: `/software/frontend/web/src/pages/ArduinoWorkspacePage.tsx`

```typescript
interface ArduinoWorkspaceProps {
  sketchId: string;
  agentConnected: boolean;
}

const ArduinoWorkspacePage: React.FC = () => {
  return (
    <div className="arduino-workspace">
      <ArduinoToolbar />
      <div className="workspace-layout">
        <FileExplorer />
        <CodeEditor />
        <SerialMonitor />
        <AIAssistant />
      </div>
    </div>
  );
};
```

### 4.2 Components
1. **ArduinoToolbar**: Board selection, port selection, compile/upload buttons
2. **CodeEditor**: Monaco editor with Arduino syntax highlighting
3. **SerialMonitor**: Real-time serial output with input capability
4. **AIAssistant**: Context-aware code suggestions

### 4.3 Software Page Integration
```typescript
// Update SoftwarePage.tsx
{
  name: 'Arduino IDE',
  description: 'Arduino development environment',
  status: 'connected', // When agent is running
  actions: [
    {
      label: 'Open Workspace',
      action: () => navigateToArduinoWorkspace()
    },
    {
      label: 'Download Agent',
      action: () => downloadDesktopAgent()
    }
  ]
}
```

## Phase 5: AI Integration (Week 3)

### 5.1 Arduino-Specific AI Capabilities
```python
# AI context includes:
- Current sketch code
- Compilation errors
- Serial output
- Board specifications
- Available libraries

# AI can:
- Generate code from natural language
- Fix compilation errors
- Suggest optimizations
- Add sensor/actuator code
- Explain code functionality
```

### 5.2 AI Prompts
```javascript
// Example AI interactions
"Add code to read from an ultrasonic sensor on pins 7 and 8"
"Why is my LED not blinking?"
"Optimize this code for power consumption"
"Convert this to use interrupts instead of polling"
```

## Phase 6: Packaging & Distribution (Week 4)

### 6.1 Installer Creation
```javascript
// electron-builder configuration
{
  "build": {
    "appId": "com.wit.desktop-agent",
    "productName": "WIT Desktop Agent",
    "directories": {
      "output": "dist"
    },
    "mac": {
      "category": "public.app-category.developer-tools"
    },
    "win": {
      "target": "nsis"
    },
    "linux": {
      "target": "AppImage"
    }
  }
}
```

### 6.2 Download System
1. Add download buttons to Software page
2. Detect user's OS and offer appropriate installer
3. Include setup instructions
4. Auto-update capability

### 6.3 Security Features
- Code signing (for production)
- Scoped file system access
- User approval for Arduino operations
- Secure WebSocket with authentication

## Implementation Timeline

### Week 1: Foundation
- [x] Create project structure
- [ ] Basic desktop agent
- [ ] Arduino CLI detection
- [ ] Simple WebSocket connection

### Week 2: Core Features  
- [ ] File monitoring
- [ ] Compile/upload functionality
- [ ] Backend API endpoints
- [ ] WebSocket protocol

### Week 3: UI & AI
- [ ] Arduino workspace UI
- [ ] Code editor component
- [ ] AI integration
- [ ] Serial monitor

### Week 4: Polish & Package
- [ ] Installer creation
- [ ] Download system
- [ ] Documentation
- [ ] Testing & bug fixes

## Success Criteria
1. ✅ User can launch Arduino IDE from W.I.T. web interface
2. ✅ Real-time code synchronization between IDE and web
3. ✅ Successful compile/upload from web interface
4. ✅ AI can modify code and fix errors
5. ✅ Serial monitor works in web interface
6. ✅ One-click installer for end users

## Future Enhancements
1. Library management UI
2. Board manager integration
3. Multi-sketch projects
4. Git integration
5. Collaborative editing
6. IoT cloud integration

## Notes
- Initial version uses development scripts
- Production version will have signed installers
- Consider Electron alternatives (Tauri) for smaller size
- May need different approaches for Arduino Web Editor users

---
*This plan provides a clear path from development scripts to production-ready software that users can download and install with one click.*