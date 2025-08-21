/**
 * W.I.T. Universal Desktop Controller
 * Main entry point for the Electron application
 */

const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');
const { PluginManager } = require('./core/PluginManager');
const { WebSocketManager } = require('./core/WebSocketManager');
const { SecurityManager } = require('./core/SecurityManager');
const { EventBus } = require('./core/EventBus');
const { ConfigManager } = require('./core/ConfigManager');
const logger = require('./core/Logger');

class UniversalDesktopController {
    constructor() {
        this.tray = null;
        this.settingsWindow = null;
        this.isQuitting = false;
        
        // Core services
        this.eventBus = new EventBus();
        this.configManager = new ConfigManager();
        this.securityManager = new SecurityManager(this.eventBus);
        this.pluginManager = new PluginManager(this.eventBus, this.securityManager);
        this.wsManager = new WebSocketManager(this.eventBus, this.configManager, this.pluginManager);
        
        // Bind methods
        this.initialize = this.initialize.bind(this);
        this.createTray = this.createTray.bind(this);
        this.showSettings = this.showSettings.bind(this);
        this.quit = this.quit.bind(this);
    }
    
    async initialize() {
        logger.info('Initializing W.I.T. Universal Desktop Controller...');
        
        // Single instance lock
        const gotTheLock = app.requestSingleInstanceLock();
        if (!gotTheLock) {
            app.quit();
            return;
        }
        
        // Set up app events
        app.on('second-instance', () => {
            if (this.settingsWindow) {
                if (this.settingsWindow.isMinimized()) {
                    this.settingsWindow.restore();
                }
                this.settingsWindow.focus();
            }
        });
        
        app.on('window-all-closed', (e) => {
            // Prevent app from quitting when windows are closed
            e.preventDefault();
        });
        
        app.on('before-quit', () => {
            this.isQuitting = true;
        });
        
        // When dock icon is clicked on macOS
        app.on('activate', () => {
            if (!this.settingsWindow) {
                this.showSettings();
            }
        });
        
        // Wait for app ready
        await app.whenReady();
        
        // On macOS, we'll show the app differently
        if (process.platform === 'darwin') {
            // Keep dock visible for now for easier debugging
            // app.dock.hide();
        }
        
        // Initialize core services
        await this.configManager.initialize();
        await this.securityManager.initialize();
        await this.pluginManager.initialize();
        
        // Load built-in plugins
        await this.loadBuiltInPlugins();
        
        // Connect to W.I.T. backend
        const config = this.configManager.getConfig();
        if (config.witServer && config.authToken) {
            await this.wsManager.connect(config.witServer, config.authToken);
        }
        
        // Create system tray
        this.createTray();
        
        // Set up event handlers
        this.setupEventHandlers();
        
        // Set up IPC handlers
        this.setupIpcHandlers();
        
        logger.info('W.I.T. Universal Desktop Controller initialized successfully');
        
        // Always show settings for now (for debugging)
        this.showSettings();
        
        // Show settings on first run
        // if (config.firstRun) {
        //     this.showSettings();
        //     this.configManager.setConfig({ firstRun: false });
        // }
    }
    
    async loadBuiltInPlugins() {
        const builtInPlugins = [
            // 'printer-bridge',  // Will be implemented
            'arduino-ide',        // Arduino IDE integration
            'unified-slicer',     // Unified 3D slicer integration
            'matlab',             // MATLAB analysis integration
            'kicad',              // KiCad EDA integration
            'labview',            // LabVIEW data acquisition integration
            'node-red',           // Node-RED IoT automation integration
            'openscad',           // OpenSCAD programmatic 3D CAD modeller
            'vscode',             // Visual Studio Code integration
            'docker',             // Docker Desktop integration
            'blender',            // Blender 3D modeling and animation
            'file-browser',       // File system access and management
        ];
        
        for (const pluginName of builtInPlugins) {
            try {
                const pluginPath = path.join(__dirname, '..', 'plugins', pluginName);
                await this.pluginManager.loadPlugin(pluginPath);
                logger.info(`Loaded built-in plugin: ${pluginName}`);
                
                // Auto-start all plugins after loading (with small delay)
                setTimeout(async () => {
                    try {
                        await this.pluginManager.startPlugin(pluginName);
                        logger.info(`Auto-started plugin: ${pluginName}`);
                    } catch (error) {
                        logger.error(`Failed to auto-start plugin ${pluginName}:`, error);
                    }
                }, 500); // 500ms delay to ensure WebSocket is connected
            } catch (error) {
                logger.error(`Failed to load plugin ${pluginName}:`, error);
            }
        }
    }
    
    createTray() {
        logger.info('Creating system tray...');
        
        try {
            // Create a simple icon placeholder for now (16x16 blue square)
            const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABdSURBVDiN7ZAxDoAgDEW/JkYXR+9k4uQNuAMe3NFEFoeqCCjG0b+19L20BQCg6w6UUtgKkXETBJG5Z2YiImqCIF6OiBBCzPse3F3v93OLrNXnPbg75pzXBb7yAh9xBlkMGdTpVn0AAAAASUVORK5CYII=');
            
            logger.info('Icon created, creating tray...');
            this.tray = new Tray(icon);
            logger.info('Tray created successfully');
        
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'W.I.T. Desktop Controller',
                enabled: false
            },
            { type: 'separator' },
            {
                label: 'Status: Connected',
                id: 'status',
                enabled: false
            },
            { type: 'separator' },
            {
                label: 'Settings...',
                click: this.showSettings
            },
            {
                label: 'View Logs',
                click: () => this.showLogs()
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: this.quit
            }
        ]);
        
            this.tray.setToolTip('W.I.T. Desktop Controller');
            this.tray.setContextMenu(contextMenu);
            
            // Store menu reference for updates
            this.trayMenu = contextMenu;
            
            logger.info('Tray menu set successfully');
        } catch (error) {
            logger.error('Failed to create tray:', error);
        }
        
        // Update status based on connection
        this.eventBus.on('websocket:connected', () => {
            if (this.trayMenu) {
                this.trayMenu.getMenuItemById('status').label = 'Status: Connected';
                this.tray.setContextMenu(this.trayMenu);
            }
        });
        
        this.eventBus.on('websocket:disconnected', () => {
            if (this.trayMenu) {
                this.trayMenu.getMenuItemById('status').label = 'Status: Disconnected';
                this.tray.setContextMenu(this.trayMenu);
            }
        });
    }
    
    showSettings() {
        if (this.settingsWindow) {
            this.settingsWindow.focus();
            return;
        }
        
        // Show dock icon when settings window is open (macOS)
        // if (process.platform === 'darwin') {
        //     app.dock.show();
        // }
        
        this.settingsWindow = new BrowserWindow({
            width: 800,
            height: 600,
            title: 'W.I.T. Desktop Controller Settings',
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });
        
        this.settingsWindow.loadFile(path.join(__dirname, 'ui', 'settings.html'));
        
        this.settingsWindow.on('closed', () => {
            this.settingsWindow = null;
            // Hide dock icon again when settings window is closed (macOS)
            // if (process.platform === 'darwin') {
            //     app.dock.hide();
            // }
        });
    }
    
    showLogs() {
        // TODO: Implement log viewer
        logger.info('Log viewer not yet implemented');
    }
    
    setupEventHandlers() {
        // Plugin events
        this.eventBus.on('plugin:message', async (data) => {
            // Forward plugin messages to backend
            await this.wsManager.sendMessage({
                type: 'plugin_message',
                pluginId: data.pluginId,
                message: data.message
            });
        });
        
        // Plugin status events
        this.eventBus.on('plugin:started', async (data) => {
            logger.info(`Plugin started: ${data.pluginId}`);
            // Notify backend that plugin is now active
            await this.wsManager.sendMessage({
                type: 'plugin_status_update',
                pluginId: data.pluginId,
                status: 'active'
            });
        });
        
        this.eventBus.on('plugin:stopped', async (data) => {
            logger.info(`Plugin stopped: ${data.pluginId}`);
            // Notify backend that plugin is now inactive
            await this.wsManager.sendMessage({
                type: 'plugin_status_update',
                pluginId: data.pluginId,
                status: 'inactive'
            });
        });
        
        // Handle plugin commands from backend
        this.eventBus.on('plugin:command', async (data) => {
            logger.info('Received plugin command:', JSON.stringify(data, null, 2));
            try {
                const result = await this.pluginManager.sendMessageToPlugin(data.pluginId, {
                    action: data.action,
                    payload: data.payload
                });
                
                // Send response back to backend
                await this.wsManager.sendMessage({
                    type: 'plugin_response',
                    messageId: data.messageId,
                    pluginId: data.pluginId,
                    command: data.action,  // Include the command that was executed
                    result: result
                });
            } catch (error) {
                logger.error('Failed to execute plugin command:', error);
                await this.wsManager.sendMessage({
                    type: 'plugin_response',
                    messageId: data.messageId,
                    pluginId: data.pluginId,
                    error: error.message
                });
            }
        });
        
        // WebSocket events
        this.eventBus.on('websocket:message', async (message) => {
            // Route messages to plugins
            if (message.pluginId) {
                await this.pluginManager.routeMessage(message);
            }
        });
        
        // Security events
        this.eventBus.on('security:permission_request', async (request) => {
            // Handle permission requests
            logger.info('Permission request:', request);
            // TODO: Show user dialog
        });
    }
    
    setupIpcHandlers() {
        // Get settings
        ipcMain.on('get-settings', (event) => {
            event.reply('settings', this.configManager.getConfig());
        });
        
        // Save settings
        ipcMain.on('save-settings', async (event, settings) => {
            try {
                // Update config
                this.configManager.setConfig(settings);
                
                // Reconnect if server or token changed
                if (settings.witServer && settings.authToken) {
                    await this.wsManager.disconnect();
                    await this.wsManager.connect(settings.witServer, settings.authToken);
                }
                
                event.reply('settings-saved', { success: true });
            } catch (error) {
                logger.error('Failed to save settings:', error);
                event.reply('settings-saved', { success: false, error: error.message });
            }
        });
        
        // Test connection
        ipcMain.on('test-connection', async (event, { serverUrl, authToken }) => {
            try {
                // Create a temporary WebSocket to test
                const WebSocket = require('ws');
                let wsUrl = serverUrl.replace(/^http/, 'ws');
                // Force IPv4
                wsUrl = wsUrl.replace('localhost', '127.0.0.1');
                const fullUrl = `${wsUrl}/ws/desktop-controller`;
                
                const ws = new WebSocket(fullUrl, {
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });
                
                const timeout = setTimeout(() => {
                    ws.close();
                    event.reply('connection-test-result', { 
                        success: false, 
                        message: 'Connection timeout' 
                    });
                }, 5000);
                
                ws.on('open', () => {
                    // Send test registration
                    ws.send(JSON.stringify({
                        type: 'register',
                        controllerId: 'test-' + Date.now(),
                        capabilities: { test: true }
                    }));
                });
                
                ws.on('message', (data) => {
                    const message = JSON.parse(data.toString());
                    if (message.type === 'registration_ack') {
                        clearTimeout(timeout);
                        ws.close();
                        event.reply('connection-test-result', { 
                            success: true, 
                            message: 'Connection successful!' 
                        });
                    }
                });
                
                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    event.reply('connection-test-result', { 
                        success: false, 
                        message: 'Connection failed: ' + error.message 
                    });
                });
                
            } catch (error) {
                event.reply('connection-test-result', { 
                    success: false, 
                    message: 'Test failed: ' + error.message 
                });
            }
        });
        
        // Get connection status
        ipcMain.on('get-connection-status', (event) => {
            const status = this.wsManager.getStatus();
            event.reply('connection-status', status);
        });
        
        // Get plugins
        ipcMain.on('get-plugins', (event) => {
            const plugins = this.pluginManager.getLoadedPlugins();
            event.reply('plugins', plugins);
        });
        
        // Plugin management
        ipcMain.on('start-plugin', async (event, pluginId) => {
            try {
                await this.pluginManager.startPlugin(pluginId);
                event.reply('plugin-started', { pluginId, success: true });
            } catch (error) {
                event.reply('plugin-started', { pluginId, success: false, error: error.message });
            }
        });
        
        ipcMain.on('stop-plugin', async (event, pluginId) => {
            try {
                await this.pluginManager.stopPlugin(pluginId);
                event.reply('plugin-stopped', { pluginId, success: true });
            } catch (error) {
                event.reply('plugin-stopped', { pluginId, success: false, error: error.message });
            }
        });
        
        ipcMain.on('configure-plugin', async (event, pluginId) => {
            try {
                const config = await this.pluginManager.getPluginConfiguration(pluginId);
                event.reply('plugin-configuration', { pluginId, success: true, config });
            } catch (error) {
                event.reply('plugin-configuration', { pluginId, success: false, error: error.message });
            }
        });
        
        ipcMain.on('save-plugin-config', async (event, { pluginId, config }) => {
            try {
                await this.pluginManager.savePluginConfiguration(pluginId, config);
                event.reply('plugin-config-saved', { pluginId, success: true });
            } catch (error) {
                event.reply('plugin-config-saved', { pluginId, success: false, error: error.message });
            }
        });
        
        // Handle plugin commands from UI
        ipcMain.on('plugin-command', async (event, data) => {
            try {
                logger.info('Plugin command from UI:', data);
                const result = await this.pluginManager.sendMessageToPlugin(data.pluginId, {
                    action: data.action,
                    payload: data.payload
                });
                event.reply('plugin-command-result', { success: true, result });
            } catch (error) {
                logger.error('Plugin command error:', error);
                event.reply('plugin-command-result', { success: false, error: error.message });
            }
        });

        // Create custom plugin
        ipcMain.on('create-plugin', async (event, pluginInfo) => {
            try {
                const pluginPath = await this.pluginManager.createPlugin(pluginInfo);
                
                // Load the newly created plugin
                await this.pluginManager.loadPlugin(pluginPath);
                
                event.reply('plugin-created', { success: true, pluginId: pluginInfo.id, path: pluginPath });
                
                // Refresh plugin list
                setTimeout(() => {
                    const plugins = this.pluginManager.getLoadedPlugins();
                    event.reply('plugins', plugins);
                }, 100);
                
            } catch (error) {
                logger.error('Failed to create plugin:', error);
                event.reply('plugin-created', { success: false, error: error.message });
            }
        });
    }
    
    async quit() {
        logger.info('Shutting down W.I.T. Universal Desktop Controller...');
        
        // Stop all plugins
        await this.pluginManager.stopAll();
        
        // Disconnect WebSocket
        await this.wsManager.disconnect();
        
        // Quit app
        app.quit();
    }
}

// Create and start the controller
const controller = new UniversalDesktopController();
controller.initialize().catch(error => {
    logger.error('Failed to initialize controller:', error);
    app.quit();
});