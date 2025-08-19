/**
 * WITPlugin - Base class for all W.I.T. plugins
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class WITPlugin extends EventEmitter {
    constructor(context) {
        super();
        
        this.id = context.id;
        this.eventBus = context.eventBus;
        this.securityManager = context.securityManager;
        this.config = context.config || {};
        this.dataPath = context.dataPath;
        
        this.initialized = false;
        this.started = false;
        
        // Ensure data directory exists
        this._ensureDataPath();
    }
    
    async _ensureDataPath() {
        try {
            await fs.mkdir(this.dataPath, { recursive: true });
        } catch (error) {
            console.error(`Failed to create data path for plugin ${this.id}:`, error);
        }
    }
    
    /**
     * Initialize the plugin (called once when loaded)
     * Override this method in your plugin
     */
    async initialize() {
        if (this.initialized) {
            throw new Error('Plugin already initialized');
        }
        
        this.initialized = true;
        this.log('Plugin initialized');
    }
    
    /**
     * Start the plugin (called when activated)
     * Override this method in your plugin
     */
    async start() {
        if (!this.initialized) {
            throw new Error('Plugin not initialized');
        }
        
        if (this.started) {
            throw new Error('Plugin already started');
        }
        
        this.started = true;
        this.log('Plugin started');
    }
    
    /**
     * Stop the plugin (called when deactivated)
     * Override this method in your plugin
     */
    async stop() {
        if (!this.started) {
            throw new Error('Plugin not started');
        }
        
        this.started = false;
        this.log('Plugin stopped');
    }
    
    /**
     * Destroy the plugin (called when unloaded)
     * Override this method in your plugin
     */
    async destroy() {
        if (this.started) {
            await this.stop();
        }
        
        this.initialized = false;
        this.log('Plugin destroyed');
    }
    
    /**
     * Handle incoming messages
     * Override this method in your plugin
     */
    async onMessage(message) {
        throw new Error('onMessage not implemented');
    }
    
    /**
     * Get plugin status
     * Override this method to provide custom status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            started: this.started,
            uptime: this.started ? Date.now() - this.startTime : 0
        };
    }
    
    /**
     * Send a message to the backend
     */
    sendMessage(message) {
        this.eventBus.emit('message', {
            pluginId: this.id,
            message
        });
    }
    
    /**
     * Request a permission
     */
    async requestPermission(permission) {
        return await this.securityManager.checkPermission(this.id, permission);
    }
    
    /**
     * Read a file (with permission check)
     */
    async readFile(filePath) {
        if (!await this.requestPermission('file:read')) {
            throw new Error('Permission denied: file:read');
        }
        
        return await fs.readFile(filePath, 'utf8');
    }
    
    /**
     * Write a file (with permission check)
     */
    async writeFile(filePath, content) {
        if (!await this.requestPermission('file:write')) {
            throw new Error('Permission denied: file:write');
        }
        
        return await fs.writeFile(filePath, content, 'utf8');
    }
    
    /**
     * Make an HTTP request (with permission check)
     */
    async fetch(url, options = {}) {
        if (!await this.requestPermission('network:http')) {
            throw new Error('Permission denied: network:http');
        }
        
        // Use native fetch in Electron (available in recent versions)
        return await fetch(url, options);
    }
    
    /**
     * Save plugin data
     */
    async saveData(filename, data) {
        const filePath = path.join(this.dataPath, filename);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    }
    
    /**
     * Load plugin data
     */
    async loadData(filename, defaultValue = null) {
        const filePath = path.join(this.dataPath, filename);
        
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return defaultValue;
            }
            throw error;
        }
    }
    
    /**
     * Log a message
     */
    log(message, level = 'info') {
        // Handle case where level is passed as second parameter
        if (typeof level !== 'string' || !['info', 'warn', 'error', 'debug'].includes(level)) {
            // If level is not a valid log level, treat it as part of the message
            if (level !== undefined) {
                message = `${message} ${level}`;
            }
            level = 'info';
        }
        
        console.log(`[${this.id}] ${message}`);
        
        this.eventBus.emit('log', {
            pluginId: this.id,
            level,
            message,
            timestamp: Date.now()
        });
    }
    
    /**
     * Log an error
     */
    error(message, error) {
        console.error(`[${this.id}] ${message}`, error);
        
        this.eventBus.emit('error', {
            pluginId: this.id,
            message,
            error: error.message,
            stack: error.stack,
            timestamp: Date.now()
        });
    }
}

module.exports = { WITPlugin };