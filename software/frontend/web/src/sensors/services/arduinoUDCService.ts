/**
 * Arduino UDC Service
 * Manages Arduino device communication through the existing UDC connection
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

class ArduinoUDCService {
  private devices: Map<string, ArduinoDevice> = new Map();
  private listeners: Set<(data: ArduinoSensorData) => void> = new Set();
  private messageHandler: ((message: any) => void) | null = null;

  /**
   * Set the UDC message handler
   */
  setMessageHandler(handler: (message: any) => void) {
    this.messageHandler = handler;
  }

  /**
   * Handle messages from UDC
   */
  handleUDCMessage(message: any) {
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
        if (message.pluginId === 'arduino-ide') {
          this.handlePluginResponse(message);
        }
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
          console.log(`[ArduinoUDCService] Device ${device.id} initialized with sensors:`, data.sensors);
        }
        
        // Notify listeners
        this.notifyListeners({ ...data, deviceId: device.id });
      }
    } catch (error) {
      // Not JSON, ignore or log raw data
      console.debug('[ArduinoUDCService] Non-JSON serial data:', line);
    }
  }

  /**
   * Handle board connection event
   */
  private handleBoardConnected(board: any) {
    console.log('[ArduinoUDCService] Arduino board connected:', board);
    
    // Update device status if it exists
    const device = Array.from(this.devices.values())
      .find(d => d.port === board.path);
    
    if (device) {
      device.status = 'connected';
    }
  }

  /**
   * Handle board disconnection event
   */
  private handleBoardDisconnected(board: any) {
    console.log('[ArduinoUDCService] Arduino board disconnected:', board);
    
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
    console.log('[ArduinoUDCService] Plugin response:', message);
  }

  /**
   * Send command to Arduino plugin via message handler
   */
  private sendPluginCommand(action: string, payload: any = {}) {
    if (this.messageHandler) {
      this.messageHandler({
        type: 'plugin_command',
        pluginId: 'arduino-ide',
        action,
        payload
      });
    }
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

    return device;
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
}

// Singleton instance
export const arduinoUDCService = new ArduinoUDCService();