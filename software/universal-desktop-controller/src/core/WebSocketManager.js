/**
 * WebSocketManager - Manages WebSocket connection to W.I.T. backend
 */

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const logger = require('./Logger');

class WebSocketManager {
    constructor(eventBus, configManager, pluginManager) {
        this.eventBus = eventBus;
        this.configManager = configManager;
        this.pluginManager = pluginManager;
        this.ws = null;
        this.reconnectInterval = 5000;
        this.maxReconnectInterval = 30000;
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.shouldReconnect = true;
        this.pingInterval = null;
        this.messageQueue = [];
        this.pendingResponses = new Map();
    }
    
    /**
     * Connect to W.I.T. backend
     */
    async connect(serverUrl, authToken) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            logger.warn('WebSocket already connected');
            return;
        }
        
        if (this.isConnecting) {
            logger.warn('WebSocket connection already in progress');
            return;
        }
        
        this.serverUrl = serverUrl;
        this.authToken = authToken;
        this.shouldReconnect = true;
        
        return this._connect();
    }
    
    async _connect() {
        this.isConnecting = true;
        this.eventBus.emit('websocket:connecting');
        
        try {
            // Convert HTTP URL to WebSocket URL and force IPv4
            let wsUrl = this.serverUrl.replace(/^http/, 'ws');
            // Replace localhost with 127.0.0.1 to force IPv4
            wsUrl = wsUrl.replace('localhost', '127.0.0.1');
            const fullUrl = `${wsUrl}/ws/desktop-controller`;
            
            logger.info(`Connecting to W.I.T. backend at ${fullUrl}`);
            
            this.ws = new WebSocket(fullUrl, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'X-Controller-Version': require('../../package.json').version,
                    'X-Controller-ID': this.configManager.getControllerId()
                }
            });
            
            this.ws.on('open', () => this._handleOpen());
            this.ws.on('close', (code, reason) => this._handleClose(code, reason));
            this.ws.on('error', (error) => this._handleError(error));
            this.ws.on('message', (data) => this._handleMessage(data));
            this.ws.on('pong', () => this._handlePong());
            
        } catch (error) {
            logger.error('Failed to create WebSocket:', error);
            this.isConnecting = false;
            this._scheduleReconnect();
        }
    }
    
    _handleOpen() {
        logger.info('WebSocket connected to W.I.T. backend');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Send registration message
        this.sendMessage({
            type: 'register',
            controllerId: this.configManager.getControllerId(),
            capabilities: this._getCapabilities()
        });
        
        // Process queued messages
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this._send(message);
        }
        
        // Start ping interval
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.ping();
            }
        }, 30000);
        
        this.eventBus.emit('websocket:connected');
    }
    
    _handleClose(code, reason) {
        logger.info(`WebSocket closed: ${code} - ${reason}`);
        this.isConnecting = false;
        
        // Clear ping interval
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        // Reject pending responses
        for (const [messageId, handler] of this.pendingResponses) {
            handler.reject(new Error('WebSocket connection closed'));
        }
        this.pendingResponses.clear();
        
        this.eventBus.emit('websocket:disconnected', { code, reason });
        
        if (this.shouldReconnect) {
            this._scheduleReconnect();
        }
    }
    
    _handleError(error) {
        logger.error('WebSocket error:', error);
        this.eventBus.emit('websocket:error', error);
    }
    
    _handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            
            // Check if this is a response to a pending request
            if (message.responseId && this.pendingResponses.has(message.responseId)) {
                const handler = this.pendingResponses.get(message.responseId);
                this.pendingResponses.delete(message.responseId);
                
                if (message.error) {
                    handler.reject(new Error(message.error));
                } else {
                    handler.resolve(message.result);
                }
                return;
            }
            
            // Emit message for plugins to handle
            this.eventBus.emit('websocket:message', message);
            
            // Handle specific message types
            switch (message.type) {
                case 'ping':
                    this.sendMessage({ type: 'pong', timestamp: Date.now() });
                    break;
                    
                case 'plugin_command':
                    this._handlePluginCommand(message);
                    break;
                    
                case 'plugin_response':
                    // Handle plugin response from backend
                    this.eventBus.emit('plugin:response', message);
                    break;
                    
                case 'config_update':
                    this._handleConfigUpdate(message);
                    break;
                    
                case 'plugin_list':
                    // Respond to plugin list request
                    logger.info('Received plugin list request, sending current plugin status');
                    this._sendPluginList();
                    break;
                    
                default:
                    logger.debug('Received message:', message);
            }
            
        } catch (error) {
            logger.error('Failed to parse WebSocket message:', error);
        }
    }
    
    _handlePong() {
        // Connection is alive
        logger.debug('Received pong from server');
    }
    
    _handlePluginCommand(message) {
        // Forward to plugin manager via event bus
        this.eventBus.emit('plugin:command', {
            pluginId: message.pluginId,
            action: message.action,
            payload: message.payload,
            messageId: message.messageId
        });
    }
    
    _handleConfigUpdate(message) {
        // Update configuration
        if (message.config) {
            this.configManager.updateConfig(message.config);
        }
    }
    
    /**
     * Send a message to the backend
     */
    async sendMessage(message, expectResponse = false) {
        const messageId = message.messageId || uuidv4();
        const fullMessage = {
            ...message,
            messageId,
            timestamp: Date.now()
        };
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this._send(fullMessage);
            
            if (expectResponse) {
                return new Promise((resolve, reject) => {
                    this.pendingResponses.set(messageId, { resolve, reject });
                    
                    // Timeout after 30 seconds
                    setTimeout(() => {
                        if (this.pendingResponses.has(messageId)) {
                            this.pendingResponses.delete(messageId);
                            reject(new Error('Response timeout'));
                        }
                    }, 30000);
                });
            }
        } else {
            // Queue message if not connected
            this.messageQueue.push(fullMessage);
            
            if (expectResponse) {
                throw new Error('WebSocket not connected');
            }
        }
    }
    
    _send(message) {
        try {
            this.ws.send(JSON.stringify(message));
            logger.debug('Sent message:', message.type);
        } catch (error) {
            logger.error('Failed to send message:', error);
            throw error;
        }
    }
    
    /**
     * Send plugin list to backend
     */
    async _sendPluginList() {
        try {
            const plugins = this.pluginManager.getLoadedPlugins();
            const pluginList = Object.values(plugins);
            
            logger.info(`Sending plugin list with ${pluginList.length} plugins`);
            console.log('[WebSocketManager] Sending plugin list:', JSON.stringify(pluginList, null, 2));
            
            this.sendMessage({
                type: 'plugin_list_response',
                plugins: pluginList,
                timestamp: Date.now()
            });
        } catch (error) {
            logger.error('Failed to send plugin list:', error);
        }
    }
    
    /**
     * Disconnect from backend
     */
    async disconnect() {
        this.shouldReconnect = false;
        
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        if (this.ws) {
            this.ws.close(1000, 'Normal closure');
            this.ws = null;
        }
    }
    
    _scheduleReconnect() {
        if (!this.shouldReconnect) {
            return;
        }
        
        this.reconnectAttempts++;
        const delay = Math.min(
            this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
            this.maxReconnectInterval
        );
        
        logger.info(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
            if (this.shouldReconnect) {
                this._connect();
            }
        }, delay);
    }
    
    _getCapabilities() {
        // Get loaded plugins and their capabilities
        const capabilities = {
            version: require('../../package.json').version,
            platform: process.platform,
            plugins: [] // Will be populated by plugin manager
        };
        
        return capabilities;
    }
    
    /**
     * Get connection status
     */
    getStatus() {
        return {
            connected: this.ws && this.ws.readyState === WebSocket.OPEN,
            connecting: this.isConnecting,
            reconnectAttempts: this.reconnectAttempts,
            queuedMessages: this.messageQueue.length
        };
    }
}

module.exports = { WebSocketManager };