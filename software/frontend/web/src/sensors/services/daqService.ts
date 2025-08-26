/**
 * DAQ (Data Acquisition) Service
 * Manages communication with industrial DAQ systems via various protocols
 */

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8000'
  : '';

interface DAQChannel {
  name: string;
  value: number;
  unit?: string;
  timestamp?: string;
}

interface DAQData {
  timestamp: string;
  channels: Record<string, number>;
}

interface DAQDevice {
  id: string;
  name: string;
  protocol: string;
  host: string;
  port: number;
  connected: boolean;
  channels: number;
  lastData?: DAQData;
}

class DAQService {
  private devices: Map<string, DAQDevice> = new Map();
  private websocket: WebSocket | null = null;
  private listeners: Set<(data: any) => void> = new Set();
  private reconnectTimeout: any;

  constructor() {
    this.connectWebSocket();
  }

  /**
   * Connect to DAQ WebSocket endpoint
   */
  private connectWebSocket() {
    try {
      const wsUrl = API_BASE_URL.replace(/^http/, 'ws');
      this.websocket = new WebSocket(`${wsUrl}/api/v1/daq/ws`);

      this.websocket.onopen = () => {
        console.log('[DAQService] WebSocket connected');
        clearTimeout(this.reconnectTimeout);
      };

      this.websocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleWebSocketMessage(message);
      };

      this.websocket.onclose = () => {
        console.log('[DAQService] WebSocket disconnected');
        this.scheduleReconnect();
      };

      this.websocket.onerror = (error) => {
        console.error('[DAQService] WebSocket error:', error);
      };
    } catch (error) {
      console.error('[DAQService] Failed to connect:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      console.log('[DAQService] Attempting to reconnect...');
      this.connectWebSocket();
    }, 5000);
  }

  /**
   * Handle WebSocket messages
   */
  private handleWebSocketMessage(message: any) {
    switch (message.type) {
      case 'device_list':
        // Update device list
        this.devices.clear();
        message.devices.forEach((device: any) => {
          this.devices.set(device.id, device);
        });
        this.notifyListeners({ type: 'device_list', devices: message.devices });
        break;

      case 'daq_data':
        // Update device data
        const device = this.devices.get(message.device_id);
        if (device) {
          device.lastData = message.data;
          this.notifyListeners({
            type: 'daq_data',
            deviceId: message.device_id,
            data: message.data
          });
        }
        break;

      default:
        console.log('[DAQService] Unhandled message type:', message.type);
    }
  }

  /**
   * Get supported DAQ protocols
   */
  async getSupportedProtocols(): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/daq/protocols`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch protocols');
      }

      const data = await response.json();
      return data.protocols;
    } catch (error) {
      console.error('[DAQService] Error fetching protocols:', error);
      return [];
    }
  }

  /**
   * Connect to a DAQ device
   */
  async connectDevice(config: {
    name: string;
    protocol: string;
    host: string;
    port: number;
    pollInterval: number;
    channels: any[];
  }): Promise<string> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/daq/devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          id: `daq_${Date.now()}`,
          name: config.name,
          protocol: config.protocol,
          host: config.host,
          port: config.port,
          poll_interval: config.pollInterval,
          channels: config.channels
        })
      });

      if (!response.ok) {
        throw new Error('Failed to connect device');
      }

      const data = await response.json();
      
      // Refresh device list
      await this.getDevices();
      
      return data.device_id;
    } catch (error) {
      console.error('[DAQService] Error connecting device:', error);
      throw error;
    }
  }

  /**
   * Disconnect a DAQ device
   */
  async disconnectDevice(deviceId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/daq/devices/${deviceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect device');
      }

      this.devices.delete(deviceId);
      this.notifyListeners({ type: 'device_removed', deviceId });
    } catch (error) {
      console.error('[DAQService] Error disconnecting device:', error);
      throw error;
    }
  }

  /**
   * Get all configured devices
   */
  async getDevices(): Promise<DAQDevice[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/daq/devices`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch devices');
      }

      const data = await response.json();
      
      // Update local cache
      this.devices.clear();
      data.devices.forEach((device: any) => {
        this.devices.set(device.id, device);
      });

      return data.devices;
    } catch (error) {
      console.error('[DAQService] Error fetching devices:', error);
      return Array.from(this.devices.values());
    }
  }

  /**
   * Read data from a specific device
   */
  async readDeviceData(deviceId: string): Promise<DAQData | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/daq/devices/${deviceId}/data`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to read device data');
      }

      const data = await response.json();
      
      // Update device cache
      const device = this.devices.get(deviceId);
      if (device) {
        device.lastData = data;
      }

      return data;
    } catch (error) {
      console.error('[DAQService] Error reading device data:', error);
      return null;
    }
  }

  /**
   * Subscribe to DAQ data updates
   */
  subscribe(callback: (data: any) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(data: any) {
    this.listeners.forEach(callback => callback(data));
  }

  /**
   * Get WebSocket connection status
   */
  getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
    if (!this.websocket) return 'disconnected';

    switch (this.websocket.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      default:
        return 'disconnected';
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    clearTimeout(this.reconnectTimeout);
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.devices.clear();
    this.listeners.clear();
  }
}

// Singleton instance
export const daqService = new DAQService();