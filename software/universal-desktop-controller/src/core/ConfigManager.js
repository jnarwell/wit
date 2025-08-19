/**
 * ConfigManager - Manages configuration for the Universal Desktop Controller
 */

const Store = require('electron-store');
const { v4: uuidv4 } = require('uuid');
const logger = require('./Logger');

class ConfigManager {
    constructor() {
        this.store = new Store({
            name: 'wit-udc-config',
            defaults: {
                firstRun: true,
                controllerId: uuidv4(),
                witServer: 'http://localhost:8000',
                authToken: '',
                autoStart: true,
                plugins: {
                    autoLoad: true,
                    autoStart: []
                },
                security: {
                    requirePermissions: true,
                    trustedDomains: ['localhost', '127.0.0.1']
                },
                ui: {
                    theme: 'system',
                    showInDock: false,
                    notifications: true
                },
                advanced: {
                    logLevel: 'info',
                    debugMode: false,
                    performanceMonitoring: false
                }
            }
        });
    }
    
    async initialize() {
        logger.info('Initializing Config Manager...');
        
        // Ensure controller ID exists
        if (!this.store.get('controllerId')) {
            this.store.set('controllerId', uuidv4());
        }
        
        // Log current configuration (without sensitive data)
        const config = this.getConfig();
        logger.info('Current configuration:', {
            controllerId: config.controllerId,
            witServer: config.witServer,
            firstRun: config.firstRun,
            autoStart: config.autoStart
        });
    }
    
    /**
     * Get configuration value
     */
    get(key, defaultValue) {
        return this.store.get(key, defaultValue);
    }
    
    /**
     * Set configuration value
     */
    set(key, value) {
        this.store.set(key, value);
        logger.debug(`Config updated: ${key}`);
    }
    
    /**
     * Get all configuration
     */
    getConfig() {
        return this.store.store;
    }
    
    /**
     * Update configuration
     */
    setConfig(config) {
        for (const [key, value] of Object.entries(config)) {
            this.store.set(key, value);
        }
        logger.info('Configuration updated');
    }
    
    /**
     * Update partial configuration
     */
    updateConfig(updates) {
        const current = this.getConfig();
        const updated = this._deepMerge(current, updates);
        this.store.store = updated;
        logger.info('Configuration merged');
    }
    
    /**
     * Get controller ID
     */
    getControllerId() {
        return this.store.get('controllerId');
    }
    
    /**
     * Get W.I.T. server URL
     */
    getServerUrl() {
        return this.store.get('witServer');
    }
    
    /**
     * Set W.I.T. server URL
     */
    setServerUrl(url) {
        // Normalize URL
        url = url.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'http://' + url;
        }
        
        this.store.set('witServer', url);
    }
    
    /**
     * Get auth token
     */
    getAuthToken() {
        return this.store.get('authToken');
    }
    
    /**
     * Set auth token
     */
    setAuthToken(token) {
        this.store.set('authToken', token);
    }
    
    /**
     * Clear auth token
     */
    clearAuth() {
        this.store.delete('authToken');
    }
    
    /**
     * Get plugin configuration
     */
    getPluginConfig(pluginId) {
        return this.store.get(`plugins.configs.${pluginId}`, {});
    }
    
    /**
     * Set plugin configuration
     */
    setPluginConfig(pluginId, config) {
        this.store.set(`plugins.configs.${pluginId}`, config);
    }
    
    /**
     * Check if plugin should auto-start
     */
    shouldAutoStartPlugin(pluginId) {
        const autoStart = this.store.get('plugins.autoStart', []);
        return autoStart.includes(pluginId);
    }
    
    /**
     * Set plugin auto-start
     */
    setPluginAutoStart(pluginId, autoStart) {
        const current = this.store.get('plugins.autoStart', []);
        
        if (autoStart && !current.includes(pluginId)) {
            current.push(pluginId);
        } else if (!autoStart) {
            const index = current.indexOf(pluginId);
            if (index > -1) {
                current.splice(index, 1);
            }
        }
        
        this.store.set('plugins.autoStart', current);
    }
    
    /**
     * Reset configuration to defaults
     */
    reset() {
        this.store.clear();
        logger.info('Configuration reset to defaults');
    }
    
    /**
     * Export configuration
     */
    exportConfig() {
        const config = this.getConfig();
        // Remove sensitive data
        delete config.authToken;
        return config;
    }
    
    /**
     * Import configuration
     */
    importConfig(config) {
        // Preserve sensitive data
        const authToken = this.getAuthToken();
        const controllerId = this.getControllerId();
        
        // Import new config
        this.store.store = config;
        
        // Restore sensitive data
        this.setAuthToken(authToken);
        this.store.set('controllerId', controllerId);
        
        logger.info('Configuration imported');
    }
    
    /**
     * Deep merge objects
     */
    _deepMerge(target, source) {
        const output = Object.assign({}, target);
        
        if (this._isObject(target) && this._isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this._isObject(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = this._deepMerge(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        
        return output;
    }
    
    _isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }
}

module.exports = { ConfigManager };