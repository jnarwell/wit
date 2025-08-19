# W.I.T. Universal Desktop Controller (UDC)
**A unified desktop integration platform for all W.I.T. services**

## Overview
The Universal Desktop Controller (UDC) is a single desktop application that manages ALL connections between W.I.T. web platform and local desktop resources, including:
- 3D Printers (PrusaLink, OctoPrint, etc.)
- Software Applications (Arduino IDE, Fusion 360, KiCad, etc.)
- File System Access
- Hardware Devices (Serial ports, USB devices)
- Local Services (Databases, servers, etc.)

## Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    W.I.T. Web Platform                      │
└─────────────────────────────────┬───────────────────────────┘
                                  │ WebSocket
                    ┌─────────────▼──────────────┐
                    │   Universal Desktop        │
                    │      Controller            │
                    │  ┌──────────────────────┐  │
                    │  │    Core Services     │  │
                    │  ├──────────────────────┤  │
                    │  │ WebSocket Manager    │  │
                    │  │ Plugin System        │  │
                    │  │ Security Manager     │  │
                    │  │ File System Monitor  │  │
                    │  │ Process Manager      │  │
                    │  │ Event Bus           │  │
                    │  └──────────────────────┘  │
                    │                            │
                    │  ┌──────────────────────┐  │
                    │  │      Plugins         │  │
                    │  ├──────────────────────┤  │
                    │  │ 🖨️  Printer Bridge   │  │
                    │  │ 🤖 Arduino IDE       │  │
                    │  │ ⚡ KiCad            │  │
                    │  │ 🎨 Fusion 360       │  │
                    │  │ 📁 File Browser     │  │
                    │  │ 🔧 Serial Monitor   │  │
                    │  │ ... more plugins    │  │
                    │  └──────────────────────┘  │
                    └────────────────────────────┘
```

## Plugin Architecture

### Base Plugin Interface
```typescript
interface WITPlugin {
  // Metadata
  id: string;
  name: string;
  version: string;
  description: string;
  icon: string;
  
  // Lifecycle
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  destroy(): Promise<void>;
  
  // Capabilities
  capabilities: PluginCapability[];
  
  // Message handling
  onMessage(message: PluginMessage): Promise<any>;
  
  // Status
  getStatus(): PluginStatus;
}

interface PluginCapability {
  id: string;
  type: 'printer' | 'application' | 'hardware' | 'file' | 'service';
  actions: string[];
}
```

## Core Services

### 1. WebSocket Manager
```javascript
class WebSocketManager {
  constructor() {
    this.connections = new Map();
    this.reconnectInterval = 5000;
  }
  
  connect(url, credentials) {
    // Maintains persistent connection to W.I.T. backend
    // Handles reconnection automatically
    // Routes messages to appropriate plugins
  }
  
  sendMessage(pluginId, message) {
    // Send plugin messages to backend
  }
  
  broadcast(event) {
    // Broadcast events to all plugins
  }
}
```

### 2. Plugin System
```javascript
class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.pluginDirectory = path.join(app.getPath('userData'), 'plugins');
  }
  
  async loadPlugin(pluginPath) {
    // Dynamic plugin loading
    // Sandbox execution
    // Version management
  }
  
  async enablePlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    await plugin.initialize();
    await plugin.start();
  }
  
  routeMessage(message) {
    // Route messages to appropriate plugin
    const plugin = this.plugins.get(message.pluginId);
    return plugin.onMessage(message);
  }
}
```

### 3. Security Manager
```javascript
class SecurityManager {
  constructor() {
    this.permissions = new Map();
    this.whitelist = new Set();
  }
  
  async requestPermission(pluginId, permission) {
    // Show user prompt for permission
    // Store decision
    // Apply sandbox restrictions
  }
  
  validateAccess(pluginId, resource) {
    // Check if plugin has access to resource
    // Enforce file system boundaries
    // Validate network requests
  }
}
```

## Built-in Plugins

### 1. Printer Bridge Plugin
Migrated from standalone `wit_printer_bridge.py`:
```javascript
class PrinterBridgePlugin extends WITPlugin {
  constructor() {
    super();
    this.id = 'printer-bridge';
    this.printers = new Map();
  }
  
  async connectPrinter(config) {
    // PrusaLink connection
    // OctoPrint connection
    // Serial connection
  }
  
  async sendGcode(printerId, gcode) {
    // Send commands to printer
  }
}
```

### 2. Arduino IDE Plugin
```javascript
class ArduinoPlugin extends WITPlugin {
  constructor() {
    super();
    this.id = 'arduino-ide';
    this.arduinoCli = new ArduinoCLI();
  }
  
  capabilities = [
    {
      id: 'arduino-control',
      type: 'application',
      actions: ['launch', 'compile', 'upload', 'monitor']
    }
  ];
  
  async launch() {
    // Launch Arduino IDE
    // Monitor sketch files
    // Provide real-time updates
  }
}
```

### 3. File Browser Plugin
```javascript
class FileBrowserPlugin extends WITPlugin {
  constructor() {
    super();
    this.id = 'file-browser';
    this.watchers = new Map();
  }
  
  async watchDirectory(path, callback) {
    // Monitor directory for changes
    // Apply security restrictions
    // Stream changes to web
  }
}
```

## Communication Protocol

### Message Format
```typescript
interface UDCMessage {
  id: string;          // Unique message ID
  timestamp: number;   // Unix timestamp
  pluginId: string;    // Target plugin
  action: string;      // Action to perform
  payload: any;        // Action-specific data
  auth?: string;       // Optional auth token
}

// Example messages
{
  id: "msg-123",
  pluginId: "arduino-ide",
  action: "compile",
  payload: {
    sketch: "/Users/john/Arduino/Blink/Blink.ino",
    board: "arduino:avr:uno"
  }
}

{
  id: "msg-124", 
  pluginId: "printer-bridge",
  action: "sendGcode",
  payload: {
    printerId: "M1755456196907",
    gcode: "M104 S200"
  }
}
```

## Implementation Plan

### Phase 1: Core Framework (Week 1)
```
/software/universal-desktop-controller/
├── src/
│   ├── main.js                 # Electron main process
│   ├── core/
│   │   ├── WebSocketManager.js
│   │   ├── PluginManager.js
│   │   ├── SecurityManager.js
│   │   ├── EventBus.js
│   │   └── ProcessManager.js
│   ├── plugins/              
│   │   └── base/
│   │       └── WITPlugin.js    # Base plugin class
│   └── ui/
│       ├── tray.js             # System tray
│       └── settings.html       # Settings window
├── plugins/                    # Built-in plugins
│   ├── printer-bridge/
│   ├── arduino-ide/
│   ├── file-browser/
│   └── serial-monitor/
└── package.json
```

### Phase 2: Migrate Existing (Week 2)
1. Convert `wit_printer_bridge.py` to JavaScript plugin
2. Implement Arduino IDE plugin
3. Create file browser plugin
4. Add serial monitor plugin

### Phase 3: Enhanced Features (Week 3)
1. Plugin marketplace UI
2. Auto-update system
3. Performance monitoring
4. Error reporting

### Phase 4: Production Ready (Week 4)
1. Code signing
2. Installers for all platforms
3. Documentation
4. Security audit

## Benefits of Universal Controller

### 1. **Single Installation**
- Users install ONE application
- All integrations work through it
- Easier to maintain and update

### 2. **Consistent Security**
- One permission system
- Centralized security updates
- Better user trust

### 3. **Resource Efficiency**
- One WebSocket connection
- Shared services (file monitoring, etc.)
- Lower memory footprint

### 4. **Extensibility**
- Easy to add new integrations
- Plugin marketplace potential
- Community contributions

### 5. **Better UX**
- One system tray icon
- Unified settings
- Single download from W.I.T.

## Migration Path

### From Individual Scripts to UDC
1. **Printer Bridge**: 
   - Current: `wit_printer_bridge.py`
   - New: `printer-bridge` plugin
   - Benefits: Multiple printer support, better UI

2. **Arduino Integration**:
   - Current: Planned separate app
   - New: `arduino-ide` plugin
   - Benefits: Shares file monitoring, WebSocket

3. **Future Integrations**:
   - All new integrations as plugins
   - Consistent API
   - Faster development

## Security Considerations

### Sandboxing
- Each plugin runs in restricted context
- Limited file system access
- Network request validation

### Permissions
- User approves each plugin's permissions
- Granular control (read/write/execute)
- Revocable at any time

### Updates
- Signed updates only
- Automatic security patches
- Plugin version management

## Success Metrics
1. ✅ Single installer for all desktop integrations
2. ✅ <5 second connection time to W.I.T.
3. ✅ Support 10+ different integrations
4. ✅ <100MB memory usage with all plugins
5. ✅ 99.9% uptime for WebSocket connection

---
*The Universal Desktop Controller provides a solid foundation for all current and future desktop integrations, making W.I.T. truly powerful while remaining easy to use.*