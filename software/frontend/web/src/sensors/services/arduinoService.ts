/**
 * Arduino Sensor Service
 * Manages communication between Arduino devices and WIT via UDC
 */

interface ArduinoSensorData {
  type: 'data' | 'init' | 'status';
  device?: string;
  sensors?: string[];
  temperature?: number;
  humidity?: number;
  light?: number;
  pressure?: number;
  timestamp?: number;
  [key: string]: any;
}

interface ArduinoDevice {
  id: string;
  name: string;
  port: string;
  baudRate: number;
  board: string;
  status: 'connected' | 'disconnected' | 'connecting';
  lastData?: ArduinoSensorData;
  sensors: string[];
}

class ArduinoSensorService {
  private devices: Map<string, ArduinoDevice> = new Map();
  private udcWebSocket: WebSocket | null = null;
  private listeners: Set<(data: ArduinoSensorData) => void> = new Set();

  constructor() {
    this.connectToUDC();
  }

  /**
   * Connect to Universal Desktop Controller WebSocket
   */
  private connectToUDC() {
    try {
      // Connect to WIT backend WebSocket endpoint (which forwards to UDC)
      this.udcWebSocket = new WebSocket('ws://localhost:8000/ws/desktop-controller');
      
      this.udcWebSocket.onopen = () => {
        console.log('[ArduinoService] Connected to UDC via WIT backend');
        this.sendUDCMessage({
          type: 'subscribe',
          plugin: 'arduino-ide',
          events: ['serial_data', 'serial_line', 'board_connected', 'board_disconnected']
        });
      };

      this.udcWebSocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleUDCMessage(message);
      };

      this.udcWebSocket.onclose = () => {
        console.log('[ArduinoService] Disconnected from UDC via WIT backend');
        // Reconnect after 5 seconds
        setTimeout(() => this.connectToUDC(), 5000);
      };

      this.udcWebSocket.onerror = (error) => {
        console.error('[ArduinoService] WebSocket error:', error);
      };
    } catch (error) {
      console.error('[ArduinoService] Failed to connect to WIT backend:', error);
      // Retry connection after 5 seconds
      setTimeout(() => this.connectToUDC(), 5000);
    }
  }

  /**
   * Handle messages from UDC
   */
  private handleUDCMessage(message: any) {
    switch (message.type) {
      case 'serial_line':
        this.handleSerialLine(message);
        break;
      case 'board_connected':
        this.handleBoardConnected(message.board);
        break;
      case 'board_disconnected':
        this.handleBoardDisconnected(message.board);
        break;
      case 'plugin_response':
        this.handlePluginResponse(message);
        break;
    }
  }

  /**
   * Handle serial line data from Arduino
   */
  private handleSerialLine(message: any) {
    const { line, timestamp } = message;
    
    try {
      // Try to parse as JSON
      const data: ArduinoSensorData = JSON.parse(line);
      
      // Find device by port (stored in message metadata)
      const device = Array.from(this.devices.values())
        .find(d => d.status === 'connected');
      
      if (device) {
        device.lastData = { ...data, timestamp };
        
        // Handle initialization message
        if (data.type === 'init' && data.sensors) {
          device.sensors = data.sensors;
          console.log(`[ArduinoService] Device ${device.id} initialized with sensors:`, data.sensors);
        }
        
        // Notify listeners
        this.notifyListeners({ ...data, deviceId: device.id });
      }
    } catch (error) {
      // Not JSON, ignore or log raw data
      console.debug('[ArduinoService] Non-JSON serial data:', line);
    }
  }

  /**
   * Handle board connection event
   */
  private handleBoardConnected(board: any) {
    console.log('[ArduinoService] Arduino board connected:', board);
    
    // Update device status if it exists
    const device = Array.from(this.devices.values())
      .find(d => d.port === board.path);
    
    if (device) {
      device.status = 'connected';
      this.startSerialMonitor(device);
    }
  }

  /**
   * Handle board disconnection event
   */
  private handleBoardDisconnected(board: any) {
    console.log('[ArduinoService] Arduino board disconnected:', board);
    
    // Update device status
    const device = Array.from(this.devices.values())
      .find(d => d.port === board.path);
    
    if (device) {
      device.status = 'disconnected';
    }
  }

  /**
   * Handle plugin response from UDC
   */
  private handlePluginResponse(message: any) {
    if (message.pluginId === 'arduino-ide') {
      console.log('[ArduinoService] Plugin response:', message);
    }
  }

  /**
   * Send message to UDC
   */
  private sendUDCMessage(message: any) {
    if (this.udcWebSocket && this.udcWebSocket.readyState === WebSocket.OPEN) {
      this.udcWebSocket.send(JSON.stringify(message));
    }
  }

  /**
   * Send command to Arduino plugin
   */
  private sendPluginCommand(action: string, payload: any = {}) {
    this.sendUDCMessage({
      type: 'plugin_command',
      pluginId: 'arduino-ide',
      action,
      payload
    });
  }

  /**
   * Connect Arduino device
   */
  async connectDevice(config: {
    name: string;
    port: string;
    baudRate: number;
    board: string;
    sensors: string[];
  }): Promise<ArduinoDevice> {
    const device: ArduinoDevice = {
      id: `arduino-${Date.now()}`,
      name: config.name,
      port: config.port,
      baudRate: config.baudRate,
      board: config.board,
      status: 'connecting',
      sensors: config.sensors
    };

    this.devices.set(device.id, device);

    // Start serial monitoring for this device
    await this.startSerialMonitor(device);

    return device;
  }

  /**
   * Start serial monitoring for a device
   */
  private async startSerialMonitor(device: ArduinoDevice) {
    this.sendPluginCommand('startSerial', {
      port: device.port,
      baudRate: device.baudRate
    });
    
    // Update status after a delay (should be updated by actual connection event)
    setTimeout(() => {
      if (device.status === 'connecting') {
        device.status = 'connected';
      }
    }, 2000);
  }

  /**
   * Disconnect Arduino device
   */
  async disconnectDevice(deviceId: string) {
    const device = this.devices.get(deviceId);
    if (!device) return;

    // Stop serial monitoring
    this.sendPluginCommand('stopSerial');
    
    device.status = 'disconnected';
  }

  /**
   * Remove Arduino device
   */
  removeDevice(deviceId: string) {
    const device = this.devices.get(deviceId);
    if (!device) return;

    // Disconnect first if connected
    if (device.status === 'connected') {
      this.disconnectDevice(deviceId);
    }

    this.devices.delete(deviceId);
  }

  /**
   * Get all devices
   */
  getDevices(): ArduinoDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * Get device by ID
   */
  getDevice(deviceId: string): ArduinoDevice | undefined {
    return this.devices.get(deviceId);
  }

  /**
   * Scan for available ports
   */
  async scanPorts(): Promise<string[]> {
    return new Promise((resolve) => {
      // Request port list from Arduino plugin
      this.sendPluginCommand('listPorts');
      
      // Mock response for now
      setTimeout(() => {
        resolve(['/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/ttyACM0']);
      }, 1000);
    });
  }

  /**
   * Send command to Arduino
   */
  sendCommand(deviceId: string, command: string) {
    const device = this.devices.get(deviceId);
    if (!device || device.status !== 'connected') {
      throw new Error('Device not connected');
    }

    this.sendPluginCommand('sendSerial', {
      data: command + '\n'
    });
  }

  /**
   * Subscribe to sensor data
   */
  subscribe(callback: (data: ArduinoSensorData) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(data: ArduinoSensorData) {
    this.listeners.forEach(callback => callback(data));
  }

  /**
   * Get UDC connection status
   */
  getUDCStatus(): 'connected' | 'disconnected' | 'connecting' {
    if (!this.udcWebSocket) return 'disconnected';
    
    switch (this.udcWebSocket.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      default:
        return 'disconnected';
    }
  }
}

// Singleton instance
export const arduinoService = new ArduinoSensorService();