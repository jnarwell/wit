/**
 * Base WITPlugin class - Foundation for all W.I.T. Desktop Controller plugins
 */

const logger = require('./Logger');

class WITPlugin {
    constructor(config) {
        this.id = config.id;
        this.eventBus = config.eventBus;
        this.securityManager = config.securityManager;
        this.config = config.config || {};
        this.dataPath = config.dataPath;
        this.state = 'loaded';
        this.logger = logger;
    }

    /**
     * Initialize the plugin - called after construction but before start
     */
    async initialize() {
        this.log('info', `Initializing plugin ${this.id}...`);
        // Override in subclasses
    }

    /**
     * Start the plugin - called to activate plugin functionality
     */
    async start() {
        this.log('info', `Starting plugin ${this.id}...`);
        this.state = 'started';
        // Override in subclasses
    }

    /**
     * Stop the plugin - called to deactivate plugin functionality
     */
    async stop() {
        this.log('info', `Stopping plugin ${this.id}...`);
        this.state = 'stopped';
        // Override in subclasses
    }

    /**
     * Handle incoming messages from the main process or other plugins
     */
    async onMessage(message) {
        this.log('debug', `Received message:`, message);
        
        switch (message.action) {
            case 'getStatus':
                return this.getStatus();
            case 'ping':
                return { pong: true, timestamp: new Date().toISOString() };
            default:
                throw new Error(`Unknown action: ${message.action}`);
        }
    }

    /**
     * Get plugin status - called periodically for monitoring
     */
    getStatus() {
        return {
            id: this.id,
            state: this.state,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Handle configuration changes - called when plugin config is updated
     */
    async onConfigurationChanged(config) {
        this.log('info', `Configuration updated for ${this.id}:`, config);
        this.config = { ...this.config, ...config };
        // Override in subclasses to handle config changes
    }

    /**
     * Emit events through the plugin event bus
     */
    emit(event, data) {
        if (this.eventBus && typeof this.eventBus.emit === 'function') {
            this.eventBus.emit(event, { pluginId: this.id, ...data });
        }
    }

    /**
     * Subscribe to events through the plugin event bus
     */
    on(event, callback) {
        if (this.eventBus && typeof this.eventBus.on === 'function') {
            return this.eventBus.on(event, callback);
        }
        return () => {}; // Return empty unsubscribe function
    }

    /**
     * Log messages with plugin context
     */
    log(level, message, ...args) {
        const prefix = `[${this.id}]`;
        if (this.logger && typeof this.logger[level] === 'function') {
            this.logger[level](prefix, message, ...args);
        } else {
            console.log(`${level.toUpperCase()} ${prefix}`, message, ...args);
        }
    }

    /**
     * Get plugin configuration value with fallback
     */
    getConfigValue(key, defaultValue = null) {
        return this.config[key] !== undefined ? this.config[key] : defaultValue;
    }

    /**
     * Set plugin configuration value
     */
    setConfigValue(key, value) {
        this.config[key] = value;
    }

    /**
     * Check if plugin has required permission
     */
    async hasPermission(permission) {
        if (this.securityManager && typeof this.securityManager.checkPermission === 'function') {
            return await this.securityManager.checkPermission(this.id, permission);
        }
        return true; // Default to allow if no security manager
    }

    /**
     * Request permission from security manager
     */
    async requestPermission(permission, reason = '') {
        if (this.securityManager && typeof this.securityManager.requestPermission === 'function') {
            return await this.securityManager.requestPermission(this.id, permission, reason);
        }
        return true; // Default to allow if no security manager
    }
}

module.exports = { WITPlugin };