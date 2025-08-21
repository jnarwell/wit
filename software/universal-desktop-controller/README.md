# W.I.T. Universal Desktop Controller

The Universal Desktop Controller (UDC) is the desktop companion app for the W.I.T. platform. It manages all connections between the W.I.T. web interface and local desktop resources including printers, software applications, files, and hardware devices.

## Current Integrations

### ✅ **Production Ready**
- **Arduino IDE** - Full serial communication and sketch management
- **Unified 3D Slicers** - PrusaSlicer, OrcaSlicer, Bambu Studio, SuperSlicer, Cura
- **MATLAB** - Computational analysis and simulation (basic integration)

- **KiCad** - PCB design software integration
- **File Browser** - Local file system access and management
- **Fusion 360** - Professional CAD/CAM integration with Autodesk Fusion 360

### 🚧 **In Development**
- **Printer Bridge** - Direct printer control and monitoring

## Architecture

The UDC uses a plugin-based architecture where each integration (printer, Arduino IDE, etc.) is implemented as a plugin. This provides:

- **Modularity**: Easy to add new integrations
- **Security**: Granular permissions per plugin
- **Maintainability**: Isolated plugin code
- **Performance**: Shared core services

## Core Components

### 1. **EventBus** (`src/core/EventBus.js`)
Central communication system for all components. Uses an event-driven architecture for loose coupling.

### 2. **PluginManager** (`src/core/PluginManager.js`)
Manages plugin lifecycle: loading, starting, stopping, and message routing.

### 3. **WebSocketManager** (`src/core/WebSocketManager.js`)
Maintains persistent connection to W.I.T. backend with automatic reconnection.

### 4. **SecurityManager** (`src/core/SecurityManager.js`)
Handles plugin permissions with user approval dialogs.

### 5. **ConfigManager** (`src/core/ConfigManager.js`)
Manages all configuration with secure storage using electron-store.

## Plugin Development

### Creating a Plugin

1. Create a new directory in `plugins/`
2. Add `manifest.json`:
```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Description of my plugin",
  "main": "index.js",
  "permissions": ["file:read", "network:http"]
}
```

3. Create `index.js`:
```javascript
const { WITPlugin } = require('../../src/plugins/base/WITPlugin');

class MyPlugin extends WITPlugin {
    async initialize() {
        await super.initialize();
        // Setup code
    }
    
    async start() {
        await super.start();
        // Start services
    }
    
    async stop() {
        // Cleanup
        await super.stop();
    }
    
    async onMessage(message) {
        const { action, payload } = message;
        
        switch (action) {
            case 'doSomething':
                return await this.doSomething(payload);
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }
    
    async doSomething(data) {
        // Plugin logic
        return { success: true, result: data };
    }
}

module.exports = MyPlugin;
```

### Available Permissions

- `file:read` - Read files from file system
- `file:write` - Write files to file system
- `file:delete` - Delete files
- `network:http` - Make HTTP requests
- `network:websocket` - Create WebSocket connections
- `system:execute` - Execute system commands
- `hardware:serial` - Access serial ports
- `hardware:usb` - Access USB devices
- `app:launch` - Launch external applications
- `clipboard:read` - Read clipboard
- `clipboard:write` - Write to clipboard

## Development

### Setup
```bash
cd software/universal-desktop-controller
npm install
```

### Run in Development
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

## WebSocket Protocol

### Message Format
```javascript
{
    id: "unique-message-id",
    timestamp: 1234567890,
    type: "message-type",
    pluginId: "target-plugin",
    action: "action-name",
    payload: { /* action data */ }
}
```

### Message Types

#### From Controller → Backend
- `register` - Register controller with backend
- `plugin_message` - Message from a plugin
- `status_update` - Controller/plugin status update
- `error` - Error notification

#### From Backend → Controller
- `plugin_command` - Command for a plugin
- `config_update` - Configuration update
- `ping` - Keep-alive check

## Security

The UDC implements multiple security layers:

1. **Plugin Sandboxing**: Plugins run with restricted permissions
2. **User Approval**: All permissions require user consent
3. **Secure Storage**: Sensitive data encrypted using OS keychain
4. **Network Security**: TLS for all communications

## Configuration

Configuration is stored in:
- **Windows**: `%APPDATA%\wit-universal-desktop-controller\config.json`
- **macOS**: `~/Library/Application Support/wit-universal-desktop-controller/config.json`
- **Linux**: `~/.config/wit-universal-desktop-controller/config.json`

## Logs

Logs are stored in:
- **Windows**: `%APPDATA%\.wit\logs\`
- **macOS**: `~/.wit/logs/`
- **Linux**: `~/.wit/logs/`

## Troubleshooting

### Controller won't connect
1. Check W.I.T. server URL in settings
2. Verify auth token is correct (you can find your token in W.I.T. web UI under Settings > Security > API Authentication Token)
3. Check firewall settings
4. Review logs for errors

### Plugin won't load
1. Check manifest.json is valid
2. Verify main file exists
3. Check for syntax errors
4. Review permission requirements

## TODO

- [ ] Add system tray icon assets
- [ ] Implement auto-updater
- [ ] Add plugin marketplace UI
- [ ] Create example plugins
- [ ] Add integration tests
- [ ] Improve error handling
- [ ] Add performance monitoring
- [ ] Add individual parameter support for Bambu Studio CLI
- [ ] Implement resin slicer support (CHITUBOX, Lychee)
- [ ] Add thumbnail extraction for G-code files

## License

MIT License - See LICENSE file for details