/**
 * PluginManager - Manages loading, lifecycle, and communication for all plugins
 */

const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const logger = require('./Logger');

class PluginManager {
    constructor(eventBus, securityManager) {
        this.eventBus = eventBus;
        this.securityManager = securityManager;
        this.plugins = new Map();
        this.pluginStates = new Map();
    }
    
    async initialize() {
        logger.info('Initializing Plugin Manager...');
        
        // Set up plugin directories
        this.pluginDirs = [
            path.join(__dirname, '..', '..', 'plugins'), // Built-in plugins
            path.join(process.env.APPDATA || process.env.HOME, '.wit', 'plugins') // User plugins
        ];
        
        // Ensure directories exist
        for (const dir of this.pluginDirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
            } catch (error) {
                logger.warn(`Failed to create plugin directory ${dir}:`, error.message);
            }
        }
    }
    
    /**
     * Load a plugin from directory
     */
    async loadPlugin(pluginPath) {
        try {
            // Load plugin manifest
            const manifestPath = path.join(pluginPath, 'manifest.json');
            const manifestData = await fs.readFile(manifestPath, 'utf8');
            const manifest = JSON.parse(manifestData);
            
            // Validate manifest
            this.validateManifest(manifest);
            
            // Check if plugin already loaded
            if (this.plugins.has(manifest.id)) {
                throw new Error(`Plugin ${manifest.id} is already loaded`);
            }
            
            // Load plugin module
            const PluginClass = require(path.join(pluginPath, manifest.main));
            
            // Create plugin instance
            const plugin = new PluginClass({
                id: manifest.id,
                eventBus: this.createPluginEventBus(manifest.id),
                securityManager: this.securityManager,
                config: {}, // Start with empty config, plugin will initialize defaults
                dataPath: path.join(process.env.APPDATA || process.env.HOME, '.wit', 'plugin-data', manifest.id)
            });
            
            // Validate plugin interface
            this.validatePluginInterface(plugin);
            
            // Store plugin
            this.plugins.set(manifest.id, {
                manifest,
                instance: plugin,
                path: pluginPath,
                state: 'loaded'
            });
            
            this.pluginStates.set(manifest.id, 'loaded');
            
            logger.info(`Loaded plugin: ${manifest.name} v${manifest.version}`);
            this.eventBus.emit('plugin:loaded', { pluginId: manifest.id, manifest });
            
            return manifest.id;
            
        } catch (error) {
            logger.error(`Failed to load plugin from ${pluginPath}:`, error);
            throw error;
        }
    }
    
    /**
     * Start a plugin
     */
    async startPlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        
        if (this.pluginStates.get(pluginId) === 'started') {
            logger.warn(`Plugin ${pluginId} is already started`);
            return;
        }
        
        try {
            // Check permissions
            const requiredPermissions = plugin.manifest.permissions || [];
            for (const permission of requiredPermissions) {
                const granted = await this.securityManager.checkPermission(pluginId, permission);
                if (!granted) {
                    throw new Error(`Permission denied: ${permission}`);
                }
            }
            
            // Initialize plugin
            await plugin.instance.initialize();
            
            // Start plugin
            await plugin.instance.start();
            
            this.pluginStates.set(pluginId, 'started');
            plugin.state = 'started';
            
            logger.info(`Started plugin: ${pluginId}`);
            this.eventBus.emit('plugin:started', { pluginId });
            
        } catch (error) {
            logger.error(`Failed to start plugin ${pluginId}:`, error);
            this.eventBus.emit('plugin:error', { pluginId, error: error.message });
            throw error;
        }
    }
    
    /**
     * Stop a plugin
     */
    async stopPlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        
        if (this.pluginStates.get(pluginId) !== 'started') {
            logger.warn(`Plugin ${pluginId} is not started`);
            return;
        }
        
        try {
            await plugin.instance.stop();
            
            this.pluginStates.set(pluginId, 'stopped');
            plugin.state = 'stopped';
            
            logger.info(`Stopped plugin: ${pluginId}`);
            this.eventBus.emit('plugin:stopped', { pluginId });
            
        } catch (error) {
            logger.error(`Failed to stop plugin ${pluginId}:`, error);
            throw error;
        }
    }
    
    /**
     * Route a message to a plugin
     */
    async routeMessage(message) {
        const { pluginId, action, payload, messageId } = message;
        
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        
        if (this.pluginStates.get(pluginId) !== 'started') {
            throw new Error(`Plugin ${pluginId} is not started`);
        }
        
        try {
            const result = await plugin.instance.onMessage({
                action,
                payload,
                messageId: messageId || uuidv4()
            });
            
            return {
                success: true,
                result,
                messageId
            };
            
        } catch (error) {
            logger.error(`Plugin ${pluginId} message handling error:`, error);
            return {
                success: false,
                error: error.message,
                messageId
            };
        }
    }
    
    /**
     * Get status of all plugins
     */
    getPluginStatuses() {
        const statuses = {};
        
        for (const [pluginId, plugin] of this.plugins) {
            statuses[pluginId] = {
                id: pluginId,
                name: plugin.manifest.name,
                version: plugin.manifest.version,
                state: this.pluginStates.get(pluginId),
                status: plugin.instance.getStatus ? plugin.instance.getStatus() : {}
            };
        }
        
        return statuses;
    }
    
    /**
     * Stop all plugins
     */
    async stopAll() {
        logger.info('Stopping all plugins...');
        
        for (const [pluginId, state] of this.pluginStates) {
            if (state === 'started') {
                try {
                    await this.stopPlugin(pluginId);
                } catch (error) {
                    logger.error(`Failed to stop plugin ${pluginId}:`, error);
                }
            }
        }
    }
    
    /**
     * Create a scoped event bus for a plugin
     */
    createPluginEventBus(pluginId) {
        return {
            emit: (event, data) => {
                this.eventBus.emit('plugin:message', {
                    pluginId,
                    event,
                    data
                });
            },
            
            on: (event, callback) => {
                // Subscribe to plugin-specific events
                const handler = (data) => {
                    if (data.pluginId === pluginId) {
                        callback(data);
                    }
                };
                this.eventBus.on(`plugin:${pluginId}:${event}`, handler);
                return () => this.eventBus.off(`plugin:${pluginId}:${event}`, handler);
            }
        };
    }
    
    /**
     * Validate plugin manifest
     */
    validateManifest(manifest) {
        const required = ['id', 'name', 'version', 'main'];
        for (const field of required) {
            if (!manifest[field]) {
                throw new Error(`Missing required field in manifest: ${field}`);
            }
        }
        
        // Validate ID format
        if (!/^[a-z0-9-]+$/.test(manifest.id)) {
            throw new Error('Plugin ID must contain only lowercase letters, numbers, and hyphens');
        }
    }
    
    /**
     * Validate plugin interface
     */
    validatePluginInterface(plugin) {
        const required = ['initialize', 'start', 'stop', 'onMessage'];
        for (const method of required) {
            if (typeof plugin[method] !== 'function') {
                throw new Error(`Plugin missing required method: ${method}`);
            }
        }
    }
    
    /**
     * Get all loaded plugins
     */
    getLoadedPlugins() {
        const plugins = {};
        for (const [id, plugin] of this.plugins) {
            try {
                // Get status in a safe way
                let status = {};
                if (plugin.instance && typeof plugin.instance.getStatus === 'function') {
                    try {
                        status = plugin.instance.getStatus() || {};
                    } catch (err) {
                        logger.warn(`Failed to get status for plugin ${id}:`, err.message);
                    }
                }
                
                plugins[id] = {
                    id: id,
                    name: plugin.manifest.name,
                    version: plugin.manifest.version,
                    description: plugin.manifest.description,
                    state: plugin.state,
                    // Ensure status is serializable
                    status: JSON.parse(JSON.stringify(status))
                };
            } catch (error) {
                logger.error(`Error processing plugin ${id} for serialization:`, error);
                // Add minimal plugin info on error
                plugins[id] = {
                    id: id,
                    name: plugin.manifest?.name || 'Unknown',
                    version: plugin.manifest?.version || '0.0.0',
                    description: plugin.manifest?.description || '',
                    state: plugin.state || 'error',
                    status: {}
                };
            }
        }
        return plugins;
    }
    
    /**
     * Send a message to a specific plugin
     */
    async sendMessageToPlugin(pluginId, message) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin not found: ${pluginId}`);
        }
        
        if (plugin.state !== 'started') {
            throw new Error(`Plugin not started: ${pluginId}`);
        }
        
        // Send message to plugin
        return await plugin.instance.onMessage(message);
    }
    
    /**
     * Get plugin configuration
     */
    async getPluginConfiguration(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin not found: ${pluginId}`);
        }
        
        // Try to load saved configuration
        const configPath = path.join(plugin.pluginPath, 'config.json');
        try {
            const configData = await fs.readFile(configPath, 'utf8');
            const savedConfig = JSON.parse(configData);
            
            // Merge with plugin's default configuration schema
            const defaultConfig = plugin.manifest.configuration || {};
            return {
                schema: defaultConfig,
                values: savedConfig
            };
        } catch (error) {
            // Return default configuration if no saved config exists
            return {
                schema: plugin.manifest.configuration || {},
                values: {}
            };
        }
    }
    
    /**
     * Save plugin configuration
     */
    async savePluginConfiguration(pluginId, config) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin not found: ${pluginId}`);
        }
        
        // Save configuration to plugin directory
        const configPath = path.join(plugin.pluginPath, 'config.json');
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
        
        // If plugin is running, notify it of configuration change
        if (plugin.state === 'started' && plugin.instance && typeof plugin.instance.onConfigurationChanged === 'function') {
            try {
                await plugin.instance.onConfigurationChanged(config);
            } catch (error) {
                logger.warn(`Plugin ${pluginId} failed to handle configuration change:`, error.message);
            }
        }
        
        logger.info(`Saved configuration for plugin ${pluginId}`);
    }
    
    /**
     * Create a new plugin from template
     */
    async createPlugin(pluginInfo) {
        const { id, name, description, template } = pluginInfo;
        
        // Validate plugin ID
        if (!/^[a-z0-9-]+$/.test(id)) {
            throw new Error('Plugin ID must contain only lowercase letters, numbers, and hyphens');
        }
        
        if (this.plugins.has(id)) {
            throw new Error(`Plugin with ID ${id} already exists`);
        }
        
        // Create plugin directory
        const pluginPath = path.join(this.pluginDirs[1], id); // Use user plugins directory
        await fs.mkdir(pluginPath, { recursive: true });
        
        // Create plugin files from template
        await this.createPluginFromTemplate(pluginPath, { id, name, description, template });
        
        logger.info(`Created new plugin: ${id} at ${pluginPath}`);
        return pluginPath;
    }
    
    /**
     * Create plugin files from template
     */
    async createPluginFromTemplate(pluginPath, pluginInfo) {
        const { id, name, description, template } = pluginInfo;
        
        // Create manifest.json
        const manifest = {
            id,
            name,
            version: "1.0.0",
            description: description || `Custom plugin: ${name}`,
            author: "User",
            main: "index.js",
            permissions: [],
            configuration: {
                enabled: {
                    type: "boolean",
                    default: true,
                    title: "Enable Plugin",
                    description: "Enable or disable this plugin"
                }
            }
        };
        
        await fs.writeFile(
            path.join(pluginPath, 'manifest.json'),
            JSON.stringify(manifest, null, 2),
            'utf8'
        );
        
        // Create package.json
        const packageJson = {
            name: id,
            version: "1.0.0",
            description: description || `Custom plugin: ${name}`,
            main: "index.js",
            dependencies: {}
        };
        
        await fs.writeFile(
            path.join(pluginPath, 'package.json'),
            JSON.stringify(packageJson, null, 2),
            'utf8'
        );
        
        // Create index.js from template
        const indexJs = this.generatePluginTemplate(template, pluginInfo);
        await fs.writeFile(
            path.join(pluginPath, 'index.js'),
            indexJs,
            'utf8'
        );
        
        // Create README.md
        const readme = `# ${name}

${description || `Custom plugin: ${name}`}

## Configuration

This plugin can be configured through the W.I.T. Desktop Controller settings.

## Development

To modify this plugin, edit the \`index.js\` file and restart the plugin through the settings interface.
`;
        
        await fs.writeFile(
            path.join(pluginPath, 'README.md'),
            readme,
            'utf8'
        );
    }
    
    /**
     * Generate plugin template code
     */
    generatePluginTemplate(template, pluginInfo) {
        const templates = {
            basic: `const { WITPlugin } = require('../../core/WITPlugin');

class ${pluginInfo.name.replace(/[^a-zA-Z0-9]/g, '')}Plugin extends WITPlugin {
    constructor(manifest, pluginPath, eventBus) {
        super(manifest, pluginPath, eventBus);
        this.status = 'inactive';
    }
    
    async start() {
        this.log('info', 'Starting ${pluginInfo.name}...');
        this.status = 'active';
        this.log('info', '${pluginInfo.name} started successfully');
    }
    
    async stop() {
        this.log('info', 'Stopping ${pluginInfo.name}...');
        this.status = 'inactive';
        this.log('info', '${pluginInfo.name} stopped');
    }
    
    async onMessage(message) {
        switch (message.action) {
            case 'getStatus':
                return {
                    status: this.status,
                    name: '${pluginInfo.name}',
                    timestamp: new Date().toISOString()
                };
            default:
                throw new Error(\`Unknown action: \${message.action}\`);
        }
    }
    
    async onConfigurationChanged(config) {
        this.log('info', 'Configuration updated:', config);
        // Handle configuration changes here
    }
}

module.exports = ${pluginInfo.name.replace(/[^a-zA-Z0-9]/g, '')}Plugin;`,

            application: `const { WITPlugin } = require('../../core/WITPlugin');
const { spawn, exec } = require('child_process');
const path = require('path');

class ${pluginInfo.name.replace(/[^a-zA-Z0-9]/g, '')}Plugin extends WITPlugin {
    constructor(manifest, pluginPath, eventBus) {
        super(manifest, pluginPath, eventBus);
        this.status = 'inactive';
        this.process = null;
    }
    
    async start() {
        this.log('info', 'Starting ${pluginInfo.name}...');
        this.status = 'active';
        this.log('info', '${pluginInfo.name} started successfully');
    }
    
    async stop() {
        this.log('info', 'Stopping ${pluginInfo.name}...');
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
        this.status = 'inactive';
        this.log('info', '${pluginInfo.name} stopped');
    }
    
    async launchApplication(applicationPath, args = []) {
        if (this.process) {
            throw new Error('Application is already running');
        }
        
        return new Promise((resolve, reject) => {
            this.process = spawn(applicationPath, args, {
                detached: false,
                stdio: 'pipe'
            });
            
            this.process.on('spawn', () => {
                this.log('info', \`Launched application: \${applicationPath}\`);
                resolve({ success: true, pid: this.process.pid });
            });
            
            this.process.on('error', (error) => {
                this.log('error', \`Failed to launch application: \${error.message}\`);
                this.process = null;
                reject(error);
            });
            
            this.process.on('exit', (code) => {
                this.log('info', \`Application exited with code \${code}\`);
                this.process = null;
            });
        });
    }
    
    async onMessage(message) {
        switch (message.action) {
            case 'getStatus':
                return {
                    status: this.status,
                    name: '${pluginInfo.name}',
                    running: this.process !== null,
                    pid: this.process ? this.process.pid : null,
                    timestamp: new Date().toISOString()
                };
            case 'launch':
                const { applicationPath, args } = message.payload;
                return await this.launchApplication(applicationPath, args);
            default:
                throw new Error(\`Unknown action: \${message.action}\`);
        }
    }
}

module.exports = ${pluginInfo.name.replace(/[^a-zA-Z0-9]/g, '')}Plugin;`,

            service: `const { WITPlugin } = require('../../core/WITPlugin');
const http = require('http');

class ${pluginInfo.name.replace(/[^a-zA-Z0-9]/g, '')}Plugin extends WITPlugin {
    constructor(manifest, pluginPath, eventBus) {
        super(manifest, pluginPath, eventBus);
        this.status = 'inactive';
        this.server = null;
    }
    
    async start() {
        this.log('info', 'Starting ${pluginInfo.name}...');
        
        // Create HTTP server for this service
        this.server = http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                plugin: '${pluginInfo.name}',
                status: this.status,
                timestamp: new Date().toISOString()
            }));
        });
        
        this.server.listen(0, 'localhost', () => {
            const port = this.server.address().port;
            this.log('info', \`${pluginInfo.name} service listening on port \${port}\`);
        });
        
        this.status = 'active';
        this.log('info', '${pluginInfo.name} started successfully');
    }
    
    async stop() {
        this.log('info', 'Stopping ${pluginInfo.name}...');
        
        if (this.server) {
            this.server.close();
            this.server = null;
        }
        
        this.status = 'inactive';
        this.log('info', '${pluginInfo.name} stopped');
    }
    
    async onMessage(message) {
        switch (message.action) {
            case 'getStatus':
                return {
                    status: this.status,
                    name: '${pluginInfo.name}',
                    port: this.server ? this.server.address().port : null,
                    timestamp: new Date().toISOString()
                };
            default:
                throw new Error(\`Unknown action: \${message.action}\`);
        }
    }
}

module.exports = ${pluginInfo.name.replace(/[^a-zA-Z0-9]/g, '')}Plugin;`
        };
        
        return templates[template] || templates.basic;
    }
}

module.exports = { PluginManager };