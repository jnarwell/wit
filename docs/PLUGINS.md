# W.I.T. Universal Desktop Controller Plugin Development Guide

## Overview

The Universal Desktop Controller (UDC) uses a plugin architecture that allows developers to extend its functionality. Plugins can integrate with desktop applications, control hardware, or add new features to the W.I.T. ecosystem.

## Plugin Architecture

### Core Concepts

1. **Event-Driven**: Plugins communicate through the EventBus
2. **Permission-Based**: All plugin actions require user permissions
3. **Sandboxed**: Plugins run in isolated contexts
4. **Lifecycle Management**: Plugins have defined initialization and cleanup phases

### Plugin Structure

```
my-plugin/
├── manifest.json       # Plugin metadata and configuration
├── index.js           # Main plugin file
├── package.json       # Node.js dependencies
├── README.md          # Plugin documentation
└── assets/            # Icons and other resources
    └── icon.png
```

## Creating Your First Plugin

### Step 1: Create Plugin Directory

```bash
cd software/universal-desktop-controller/plugins
mkdir my-awesome-plugin
cd my-awesome-plugin
```

### Step 2: Create Manifest File

Create `manifest.json`:

```json
{
  "id": "my-awesome-plugin",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "description": "Does awesome things with W.I.T.",
  "author": "Your Name",
  "main": "index.js",
  "icon": "assets/icon.png",
  "permissions": [
    "system.exec",
    "filesystem.read",
    "filesystem.write",
    "network.request"
  ],
  "settings": {
    "defaultPath": {
      "type": "string",
      "default": "~/Documents",
      "label": "Default Path",
      "description": "Default working directory"
    },
    "enableFeatureX": {
      "type": "boolean",
      "default": true,
      "label": "Enable Feature X",
      "description": "Enables the experimental Feature X"
    }
  },
  "commands": {
    "doSomething": {
      "description": "Execute the main plugin action",
      "parameters": {
        "target": {
          "type": "string",
          "required": true,
          "description": "Target for the action"
        }
      }
    }
  }
}
```

### Step 3: Create Main Plugin File

Create `index.js`:

```javascript
const { WITPlugin } = require('../../src/core/WITPlugin');
const path = require('path');
const { spawn } = require('child_process');

class MyAwesomePlugin extends WITPlugin {
  constructor(config, eventBus, securityManager) {
    super(config, eventBus, securityManager);
    this.activeProcesses = new Map();
  }

  async initialize() {
    this.log('Initializing My Awesome Plugin');
    
    // Subscribe to events
    this.eventBus.on('user.action', this.handleUserAction.bind(this));
    
    // Register WebSocket handlers
    this.registerWebSocketHandlers();
    
    // Initialize plugin state
    await this.loadState();
    
    this.log('My Awesome Plugin initialized successfully');
  }

  registerWebSocketHandlers() {
    // Handle commands from the frontend
    this.eventBus.on('plugin.command', async (data) => {
      if (data.plugin !== this.id) return;
      
      try {
        const result = await this.handleCommand(data.command, data.args);
        this.eventBus.emit('plugin.response', {
          plugin: this.id,
          command: data.command,
          result: result,
          requestId: data.requestId
        });
      } catch (error) {
        this.eventBus.emit('plugin.error', {
          plugin: this.id,
          command: data.command,
          error: error.message,
          requestId: data.requestId
        });
      }
    });
  }

  async handleCommand(command, args) {
    this.log(`Handling command: ${command}`, args);
    
    switch (command) {
      case 'doSomething':
        return await this.doSomething(args);
      case 'getStatus':
        return await this.getStatus();
      case 'configure':
        return await this.configure(args);
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  async doSomething(args) {
    // Check permissions
    const hasPermission = await this.checkPermission('system.exec');
    if (!hasPermission) {
      throw new Error('Permission denied: system.exec');
    }

    // Validate arguments
    if (!args.target) {
      throw new Error('Missing required parameter: target');
    }

    // Execute the action
    this.log('Doing something awesome with:', args.target);
    
    // Example: Launch a process
    const process = spawn('echo', ['Doing something with', args.target]);
    
    return new Promise((resolve, reject) => {
      let output = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            output: output.trim()
          });
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });
    });
  }

  async getStatus() {
    return {
      active: true,
      processes: this.activeProcesses.size,
      config: this.config
    };
  }

  async configure(settings) {
    // Update configuration
    Object.assign(this.config, settings);
    await this.saveConfig();
    
    this.eventBus.emit('plugin.configured', {
      plugin: this.id,
      settings: settings
    });
    
    return { success: true };
  }

  async cleanup() {
    this.log('Cleaning up My Awesome Plugin');
    
    // Stop any active processes
    for (const [pid, process] of this.activeProcesses) {
      process.kill();
    }
    
    // Save state
    await this.saveState();
    
    // Remove event listeners
    this.eventBus.removeAllListeners('user.action');
    
    this.log('My Awesome Plugin cleaned up');
  }

  // Helper methods
  
  async loadState() {
    // Load persisted state from disk
    try {
      const statePath = path.join(this.dataPath, 'state.json');
      // Implementation here
    } catch (error) {
      this.log('No previous state found');
    }
  }

  async saveState() {
    // Save state to disk
    const statePath = path.join(this.dataPath, 'state.json');
    // Implementation here
  }

  handleUserAction(action) {
    this.log('User action received:', action);
    // Handle user actions
  }
}

module.exports = MyAwesomePlugin;
```

### Step 4: Create Package File

Create `package.json`:

```json
{
  "name": "wit-plugin-my-awesome",
  "version": "1.0.0",
  "description": "My Awesome Plugin for W.I.T. UDC",
  "main": "index.js",
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "axios": "^1.4.0"
  }
}
```

## Plugin API Reference

### Base Plugin Class

All plugins must extend the `WITPlugin` base class:

```javascript
class WITPlugin {
  constructor(config, eventBus, securityManager) {
    this.id = config.id;
    this.name = config.name;
    this.config = config;
    this.eventBus = eventBus;
    this.securityManager = securityManager;
  }

  // Override these methods
  async initialize() {}
  async handleCommand(command, args) {}
  async cleanup() {}

  // Utility methods
  log(...args) {}
  async checkPermission(permission) {}
  async saveConfig() {}
}
```

### EventBus API

```javascript
// Emit events
this.eventBus.emit('event.name', data);

// Listen to events
this.eventBus.on('event.name', handler);

// Remove listener
this.eventBus.removeListener('event.name', handler);

// Remove all listeners
this.eventBus.removeAllListeners('event.name');
```

### Common Events

```javascript
// Plugin lifecycle
'plugin.loaded'      // Plugin loaded
'plugin.initialized' // Plugin initialized
'plugin.error'       // Plugin error
'plugin.cleanup'     // Plugin cleanup

// User interaction
'user.action'        // User performed action
'user.settings'      // User changed settings

// System events
'system.startup'     // UDC started
'system.shutdown'    // UDC shutting down
'network.connected'  // Connected to backend
'network.disconnected' // Disconnected from backend

// WebSocket events
'ws.message'         // WebSocket message received
'ws.connected'       // WebSocket connected
'ws.disconnected'    // WebSocket disconnected
```

### Permissions

Plugins must request permissions in their manifest:

```javascript
// System permissions
'system.exec'        // Execute system commands
'system.info'        // Read system information

// Filesystem permissions
'filesystem.read'    // Read files
'filesystem.write'   // Write files
'filesystem.watch'   // Watch file changes

// Network permissions
'network.request'    // Make HTTP requests
'network.server'     // Create local server

// Hardware permissions
'hardware.serial'    // Access serial ports
'hardware.usb'       // Access USB devices
'hardware.gpio'      // Access GPIO pins

// UI permissions
'ui.notify'          // Show notifications
'ui.tray'           // Modify system tray
```

## Frontend Integration

To integrate your plugin with the W.I.T. frontend:

### 1. Create Frontend Component

```typescript
// software/frontend/web/src/components/plugins/MyAwesomePlugin.tsx
import React, { useState } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';

export const MyAwesomePlugin: React.FC = () => {
  const [status, setStatus] = useState(null);
  const { sendMessage } = useWebSocket();

  const handleAction = async () => {
    sendMessage({
      type: 'plugin.command',
      plugin: 'my-awesome-plugin',
      command: 'doSomething',
      args: { target: 'test' }
    });
  };

  return (
    <div className="plugin-container">
      <h3>My Awesome Plugin</h3>
      <button onClick={handleAction}>Do Something</button>
      {status && <pre>{JSON.stringify(status, null, 2)}</pre>}
    </div>
  );
};
```

### 2. Register Plugin UI

Add to the software integrations page or create dedicated plugin page.

## Best Practices

### 1. Error Handling

Always handle errors gracefully:

```javascript
async handleCommand(command, args) {
  try {
    // Validate inputs
    if (!args || typeof args !== 'object') {
      throw new Error('Invalid arguments');
    }

    // Execute command
    const result = await this.executeCommand(command, args);
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    this.log('Error executing command:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

### 2. Resource Management

Clean up resources properly:

```javascript
async cleanup() {
  // Close connections
  if (this.connection) {
    await this.connection.close();
  }

  // Stop watchers
  if (this.watcher) {
    this.watcher.close();
  }

  // Clear timers
  if (this.timer) {
    clearInterval(this.timer);
  }
}
```

### 3. Configuration

Make plugins configurable:

```javascript
getDefaultConfig() {
  return {
    updateInterval: 5000,
    maxRetries: 3,
    timeout: 30000,
    ...this.manifest.settings
  };
}

validateConfig(config) {
  const schema = {
    updateInterval: { type: 'number', min: 1000 },
    maxRetries: { type: 'number', min: 0, max: 10 },
    timeout: { type: 'number', min: 1000 }
  };

  // Validate configuration
  return validateSchema(config, schema);
}
```

### 4. Logging

Use structured logging:

```javascript
log(level, message, data = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    plugin: this.id,
    level,
    message,
    data
  };

  console.log(`[${this.id}]`, message, data);
  this.eventBus.emit('plugin.log', logEntry);
}

// Usage
this.log('info', 'Processing request', { requestId: '123' });
this.log('error', 'Failed to connect', { error: error.message });
```

## Testing Your Plugin

### 1. Unit Tests

Create `test/plugin.test.js`:

```javascript
const MyAwesomePlugin = require('../index');
const { EventEmitter } = require('events');

describe('MyAwesomePlugin', () => {
  let plugin;
  let eventBus;
  let securityManager;

  beforeEach(() => {
    eventBus = new EventEmitter();
    securityManager = {
      checkPermission: jest.fn().mockResolvedValue(true)
    };
    
    const config = {
      id: 'my-awesome-plugin',
      name: 'My Awesome Plugin'
    };
    
    plugin = new MyAwesomePlugin(config, eventBus, securityManager);
  });

  test('initializes correctly', async () => {
    await plugin.initialize();
    expect(plugin.initialized).toBe(true);
  });

  test('handles doSomething command', async () => {
    const result = await plugin.handleCommand('doSomething', {
      target: 'test'
    });
    
    expect(result.success).toBe(true);
    expect(result.output).toContain('test');
  });
});
```

### 2. Integration Tests

Test with the UDC framework:

```bash
# Start UDC in test mode
cd software/universal-desktop-controller
npm run test:plugins
```

## Publishing Your Plugin

### 1. Package Your Plugin

```bash
cd plugins/my-awesome-plugin
npm pack
```

### 2. Publish to NPM (Optional)

```bash
npm publish
```

### 3. Submit to W.I.T. Registry

Create a pull request to add your plugin to the official registry.

## Example Plugins

### File Watcher Plugin

Monitors file changes and triggers actions:

```javascript
class FileWatcherPlugin extends WITPlugin {
  async initialize() {
    const chokidar = require('chokidar');
    
    this.watcher = chokidar.watch(this.config.watchPath, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true
    });

    this.watcher
      .on('add', path => this.handleFileAdded(path))
      .on('change', path => this.handleFileChanged(path))
      .on('unlink', path => this.handleFileRemoved(path));
  }

  handleFileAdded(filePath) {
    this.eventBus.emit('file.added', {
      plugin: this.id,
      path: filePath,
      timestamp: Date.now()
    });
  }
}
```

### HTTP Server Plugin

Creates a local HTTP server:

```javascript
class HTTPServerPlugin extends WITPlugin {
  async initialize() {
    const express = require('express');
    this.app = express();

    this.app.get('/status', (req, res) => {
      res.json({ status: 'running', plugin: this.id });
    });

    this.server = this.app.listen(this.config.port || 3001);
  }

  async cleanup() {
    if (this.server) {
      await new Promise(resolve => this.server.close(resolve));
    }
  }
}
```

## Troubleshooting

### Plugin Not Loading

1. Check manifest.json syntax
2. Verify main file exists
3. Check console for errors
4. Ensure permissions are granted

### Permission Denied

1. Add required permissions to manifest
2. User must approve permissions
3. Check security manager logs

### WebSocket Communication Issues

1. Verify UDC is connected to backend
2. Check event names match
3. Review WebSocket logs

## Support

- Documentation: [UDC Architecture](ARCHITECTURE.md#universal-desktop-controller)
- Examples: [plugins/examples/](../software/universal-desktop-controller/plugins/examples/)
- Discord: #plugin-development channel
- Issues: GitHub Issues with 'plugin' label