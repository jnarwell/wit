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
                config: manifest.config || {},
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
            plugins[id] = {
                id: plugin.id,
                name: plugin.manifest.name,
                version: plugin.manifest.version,
                description: plugin.manifest.description,
                state: plugin.state,
                status: plugin.instance ? plugin.instance.getStatus() : null
            };
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
}

module.exports = { PluginManager };