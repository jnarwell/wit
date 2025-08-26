// Communication protocol definitions for various sensor types

export interface ProtocolConfig {
  type: string;
  settings: Record<string, any>;
}

// I2C Protocol Configuration
export interface I2CConfig extends ProtocolConfig {
  type: 'i2c';
  settings: {
    address: number; // 0x00 - 0x7F
    bus: number; // typically 0 or 1
    speed?: number; // Hz (100000, 400000, 1000000, 3400000)
  };
}

// SPI Protocol Configuration
export interface SPIConfig extends ProtocolConfig {
  type: 'spi';
  settings: {
    bus: number;
    device: number;
    mode: 0 | 1 | 2 | 3;
    speed: number; // Hz
    bitsPerWord?: number;
    lsbFirst?: boolean;
  };
}

// UART/Serial Protocol Configuration
export interface UARTConfig extends ProtocolConfig {
  type: 'uart';
  settings: {
    port: string; // e.g., '/dev/ttyUSB0', 'COM3'
    baudRate: number;
    dataBits: 7 | 8;
    stopBits: 1 | 1.5 | 2;
    parity: 'none' | 'even' | 'odd';
    flowControl?: 'none' | 'hardware' | 'software';
  };
}

// CAN Bus Protocol Configuration
export interface CANConfig extends ProtocolConfig {
  type: 'can';
  settings: {
    interface: string; // e.g., 'can0'
    bitrate: number; // e.g., 250000, 500000, 1000000
    canFD?: boolean;
    filters?: Array<{
      id: number;
      mask: number;
    }>;
  };
}

// EtherCAT Protocol Configuration
export interface EtherCATConfig extends ProtocolConfig {
  type: 'ethercat';
  settings: {
    master: string; // network interface
    slaveAddress: number;
    cycleTime: number; // microseconds
    distributed_clock?: boolean;
  };
}

// Modbus Protocol Configuration
export interface ModbusConfig extends ProtocolConfig {
  type: 'modbus';
  settings: {
    mode: 'tcp' | 'rtu';
    // TCP settings
    host?: string;
    port?: number;
    // RTU settings
    serialPort?: string;
    baudRate?: number;
    // Common settings
    slaveId: number;
    timeout?: number;
    endianness?: 'big' | 'little';
  };
}

// OPC UA Protocol Configuration
export interface OPCUAConfig extends ProtocolConfig {
  type: 'opc_ua';
  settings: {
    endpoint: string;
    securityMode: 'None' | 'Sign' | 'SignAndEncrypt';
    securityPolicy?: string;
    authentication?: {
      type: 'anonymous' | 'username' | 'certificate';
      username?: string;
      password?: string;
      certificatePath?: string;
      privateKeyPath?: string;
    };
    subscriptionInterval?: number;
  };
}

// MQTT Protocol Configuration
export interface MQTTConfig extends ProtocolConfig {
  type: 'mqtt';
  settings: {
    broker: string;
    port: number;
    clientId?: string;
    username?: string;
    password?: string;
    topics: {
      data: string;
      status: string;
      command?: string;
    };
    qos?: 0 | 1 | 2;
    ssl?: boolean;
  };
}

// WebSocket Protocol Configuration
export interface WebSocketConfig extends ProtocolConfig {
  type: 'websocket';
  settings: {
    url: string;
    protocols?: string[];
    reconnect?: boolean;
    reconnectInterval?: number;
    pingInterval?: number;
    authentication?: {
      type: 'bearer' | 'basic' | 'custom';
      token?: string;
      headers?: Record<string, string>;
    };
  };
}

// Analog Input Configuration
export interface AnalogConfig extends ProtocolConfig {
  type: 'analog';
  settings: {
    channel: number;
    range: {
      min: number;
      max: number;
      unit: 'V' | 'mV' | 'mA' | 'uA';
    };
    resolution: number; // bits
    samplingRate: number; // Hz
    inputType: 'single-ended' | 'differential';
    impedance?: 'high' | 'low' | number; // ohms
  };
}

// Digital Input Configuration
export interface DigitalConfig extends ProtocolConfig {
  type: 'digital';
  settings: {
    pin: number | string;
    mode: 'input' | 'input_pullup' | 'input_pulldown';
    debounce?: number; // milliseconds
    edge?: 'rising' | 'falling' | 'both';
  };
}

// Protocol factory type
export type SensorProtocolConfig = 
  | I2CConfig 
  | SPIConfig 
  | UARTConfig 
  | CANConfig 
  | EtherCATConfig
  | ModbusConfig
  | OPCUAConfig
  | MQTTConfig
  | WebSocketConfig
  | AnalogConfig
  | DigitalConfig;

// Protocol capabilities
export interface ProtocolCapabilities {
  maxSamplingRate: number;
  supportsBroadcast: boolean;
  supportsMulticast: boolean;
  requiresPolling: boolean;
  supportsTriggers: boolean;
  latency: 'low' | 'medium' | 'high';
  reliability: 'best-effort' | 'guaranteed';
  maxPayloadSize?: number;
}

// Get protocol capabilities
export const protocolCapabilities: Record<string, ProtocolCapabilities> = {
  i2c: {
    maxSamplingRate: 1000,
    supportsBroadcast: false,
    supportsMulticast: false,
    requiresPolling: true,
    supportsTriggers: false,
    latency: 'low',
    reliability: 'guaranteed',
    maxPayloadSize: 32
  },
  spi: {
    maxSamplingRate: 10000,
    supportsBroadcast: false,
    supportsMulticast: false,
    requiresPolling: true,
    supportsTriggers: false,
    latency: 'low',
    reliability: 'guaranteed',
    maxPayloadSize: 4096
  },
  uart: {
    maxSamplingRate: 1000,
    supportsBroadcast: false,
    supportsMulticast: false,
    requiresPolling: false,
    supportsTriggers: false,
    latency: 'low',
    reliability: 'best-effort',
    maxPayloadSize: 256
  },
  can: {
    maxSamplingRate: 1000,
    supportsBroadcast: true,
    supportsMulticast: true,
    requiresPolling: false,
    supportsTriggers: true,
    latency: 'low',
    reliability: 'guaranteed',
    maxPayloadSize: 8
  },
  ethercat: {
    maxSamplingRate: 100000,
    supportsBroadcast: true,
    supportsMulticast: false,
    requiresPolling: false,
    supportsTriggers: true,
    latency: 'low',
    reliability: 'guaranteed',
    maxPayloadSize: 1486
  },
  modbus: {
    maxSamplingRate: 100,
    supportsBroadcast: false,
    supportsMulticast: false,
    requiresPolling: true,
    supportsTriggers: false,
    latency: 'medium',
    reliability: 'guaranteed',
    maxPayloadSize: 252
  },
  opc_ua: {
    maxSamplingRate: 1000,
    supportsBroadcast: false,
    supportsMulticast: false,
    requiresPolling: false,
    supportsTriggers: true,
    latency: 'medium',
    reliability: 'guaranteed',
    maxPayloadSize: 65536
  },
  mqtt: {
    maxSamplingRate: 1000,
    supportsBroadcast: true,
    supportsMulticast: true,
    requiresPolling: false,
    supportsTriggers: true,
    latency: 'medium',
    reliability: 'best-effort',
    maxPayloadSize: 268435456
  },
  websocket: {
    maxSamplingRate: 10000,
    supportsBroadcast: false,
    supportsMulticast: false,
    requiresPolling: false,
    supportsTriggers: true,
    latency: 'low',
    reliability: 'best-effort',
    maxPayloadSize: 134217728
  },
  analog: {
    maxSamplingRate: 1000000,
    supportsBroadcast: false,
    supportsMulticast: false,
    requiresPolling: true,
    supportsTriggers: true,
    latency: 'low',
    reliability: 'guaranteed'
  },
  digital: {
    maxSamplingRate: 1000000,
    supportsBroadcast: false,
    supportsMulticast: false,
    requiresPolling: false,
    supportsTriggers: true,
    latency: 'low',
    reliability: 'guaranteed'
  }
};