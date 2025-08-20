/**
 * SecurityManager - Handles permissions and security for plugins
 */

const { dialog } = require('electron');
const crypto = require('crypto');
const logger = require('./Logger');

class SecurityManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.permissions = new Map(); // pluginId -> Set of permissions
        this.trustedPlugins = new Set();
        this.blockedPlugins = new Set();
        
        // Define available permissions
        this.availablePermissions = {
            'file:read': 'Read files from the file system',
            'file:write': 'Write files to the file system',
            'file:delete': 'Delete files from the file system',
            'network:http': 'Make HTTP requests',
            'network:websocket': 'Create WebSocket connections',
            'system:execute': 'Execute system commands',
            'hardware:serial': 'Access serial ports',
            'hardware:usb': 'Access USB devices',
            'app:launch': 'Launch external applications',
            'clipboard:read': 'Read from clipboard',
            'clipboard:write': 'Write to clipboard'
        };
    }
    
    async initialize() {
        logger.info('Initializing Security Manager...');
        
        // Load saved permissions
        await this.loadPermissions();
        
        // Auto-trust built-in plugins from W.I.T.
        this.autoTrustBuiltinPlugins();
    }
    
    /**
     * Check if a plugin has a specific permission
     */
    async checkPermission(pluginId, permission) {
        // Check if plugin is blocked
        if (this.blockedPlugins.has(pluginId)) {
            logger.warn(`Plugin ${pluginId} is blocked`);
            return false;
        }
        
        // Check if plugin is trusted (has all permissions)
        if (this.trustedPlugins.has(pluginId)) {
            return true;
        }
        
        // Check specific permission
        const pluginPermissions = this.permissions.get(pluginId);
        if (pluginPermissions && pluginPermissions.has(permission)) {
            return true;
        }
        
        // Permission not granted, request from user
        return await this.requestPermission(pluginId, permission);
    }
    
    /**
     * Request permission from user
     */
    async requestPermission(pluginId, permission) {
        const permissionDesc = this.availablePermissions[permission] || permission;
        
        const result = await dialog.showMessageBox({
            type: 'question',
            buttons: ['Deny', 'Allow Once', 'Allow Always', 'Trust Plugin'],
            defaultId: 0,
            title: 'Permission Request',
            message: `Plugin "${pluginId}" requests permission:`,
            detail: `${permissionDesc}\n\nDo you want to allow this?`,
            noLink: true
        });
        
        switch (result.response) {
            case 0: // Deny
                this.eventBus.emit('security:permission_denied', { pluginId, permission });
                return false;
                
            case 1: // Allow Once
                this.eventBus.emit('security:permission_granted', { pluginId, permission, once: true });
                return true;
                
            case 2: // Allow Always
                await this.grantPermission(pluginId, permission);
                this.eventBus.emit('security:permission_granted', { pluginId, permission });
                return true;
                
            case 3: // Trust Plugin
                await this.trustPlugin(pluginId);
                this.eventBus.emit('security:plugin_trusted', { pluginId });
                return true;
                
            default:
                return false;
        }
    }
    
    /**
     * Grant a permission to a plugin
     */
    async grantPermission(pluginId, permission) {
        if (!this.permissions.has(pluginId)) {
            this.permissions.set(pluginId, new Set());
        }
        
        this.permissions.get(pluginId).add(permission);
        await this.savePermissions();
        
        logger.info(`Granted permission "${permission}" to plugin "${pluginId}"`);
    }
    
    /**
     * Revoke a permission from a plugin
     */
    async revokePermission(pluginId, permission) {
        const pluginPermissions = this.permissions.get(pluginId);
        if (pluginPermissions) {
            pluginPermissions.delete(permission);
            if (pluginPermissions.size === 0) {
                this.permissions.delete(pluginId);
            }
        }
        
        await this.savePermissions();
        logger.info(`Revoked permission "${permission}" from plugin "${pluginId}"`);
    }
    
    /**
     * Trust a plugin (grant all permissions)
     */
    async trustPlugin(pluginId) {
        this.trustedPlugins.add(pluginId);
        this.blockedPlugins.delete(pluginId);
        await this.savePermissions();
        
        logger.info(`Trusted plugin "${pluginId}"`);
    }
    
    /**
     * Block a plugin (deny all permissions)
     */
    async blockPlugin(pluginId) {
        this.blockedPlugins.add(pluginId);
        this.trustedPlugins.delete(pluginId);
        this.permissions.delete(pluginId);
        await this.savePermissions();
        
        logger.info(`Blocked plugin "${pluginId}"`);
    }
    
    /**
     * Validate file path access
     */
    validateFilePath(pluginId, filePath, operation = 'read') {
        // Check if plugin has file permission
        const permission = `file:${operation}`;
        if (!this.checkPermission(pluginId, permission)) {
            throw new Error(`Permission denied: ${permission}`);
        }
        
        // Additional path validation
        // TODO: Implement path sandboxing
        
        return true;
    }
    
    /**
     * Validate network request
     */
    validateNetworkRequest(pluginId, url, method = 'GET') {
        // Check if plugin has network permission
        if (!this.checkPermission(pluginId, 'network:http')) {
            throw new Error('Permission denied: network:http');
        }
        
        // Additional URL validation
        // TODO: Implement URL whitelist/blacklist
        
        return true;
    }
    
    /**
     * Hash a plugin for integrity checking
     */
    async hashPlugin(pluginPath) {
        // TODO: Implement plugin hashing
        return crypto.randomBytes(32).toString('hex');
    }
    
    /**
     * Load saved permissions
     */
    async loadPermissions() {
        try {
            // TODO: Load from secure storage
            logger.info('Loaded security permissions');
        } catch (error) {
            logger.error('Failed to load permissions:', error);
        }
    }
    
    /**
     * Save permissions
     */
    async savePermissions() {
        try {
            // TODO: Save to secure storage
            const data = {
                permissions: Object.fromEntries(
                    Array.from(this.permissions.entries()).map(([k, v]) => [k, Array.from(v)])
                ),
                trustedPlugins: Array.from(this.trustedPlugins),
                blockedPlugins: Array.from(this.blockedPlugins)
            };
            
            logger.debug('Saved security permissions');
        } catch (error) {
            logger.error('Failed to save permissions:', error);
        }
    }
    
    /**
     * Auto-trust built-in W.I.T. plugins
     */
    autoTrustBuiltinPlugins() {
        const builtinPlugins = [
            'arduino-ide',
            'unified-slicer', 
            'matlab',
            'kicad',
            'labview',
            'node-red',
            'openscad',
            'vscode',
            'docker',
            'blender',
            'file-browser'
        ];
        
        for (const pluginId of builtinPlugins) {
            if (!this.blockedPlugins.has(pluginId)) {
                this.trustedPlugins.add(pluginId);
            }
        }
        
        logger.info(`Auto-trusted ${builtinPlugins.length} built-in plugins`);
    }

    /**
     * Get security status
     */
    getStatus() {
        return {
            totalPlugins: this.permissions.size + this.trustedPlugins.size,
            trustedPlugins: this.trustedPlugins.size,
            blockedPlugins: this.blockedPlugins.size,
            permissionGrants: Array.from(this.permissions.entries()).reduce(
                (total, [_, perms]) => total + perms.size, 0
            )
        };
    }
}

module.exports = { SecurityManager };