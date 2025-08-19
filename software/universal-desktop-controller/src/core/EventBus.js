/**
 * EventBus - Central event system for the Universal Desktop Controller
 * Handles all inter-component communication
 */

const EventEmitter = require('events');

class EventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(100); // Support many plugins
        
        // Track event subscriptions for debugging
        this.subscriptions = new Map();
    }
    
    /**
     * Override emit to add logging and tracking
     */
    emit(eventName, ...args) {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[EventBus] Emitting: ${eventName}`, args[0]);
        }
        
        return super.emit(eventName, ...args);
    }
    
    /**
     * Subscribe to an event with metadata
     */
    subscribe(eventName, callback, subscriberId) {
        this.on(eventName, callback);
        
        // Track subscription
        if (!this.subscriptions.has(eventName)) {
            this.subscriptions.set(eventName, new Set());
        }
        this.subscriptions.get(eventName).add(subscriberId);
        
        return () => this.unsubscribe(eventName, callback, subscriberId);
    }
    
    /**
     * Unsubscribe from an event
     */
    unsubscribe(eventName, callback, subscriberId) {
        this.off(eventName, callback);
        
        if (this.subscriptions.has(eventName)) {
            this.subscriptions.get(eventName).delete(subscriberId);
        }
    }
    
    /**
     * Get all active subscriptions (for debugging)
     */
    getSubscriptions() {
        const result = {};
        for (const [event, subscribers] of this.subscriptions) {
            result[event] = Array.from(subscribers);
        }
        return result;
    }
    
    /**
     * Wait for an event (Promise-based)
     */
    waitFor(eventName, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.off(eventName, handler);
                reject(new Error(`Timeout waiting for event: ${eventName}`));
            }, timeout);
            
            const handler = (...args) => {
                clearTimeout(timer);
                resolve(args);
            };
            
            this.once(eventName, handler);
        });
    }
}

// Event name constants to prevent typos
EventBus.Events = {
    // WebSocket events
    WEBSOCKET_CONNECTING: 'websocket:connecting',
    WEBSOCKET_CONNECTED: 'websocket:connected',
    WEBSOCKET_DISCONNECTED: 'websocket:disconnected',
    WEBSOCKET_ERROR: 'websocket:error',
    WEBSOCKET_MESSAGE: 'websocket:message',
    
    // Plugin events
    PLUGIN_LOADED: 'plugin:loaded',
    PLUGIN_STARTED: 'plugin:started',
    PLUGIN_STOPPED: 'plugin:stopped',
    PLUGIN_ERROR: 'plugin:error',
    PLUGIN_MESSAGE: 'plugin:message',
    
    // Security events
    SECURITY_PERMISSION_REQUEST: 'security:permission_request',
    SECURITY_PERMISSION_GRANTED: 'security:permission_granted',
    SECURITY_PERMISSION_DENIED: 'security:permission_denied',
    
    // File system events
    FILE_CHANGED: 'file:changed',
    FILE_CREATED: 'file:created',
    FILE_DELETED: 'file:deleted',
    
    // Application events
    APP_READY: 'app:ready',
    APP_QUIT: 'app:quit',
    APP_ERROR: 'app:error'
};

module.exports = { EventBus };