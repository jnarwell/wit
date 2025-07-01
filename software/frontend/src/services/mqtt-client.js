/**
 * MQTT WebSocket Client for W.I.T. Frontend
 */

class MQTTClient {
    constructor(url = 'ws://localhost:8765/mqtt-ws') {
        this.url = url;
        this.ws = null;
        this.subscriptions = new Map();
        this.connected = false;
        this.reconnectTimer = null;
        this.reconnectDelay = 1000;
    }

    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);
                
                this.ws.onopen = () => {
                    console.log('MQTT WebSocket connected');
                    this.connected = true;
                    this.reconnectDelay = 1000;
                    
                    // Resubscribe to topics
                    for (const topic of this.subscriptions.keys()) {
                        this.subscribe(topic);
                    }
                    
                    resolve();
                };
                
                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleMessage(message);
                    } catch (e) {
                        console.error('Failed to parse MQTT message:', e);
                    }
                };
                
                this.ws.onerror = (error) => {
                    console.error('MQTT WebSocket error:', error);
                    reject(error);
                };
                
                this.ws.onclose = () => {
                    console.log('MQTT WebSocket disconnected');
                    this.connected = false;
                    this.scheduleReconnect();
                };
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.connected = false;
    }
    
    scheduleReconnect() {
        if (this.reconnectTimer) return;
        
        this.reconnectTimer = setTimeout(() => {
            console.log('Attempting to reconnect MQTT WebSocket...');
            this.connect().catch(err => {
                console.error('Reconnection failed:', err);
                this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
            });
            this.reconnectTimer = null;
        }, this.reconnectDelay);
    }
    
    subscribe(topic, callback) {
        if (!this.subscriptions.has(topic)) {
            this.subscriptions.set(topic, new Set());
            
            // Send subscription request if connected
            if (this.connected && this.ws) {
                this.ws.send(JSON.stringify({
                    action: 'subscribe',
                    topic: topic
                }));
            }
        }
        
        if (callback) {
            this.subscriptions.get(topic).add(callback);
        }
    }
    
    unsubscribe(topic, callback) {
        if (this.subscriptions.has(topic)) {
            const callbacks = this.subscriptions.get(topic);
            if (callback) {
                callbacks.delete(callback);
            }
            
            if (!callback || callbacks.size === 0) {
                this.subscriptions.delete(topic);
                
                // Send unsubscribe request if connected
                if (this.connected && this.ws) {
                    this.ws.send(JSON.stringify({
                        action: 'unsubscribe',
                        topic: topic
                    }));
                }
            }
        }
    }
    
    publish(topic, payload) {
        if (!this.connected || !this.ws) {
            console.warn('Cannot publish: not connected');
            return false;
        }
        
        try {
            this.ws.send(JSON.stringify({
                action: 'publish',
                topic: topic,
                payload: payload
            }));
            return true;
        } catch (error) {
            console.error('Failed to publish:', error);
            return false;
        }
    }
    
    handleMessage(message) {
        const { topic, payload } = message;
        
        // Check exact topic match
        if (this.subscriptions.has(topic)) {
            const callbacks = this.subscriptions.get(topic);
            callbacks.forEach(callback => {
                try {
                    callback(topic, payload);
                } catch (e) {
                    console.error('Callback error:', e);
                }
            });
        }
        
        // Check wildcard matches
        for (const [pattern, callbacks] of this.subscriptions) {
            if (this.topicMatches(pattern, topic)) {
                callbacks.forEach(callback => {
                    try {
                        callback(topic, payload);
                    } catch (e) {
                        console.error('Callback error:', e);
                    }
                });
            }
        }
    }
    
    topicMatches(pattern, topic) {
        if (pattern === topic) return true;
        
        const patternParts = pattern.split('/');
        const topicParts = topic.split('/');
        
        if (pattern.includes('#')) {
            // Multi-level wildcard
            const hashIndex = patternParts.indexOf('#');
            if (hashIndex !== patternParts.length - 1) return false;
            
            for (let i = 0; i < hashIndex; i++) {
                if (patternParts[i] !== '+' && patternParts[i] !== topicParts[i]) {
                    return false;
                }
            }
            return true;
        }
        
        if (patternParts.length !== topicParts.length) return false;
        
        for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i] !== '+' && patternParts[i] !== topicParts[i]) {
                return false;
            }
        }
        
        return true;
    }
}

// Export singleton instance
export default new MQTTClient();
