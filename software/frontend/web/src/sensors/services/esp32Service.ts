// ESP32 WebSocket connection service

interface ESP32Message {
  type: 'auth' | 'sensor_data' | 'command' | 'status' | 'error';
  device_id?: string;
  data?: any;
  timestamp?: number;
}

interface ESP32Device {
  id: string;
  name: string;
  ws?: WebSocket;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastData?: any;
  lastSeen?: Date;
}

class ESP32Service {
  private devices: Map<string, ESP32Device> = new Map();
  private messageHandlers: ((deviceId: string, message: ESP32Message) => void)[] = [];
  private backendWs?: WebSocket;

  // Connect to backend WebSocket server
  async connectToBackend(deviceId: string, authToken?: string): Promise<void> {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = window.location.port || '8000';
    const url = `${protocol}//${host}:${port}/api/v1/sensors/ws/ui`;
    
    try {
      const ws = new WebSocket(url);
      this.backendWs = ws;

      ws.onopen = () => {
        console.log('Connected to WIT sensors backend');
        
        // Subscribe to the device
        ws.send(JSON.stringify({
          type: 'subscribe',
          sensor_ids: [deviceId]
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'sensor_data') {
            const device = this.devices.get(message.sensor_id);
            if (device) {
              device.lastData = message.data;
              device.lastSeen = new Date();
              device.status = 'connected';
            }
            
            // Notify handlers
            this.messageHandlers.forEach(handler => 
              handler(message.sensor_id, message)
            );
          }
        } catch (error) {
          console.error('Failed to parse backend message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('Backend WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('Disconnected from backend');
        this.backendWs = undefined;
      };
    } catch (error) {
      throw error;
    }
  }

  // Connect to ESP32 via WebSocket (for direct connection - not used with backend)
  async connectWebSocket(deviceId: string, url: string, authToken?: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    try {
      const ws = new WebSocket(url);
      device.ws = ws;
      device.status = 'connecting';

      ws.onopen = () => {
        console.log(`ESP32 ${deviceId} connected`);
        device.status = 'connected';
        
        // Send authentication if provided
        if (authToken) {
          this.sendMessage(deviceId, {
            type: 'auth',
            device_id: deviceId,
            data: { token: authToken }
          });
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: ESP32Message = JSON.parse(event.data);
          device.lastSeen = new Date();
          
          if (message.type === 'sensor_data') {
            device.lastData = message.data;
          }
          
          // Notify all handlers
          this.messageHandlers.forEach(handler => handler(deviceId, message));
        } catch (error) {
          console.error('Failed to parse ESP32 message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error(`ESP32 ${deviceId} error:`, error);
        device.status = 'error';
      };

      ws.onclose = () => {
        console.log(`ESP32 ${deviceId} disconnected`);
        device.status = 'disconnected';
        device.ws = undefined;
      };

    } catch (error) {
      device.status = 'error';
      throw error;
    }
  }

  // Register a new ESP32 device
  registerDevice(id: string, name: string): void {
    this.devices.set(id, {
      id,
      name,
      status: 'disconnected'
    });
  }

  // Send command to ESP32
  sendMessage(deviceId: string, message: ESP32Message): void {
    const device = this.devices.get(deviceId);
    if (!device?.ws || device.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Device not connected');
    }

    device.ws.send(JSON.stringify({
      ...message,
      timestamp: Date.now()
    }));
  }

  // Send command to read sensor
  requestSensorData(deviceId: string): void {
    this.sendMessage(deviceId, {
      type: 'command',
      data: { command: 'read_sensor' }
    });
  }

  // Subscribe to messages
  onMessage(handler: (deviceId: string, message: ESP32Message) => void): () => void {
    this.messageHandlers.push(handler);
    
    // Return unsubscribe function
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  // Get device status
  getDevice(deviceId: string): ESP32Device | undefined {
    return this.devices.get(deviceId);
  }

  // Get all devices
  getAllDevices(): ESP32Device[] {
    return Array.from(this.devices.values());
  }

  // Disconnect device
  disconnect(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (device?.ws) {
      device.ws.close();
      device.ws = undefined;
      device.status = 'disconnected';
    }
  }

  // Remove device
  removeDevice(deviceId: string): void {
    this.disconnect(deviceId);
    this.devices.delete(deviceId);
  }
}

// Singleton instance
const esp32Service = new ESP32Service();

export default esp32Service;
export type { ESP32Message, ESP32Device };