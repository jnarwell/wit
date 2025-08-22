# Universal Desktop Controller Plugin Development Guide

## Table of Contents
1. [Overview](#overview)
2. [Plugin Architecture](#plugin-architecture)
3. [Creating a New Plugin](#creating-a-new-plugin)
4. [Plugin API Reference](#plugin-api-reference)
5. [Frontend Integration](#frontend-integration)
6. [AI Terminal Integration](#ai-terminal-integration)
7. [Testing Your Plugin](#testing-your-plugin)
8. [Best Practices](#best-practices)

## Overview

The Universal Desktop Controller (UDC) uses a plugin-based architecture to integrate desktop applications with the W.I.T. system. Plugins run within the Electron-based UDC application and communicate with the W.I.T. backend via WebSocket.

### Architecture Flow
```
W.I.T. Frontend → Backend WebSocket → UDC → Plugin → Desktop Application
                                           ↓
                                    AI Terminal ←
```

## Plugin Architecture

### Directory Structure
```
universal-desktop-controller/
├── plugins/
│   ├── your-plugin-name/
│   │   ├── index.js         # Main plugin file
│   │   ├── package.json     # Plugin metadata
│   │   └── README.md        # Plugin documentation
│   └── ...
├── src/
│   ├── core/
│   │   ├── PluginBase.js   # Base class for all plugins
│   │   └── PluginManager.js # Plugin loader and manager
│   └── ...
```

### Plugin Lifecycle
1. **Discovery**: UDC scans the plugins directory
2. **Loading**: Plugin metadata is read from package.json
3. **Initialization**: Plugin's `initialize()` method is called
4. **Start**: Plugin's `start()` method is called when enabled
5. **Runtime**: Plugin handles messages and performs actions
6. **Stop**: Plugin's `stop()` method is called when disabled

## Creating a New Plugin

### Step 1: Create Plugin Directory
```bash
cd software/universal-desktop-controller/plugins
mkdir my-awesome-plugin
cd my-awesome-plugin
```

### Step 2: Create package.json
```json
{
  "name": "my-awesome-plugin",
  "version": "1.0.0",
  "description": "Integration with My Awesome Application",
  "main": "index.js",
  "plugin": {
    "id": "my-awesome-plugin",
    "displayName": "My Awesome Plugin",
    "category": "productivity",
    "permissions": [
      "launch-application",
      "file-system-read",
      "file-system-write"
    ],
    "platforms": {
      "darwin": {
        "path": "/Applications/My Awesome App.app/Contents/MacOS/My Awesome App"
      },
      "win32": {
        "path": "C:\\Program Files\\My Awesome App\\app.exe"
      },
      "linux": {
        "path": "/usr/bin/my-awesome-app"
      }
    }
  }
}
```

### Step 3: Create index.js
```javascript
const { PluginBase } = require('../../src/core/PluginBase');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class MyAwesomePlugin extends PluginBase {
    constructor() {
        super();
        this.appProcess = null;
        this.config = {
            appPath: this.getPlatformPath(),
            defaultSettings: {
                // Add your default settings here
            }
        };
    }
    
    async initialize() {
        // Load saved configuration
        this.config = await this.loadData('config.json') || this.config;
        
        // Verify application is installed
        try {
            await fs.access(this.config.appPath);
            this.log('Application found at:', this.config.appPath);
        } catch (error) {
            this.error('Application not found at:', this.config.appPath);
            // Try to find it
            const found = await this.findApplication();
            if (found) {
                this.config.appPath = found;
                await this.saveData('config.json', this.config);
            }
        }
    }
    
    async start() {
        this.log('Plugin started');
        // Initialize any connections or watchers
    }
    
    async stop() {
        // Cleanup
        if (this.appProcess) {
            this.appProcess.kill();
            this.appProcess = null;
        }
    }
    
    async onMessage(message) {
        const { action, payload } = message;
        
        switch (action) {
            case 'launch':
                return await this.launchApplication(payload);
                
            case 'executeCommand':
                return await this.executeCommand(payload);
                
            case 'getStatus':
                return await this.getApplicationStatus();
                
            case 'openFile':
                return await this.openFile(payload);
                
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }
    
    async launchApplication(options = {}) {
        this.log('Launching application with options:', options);
        
        if (this.appProcess) {
            return {
                success: false,
                message: 'Application already running',
                pid: this.appProcess.pid
            };
        }
        
        const args = [];
        
        // Add file to open if provided
        if (options.filePath) {
            args.push(options.filePath);
        }
        
        // Add any additional arguments
        if (options.args) {
            args.push(...options.args);
        }
        
        try {
            this.appProcess = spawn(this.config.appPath, args, {
                detached: true,
                stdio: 'ignore'
            });
            
            this.appProcess.unref();
            
            // Monitor process
            this.appProcess.on('exit', (code) => {
                this.log('Application exited with code:', code);
                this.appProcess = null;
                
                // Notify W.I.T. of status change
                this.emit('status-changed', {
                    running: false,
                    exitCode: code
                });
            });
            
            return {
                success: true,
                pid: this.appProcess.pid
            };
        } catch (error) {
            this.error('Failed to launch application:', error);
            throw error;
        }
    }
    
    async executeCommand(payload) {
        const { command, args } = payload;
        
        // Implement application-specific commands
        // This could involve IPC, API calls, or file manipulation
        
        return {
            success: true,
            result: 'Command executed'
        };
    }
    
    async getApplicationStatus() {
        return {
            running: !!this.appProcess,
            pid: this.appProcess?.pid,
            config: this.config
        };
    }
    
    async openFile(payload) {
        const { filePath } = payload;
        
        if (!filePath) {
            throw new Error('File path is required');
        }
        
        // If app is running, use IPC or API to open file
        // Otherwise, launch with file
        if (this.appProcess) {
            // Implement app-specific file opening
            return { success: true, message: 'File opened in running instance' };
        } else {
            return await this.launchApplication({ filePath });
        }
    }
    
    getPlatformPath() {
        const platform = process.platform;
        const paths = this.metadata.plugin.platforms[platform];
        return paths?.path || '';
    }
    
    async findApplication() {
        // Implement platform-specific search logic
        const searchPaths = this.getSearchPaths();
        
        for (const searchPath of searchPaths) {
            try {
                await fs.access(searchPath);
                return searchPath;
            } catch (error) {
                // Continue searching
            }
        }
        
        return null;
    }
    
    getSearchPaths() {
        // Return platform-specific search paths
        switch (process.platform) {
            case 'darwin':
                return [
                    '/Applications/My Awesome App.app/Contents/MacOS/My Awesome App',
                    `${process.env.HOME}/Applications/My Awesome App.app/Contents/MacOS/My Awesome App`
                ];
            case 'win32':
                return [
                    'C:\\Program Files\\My Awesome App\\app.exe',
                    'C:\\Program Files (x86)\\My Awesome App\\app.exe',
                    `${process.env.LOCALAPPDATA}\\My Awesome App\\app.exe`
                ];
            case 'linux':
                return [
                    '/usr/bin/my-awesome-app',
                    '/usr/local/bin/my-awesome-app',
                    `${process.env.HOME}/.local/bin/my-awesome-app`
                ];
            default:
                return [];
        }
    }
}

module.exports = MyAwesomePlugin;
```

### Step 4: Test Your Plugin Locally
1. Start the UDC in development mode:
   ```bash
   npm run dev
   ```

2. Your plugin should appear in the UDC settings

3. Enable it and test functionality

## Plugin API Reference

### Base Class Methods

#### Lifecycle Methods
- `initialize()` - Called when plugin is loaded
- `start()` - Called when plugin is enabled
- `stop()` - Called when plugin is disabled
- `onMessage(message)` - Handle incoming messages

#### Utility Methods
- `log(...args)` - Log messages with plugin prefix
- `error(...args)` - Log errors
- `warn(...args)` - Log warnings
- `emit(event, data)` - Emit events to W.I.T.
- `loadData(filename)` - Load plugin data
- `saveData(filename, data)` - Save plugin data
- `getDataPath()` - Get plugin data directory

#### Properties
- `metadata` - Plugin package.json content
- `id` - Plugin ID
- `name` - Plugin display name
- `version` - Plugin version

### Message Format

#### Incoming Messages
```javascript
{
    type: 'plugin_command',
    pluginId: 'my-awesome-plugin',
    action: 'launch',
    payload: {
        // Action-specific data
    },
    messageId: 'unique-id'
}
```

#### Outgoing Messages
```javascript
// Success Response
{
    type: 'plugin_response',
    pluginId: 'my-awesome-plugin',
    messageId: 'unique-id',
    result: {
        success: true,
        // Action-specific result data
    }
}

// Error Response
{
    type: 'plugin_response',
    pluginId: 'my-awesome-plugin',
    messageId: 'unique-id',
    error: 'Error message'
}

// Status Updates
{
    type: 'plugin_status',
    pluginId: 'my-awesome-plugin',
    status: 'active' | 'inactive' | 'error',
    data: {
        // Status-specific data
    }
}
```

## Frontend Integration

### Step 1: Update Backend Mock Data
Edit `software/backend/dev_server.py` to include your plugin in the mock response:

```python
# In the plugin_list handler
"plugins": [
    {
        "id": "arduino-ide",
        "name": "Arduino IDE",
        "version": "1.0.0",
        "status": "active",
        "description": "Arduino IDE integration for programming microcontrollers",
        "icon": "FaMicrochip"
    },
    {
        "id": "my-awesome-plugin",
        "name": "My Awesome Plugin",
        "version": "1.0.0", 
        "status": "active",
        "description": "Integration with My Awesome Application",
        "icon": "FaRocket"  # Choose appropriate React Icon
    }
]
```

### Step 2: Add to Frontend Software List (CRITICAL)
**⚠️ This step is REQUIRED - plugins won't show in the frontend without it!**

Edit `software/frontend/web/src/pages/SoftwareIntegrationsPage.tsx` and add your plugin to the `UDC_INTEGRATIONS` array:

```javascript
// Add to UDC_INTEGRATIONS array (around line 190)
{
    id: 'my-awesome-app',
    name: 'My Awesome App',
    type: 'productivity',  // Choose appropriate type
    status: 'configured',   // Use 'configured' not 'disconnected'
    description: 'Integration with My Awesome Application',
    isUDCPlugin: true,
    pluginId: 'my-awesome-plugin'  // MUST match your plugin ID exactly
}
```

**Note**: Also remove any "Coming Soon" entries for your plugin from the `COMING_SOON_SOFTWARE` array in the same file.

### Step 3: Handle Plugin Commands
The frontend automatically handles launching when clicking on active plugins:

```javascript
const handleLaunchSoftware = (integration) => {
    if (integration.isUDCPlugin && integration.pluginId) {
        sendCommand(integration.pluginId, 'launch');
    }
};
```

### Step 4: Add Custom Actions
For more complex interactions, extend the integration card:

```javascript
// In SoftwareIntegrationsPage.tsx, add custom actions
const handlePluginAction = (integration, action, payload) => {
    if (integration.isUDCPlugin && integration.pluginId) {
        sendCommand(integration.pluginId, action, payload);
    }
};

// Example: Open specific file
handlePluginAction(integration, 'openFile', { 
    filePath: '/path/to/file.txt' 
});

// Example: Execute command
handlePluginAction(integration, 'executeCommand', { 
    command: 'compile',
    args: ['--optimize'] 
});
```

## AI Terminal Integration

### Step 1: Register Plugin with AI System
Create a plugin descriptor for the AI terminal:

```javascript
// In your plugin's initialize method
await this.registerWithAI({
    commands: [
        {
            name: 'open-awesome-app',
            description: 'Launch My Awesome Application',
            parameters: {
                file: {
                    type: 'string',
                    description: 'Optional file to open',
                    required: false
                }
            }
        },
        {
            name: 'awesome-compile',
            description: 'Compile a project with My Awesome App',
            parameters: {
                project: {
                    type: 'string',
                    description: 'Project path',
                    required: true
                },
                flags: {
                    type: 'array',
                    description: 'Compilation flags',
                    required: false
                }
            }
        }
    ]
});
```

### Step 2: Handle AI Commands
Add AI command handlers to your plugin:

```javascript
async onMessage(message) {
    const { action, payload, source } = message;
    
    // Check if command is from AI
    if (source === 'ai-terminal') {
        return await this.handleAICommand(action, payload);
    }
    
    // Regular command handling
    switch (action) {
        // ... existing cases
    }
}

async handleAICommand(command, params) {
    switch (command) {
        case 'open-awesome-app':
            const result = await this.launchApplication({
                filePath: params.file
            });
            return {
                success: result.success,
                message: params.file 
                    ? `Opened ${params.file} in My Awesome App`
                    : 'Launched My Awesome App'
            };
            
        case 'awesome-compile':
            return await this.compileProject(params.project, params.flags);
            
        default:
            throw new Error(`Unknown AI command: ${command}`);
    }
}
```

### Step 3: Natural Language Processing
The AI terminal can understand natural language commands:

```
User: "Open my Arduino sketch in the IDE"
AI: Executes → open-awesome-app { file: "/path/to/sketch.ino" }

User: "Compile the current project with optimization"
AI: Executes → awesome-compile { project: ".", flags: ["--optimize"] }
```

## Testing Your Plugin

### Unit Testing
Create `test/my-awesome-plugin.test.js`:

```javascript
const MyAwesomePlugin = require('../plugins/my-awesome-plugin');

describe('MyAwesomePlugin', () => {
    let plugin;
    
    beforeEach(() => {
        plugin = new MyAwesomePlugin();
    });
    
    afterEach(async () => {
        await plugin.stop();
    });
    
    test('initializes correctly', async () => {
        await plugin.initialize();
        expect(plugin.config.appPath).toBeTruthy();
    });
    
    test('launches application', async () => {
        await plugin.initialize();
        const result = await plugin.launchApplication();
        expect(result.success).toBe(true);
        expect(result.pid).toBeTruthy();
    });
    
    test('handles unknown actions', async () => {
        await expect(plugin.onMessage({
            action: 'unknown'
        })).rejects.toThrow('Unknown action');
    });
});
```

### Integration Testing

1. **Manual Testing**:
   ```bash
   # Start UDC in dev mode
   npm run dev
   
   # In another terminal, start the backend
   cd software/backend
   python3 dev_server.py
   
   # Start the frontend
   cd software/frontend/web
   npm run dev
   ```

2. **Test Checklist**:
   - [ ] Plugin loads without errors
   - [ ] Plugin appears in UDC settings
   - [ ] Plugin can be enabled/disabled
   - [ ] Launch command works from frontend
   - [ ] Status updates properly
   - [ ] AI commands execute correctly
   - [ ] Error handling works as expected

### Debugging

1. **Enable Debug Logging**:
   ```javascript
   // In your plugin
   initialize() {
       this.debug = true;  // Enable verbose logging
       // ...
   }
   ```

2. **Use Chrome DevTools**:
   - Start UDC with: `npm run dev`
   - Press Ctrl+Shift+I to open DevTools
   - Check Console for plugin logs
   - Use Network tab to monitor WebSocket

3. **Common Issues**:
   - **Plugin not loading**: Check package.json syntax
   - **Launch fails**: Verify application path
   - **Commands not working**: Check message format
   - **Frontend not updating**: Verify WebSocket connection

## Best Practices

### 1. Error Handling
```javascript
async launchApplication(options) {
    try {
        // Validate inputs
        if (options.filePath && !await this.fileExists(options.filePath)) {
            throw new Error(`File not found: ${options.filePath}`);
        }
        
        // Attempt launch
        const result = await this.doLaunch(options);
        
        // Verify success
        if (!result.pid) {
            throw new Error('Failed to get process ID');
        }
        
        return { success: true, pid: result.pid };
        
    } catch (error) {
        this.error('Launch failed:', error);
        
        // Return user-friendly error
        return {
            success: false,
            error: error.message || 'Unknown error occurred'
        };
    }
}
```

### 2. Configuration Management
```javascript
// Save user preferences
async updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    await this.saveData('config.json', this.config);
    this.emit('config-updated', this.config);
}

// Migrate old configs
async migrateConfig() {
    const oldConfig = await this.loadData('settings.json');
    if (oldConfig && !oldConfig.version) {
        const newConfig = {
            version: '2.0',
            ...this.upgradeConfig(oldConfig)
        };
        await this.saveData('config.json', newConfig);
        await this.deleteData('settings.json');
    }
}
```

### 3. Resource Management
```javascript
class MyAwesomePlugin extends PluginBase {
    constructor() {
        super();
        this.resources = new Set();
    }
    
    async start() {
        // Track resources
        const watcher = this.createFileWatcher();
        this.resources.add(watcher);
        
        const timer = setInterval(() => this.checkStatus(), 5000);
        this.resources.add({ type: 'timer', id: timer });
    }
    
    async stop() {
        // Clean up all resources
        for (const resource of this.resources) {
            if (resource.close) {
                await resource.close();
            } else if (resource.type === 'timer') {
                clearInterval(resource.id);
            }
        }
        this.resources.clear();
    }
}
```

### 4. Security Considerations
```javascript
// Validate file paths
validatePath(filePath) {
    // Prevent directory traversal
    const normalized = path.normalize(filePath);
    if (normalized.includes('..')) {
        throw new Error('Invalid file path');
    }
    
    // Check allowed directories
    const allowed = [
        process.env.HOME,
        '/tmp',
        this.config.workspaceDir
    ];
    
    if (!allowed.some(dir => normalized.startsWith(dir))) {
        throw new Error('Access denied to path');
    }
    
    return normalized;
}

// Sanitize command arguments
sanitizeArgs(args) {
    return args.map(arg => {
        // Remove potentially dangerous characters
        return arg.replace(/[;&|`$]/g, '');
    });
}
```

### 5. Performance Optimization
```javascript
// Cache expensive operations
class MyAwesomePlugin extends PluginBase {
    constructor() {
        super();
        this.cache = new Map();
    }
    
    async getProjectInfo(projectPath) {
        // Check cache first
        const cached = this.cache.get(projectPath);
        if (cached && cached.timestamp > Date.now() - 60000) {
            return cached.data;
        }
        
        // Expensive operation
        const info = await this.scanProject(projectPath);
        
        // Cache result
        this.cache.set(projectPath, {
            data: info,
            timestamp: Date.now()
        });
        
        return info;
    }
}
```

### 6. User Experience
```javascript
// Provide progress updates
async performLongOperation(options) {
    const steps = [
        { name: 'Initializing', weight: 10 },
        { name: 'Processing', weight: 70 },
        { name: 'Finalizing', weight: 20 }
    ];
    
    let progress = 0;
    
    for (const step of steps) {
        this.emit('progress', {
            step: step.name,
            progress: progress,
            total: 100
        });
        
        await this.executeStep(step.name, options);
        progress += step.weight;
    }
    
    this.emit('progress', {
        step: 'Complete',
        progress: 100,
        total: 100
    });
}
```

## Examples

### OpenSCAD Plugin Example
See `plugins/openscad/` for a complete example of integrating OpenSCAD with:
- Programmatic 3D CAD modeling
- Parametric design support
- Real-time rendering and preview
- Multiple export formats (STL, DXF, PNG, etc.)
- Variable extraction and customization
- Project management
- Syntax checking and validation
- Template-based file creation
- WebSocket connection state handling

### VS Code Plugin Example
See `plugins/vscode/` for a complete example of integrating Visual Studio Code with:
- Cross-platform application detection (Windows, macOS, Linux)
- Project creation with templates (Node.js, Python, Web, Empty)
- Extension management (install/list/uninstall)
- Git integration (clone repositories, status)
- Terminal integration and settings access
- Comprehensive frontend control page with tabbed interface
- WebSocket connection state handling
- Real-time status monitoring and updates

### Database Client Plugin Example
See `plugins/db-client/` for an example of:
- Connection management
- Query execution
- Result formatting
- Schema exploration
- Export functionality

## Common Issues and Solutions

### 1. Plugin Status Not Updating in Frontend

**Issue**: Plugin shows as "inactive" or "configured" even though it's running.

**Solution**: Emit the proper status update event when your plugin starts:
```javascript
async start() {
    await super.start();
    
    // Your initialization code...
    
    // IMPORTANT: Emit status update
    this.emit('plugin_status_update', {
        pluginId: this.id,
        status: 'active'
    });
}
```

### 2. Application Not Found Errors

**Issue**: Plugin tries to launch application with null path.

**Solution**: Always check if the application is installed before using the path:
```javascript
async launchApplication() {
    if (!this.appPath) {
        throw new Error('Application not installed. Please install MyApp first.');
    }
    
    // Proceed with launch...
}

async openFile(filePath) {
    if (!this.appPath) {
        throw new Error('Application not installed. Please install MyApp first.');
    }
    
    // Open file...
}
```

### 3. Spawn ENOENT Errors

**Issue**: Cannot find executable when using spawn.

**Solution**: Use proper paths for executables:
```javascript
// For local node modules
const localBin = path.join(__dirname, 'node_modules', '.bin', 'executable');

// For global commands, check if they exist first
const { execSync } = require('child_process');
try {
    execSync('which mycommand', { stdio: 'ignore' });
    // Command exists globally
} catch {
    // Use local installation or throw error
}
```

### 4. Backend Plugin List Not Updating

**Issue**: New plugin doesn't appear in frontend.

**Solution**: Add your plugin to both locations:

1. **Backend** (`software/backend/dev_server.py`):
```python
# Add to plugin_status dictionary
plugin_status = {
    "arduino-ide": "inactive",
    "your-plugin": "inactive",  # Add this
    # ...
}

# Add to plugin list in WebSocket handler
{
    "id": "your-plugin",
    "name": "Your Plugin",
    "version": "1.0.0",
    "status": plugin_status.get("your-plugin", "inactive"),
    "description": "Your plugin description",
    "icon": "FaYourIcon"
}
```

2. **UDC** (`software/universal-desktop-controller/src/main.js`):
```javascript
const builtInPlugins = [
    'arduino-ide',
    'your-plugin',  // Add this
    // ...
];
```

### 5. Frontend Integration Not Showing

**Issue**: Plugin works but doesn't appear in frontend UI.

**Solution**: Add to frontend integrations list:
```javascript
// In SoftwareIntegrationsPage.tsx
const UDC_INTEGRATIONS = [
    // ...
    {
        id: 'your-app',
        name: 'Your App',
        type: 'productivity',
        status: 'disconnected',
        description: 'Your app description',
        isUDCPlugin: true,
        pluginId: 'your-plugin'  // Must match plugin ID
    }
];
```

### 6. Plugin Not Auto-Starting

**Issue**: Plugin loads but doesn't start automatically.

**Solution**: Ensure manifest.json has proper structure:
```json
{
    "id": "your-plugin",
    "name": "Your Plugin", 
    "version": "1.0.0",
    "main": "index.js",
    "autoStart": true,  // Add this if needed
    "permissions": ["fileSystem", "processManagement"]
}
```

### 7. WebSocket Connection Timing Issues

**Issue**: Frontend control page shows "Unknown Application Control" or fails to load plugin data due to WebSocket connection timing.

**Symptoms**:
- Console errors: "Failed to get status", "Failed to load projects"
- Plugin control page shows generic "Unknown Application Control" instead of specific plugin interface
- WebSocket not connected errors when page loads

**Solution**: Implement proper WebSocket connection state handling in frontend control pages:

```javascript
// In your plugin control page component
const YourPluginControlPage: React.FC<Props> = ({ onClose }) => {
  const { sendCommand, lastMessage, wsStatus } = useUDCWebSocket();
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Wait for WebSocket connection before loading data
  useEffect(() => {
    if (wsStatus === 'connected' && !isInitialized) {
      setIsInitialized(true);
      loadStatus();
      loadProjects();
    }
  }, [wsStatus, isInitialized]);
  
  // Check connection state before sending commands
  const loadStatus = async () => {
    if (wsStatus !== 'connected') {
      console.log('WebSocket not connected, skipping status load');
      return;
    }
    try {
      await sendCommand('your-plugin', 'getStatus');
    } catch (error) {
      console.error('Failed to get status:', error);
      setError('Failed to get plugin status. Please check if plugin is running.');
    }
  };
  
  // Show loading state while connecting
  if (wsStatus === 'connecting' || wsStatus === 'disconnected') {
    return (
      <div className="plugin-control-page">
        <div className="page-header">
          <h1>Your Plugin Control</h1>
          <p>Connecting to desktop controller...</p>
        </div>
        <div className="status-bar">
          <div className="status-item">
            <span className="status-label">Connection:</span>
            <span className="status-value inactive">
              {wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
    );
  }
  
  // Show error state if connection failed
  if (wsStatus === 'failed') {
    return (
      <div className="plugin-control-page">
        <div className="page-header">
          <h1>Your Plugin Control</h1>
          <p>Connection failed</p>
        </div>
        <div className="error-message">
          <p>Failed to connect to desktop controller. Please ensure the Universal Desktop Controller is running.</p>
        </div>
      </div>
    );
  }
  
  // Normal plugin interface
  return (
    <div className="plugin-control-page">
      {/* Your plugin UI */}
    </div>
  );
};
```

**Key Points**:
- Always check `wsStatus` before sending commands
- Use `isInitialized` state to prevent multiple initialization attempts
- Show appropriate loading/error states based on connection status
- Only load plugin data after WebSocket is connected
- This prevents the "Unknown Application Control" fallback page from showing

**Example**: The OpenSCAD plugin implementation demonstrates this pattern - see `software/frontend/web/src/pages/OpenSCADControlPage.tsx` for a complete example.

## Complete Integration Checklist

**⚠️ IMPORTANT**: All plugins require BOTH backend and frontend registration. Missing the frontend step is the most common cause of plugins not appearing in the UI.

### Required Files for Every Plugin:
1. **Backend Plugin**: `/plugins/your-plugin/index.js` extending WITPlugin
2. **Backend Registration**: Add to `/src/main.js` builtInPlugins array  
3. **Backend Mock**: Add to `/software/backend/dev_server.py` plugin_status and plugin list
4. **Frontend Registration**: Add to `/software/frontend/web/src/pages/SoftwareIntegrationsPage.tsx` UDC_INTEGRATIONS array ← **MOST COMMONLY MISSED**

When creating a new plugin integration, ensure you complete ALL of these steps:

### ✅ 1. Plugin Structure
- [ ] Create plugin directory: `plugins/your-plugin/`
- [ ] Create `manifest.json` with all required fields
- [ ] Create `package.json` with dependencies
- [ ] Create `index.js` extending `WITPlugin` class
- [ ] Implement ALL required methods: `initialize()`, `start()`, `stop()`, `onMessage()`
- [ ] Add `getStatus()` method for status reporting
- [ ] Create README.md documenting plugin usage

### ✅ 2. Plugin Implementation
- [ ] Handle application detection for all platforms (Windows, macOS, Linux)
- [ ] Implement proper error handling with user-friendly messages
- [ ] Add null checks before using application paths
- [ ] Emit `plugin_status_update` event in `start()` method
- [ ] Support all basic commands: launch, getStatus, etc.
- [ ] Clean up resources in `stop()` method

### ✅ 3. Backend Integration
- [ ] Add plugin ID to `plugin_status` dictionary
- [ ] Add plugin info to WebSocket `plugin_list` handler
- [ ] Test WebSocket communication

### ✅ 4. UDC Integration  
- [ ] Add plugin to `builtInPlugins` array in main.js
- [ ] Test plugin loading and lifecycle
- [ ] Verify status updates are sent

### ✅ 5. Frontend Integration
- [ ] Add integration object to `UDC_INTEGRATIONS` array
- [ ] Set correct `pluginId` matching your plugin ID
- [ ] Choose appropriate icon from React Icons
- [ ] Add any custom quick actions needed
- [ ] Create dedicated control page if complex UI needed

### ✅ 6. Testing
- [ ] Test on all target platforms
- [ ] Test with application not installed
- [ ] Test with application installed
- [ ] Test all commands and features
- [ ] Verify status updates in frontend
- [ ] Check error handling and messages

### ✅ 7. Documentation
- [ ] Document all supported commands
- [ ] List system requirements
- [ ] Provide installation instructions
- [ ] Include troubleshooting section
- [ ] Add examples of usage

## Plugin Development Best Practices

### Always Emit Status Updates
```javascript
class MyPlugin extends WITPlugin {
    async start() {
        await super.start();
        
        // Initialize your plugin...
        
        // ALWAYS emit status update
        this.emit('plugin_status_update', {
            pluginId: this.id,
            status: 'active'
        });
    }
}
```

### Handle Missing Applications Gracefully
```javascript
async handleCommand(command, payload) {
    // Check installation first
    if (!this.appPath && command !== 'getStatus') {
        return {
            success: false,
            message: 'MyApp is not installed. Please install MyApp first.'
        };
    }
    
    switch (command) {
        case 'launch':
            return await this.launchApp();
        // ...
    }
}
```

### Provide Detailed Status
```javascript
getStatus() {
    return {
        ...super.getStatus(),
        appInstalled: !!this.appPath,
        appPath: this.appPath,
        appRunning: !!this.appProcess,
        version: this.appVersion,
        lastError: this.lastError
    };
}
```

## Support

For questions or issues:
1. Check existing plugins for examples
2. Review this guide's Common Issues section
3. Review the [UDC Architecture](./ARCHITECTURE.md) document
4. Open an issue on GitHub
5. Join our Discord community

## License

Plugins should be compatible with the W.I.T. project license. See the main project LICENSE file for details.