// Comprehensive sensor library with common sensor types and their configurations

import { SensorMetadata, SensorCategory, SensorRange } from '../types/sensor.types';
import { SensorProtocolConfig } from '../types/protocols';

export interface SensorTemplate {
  category: SensorCategory;
  defaultName: string;
  manufacturer: string;
  model: string;
  description: string;
  defaultProtocol: SensorProtocolConfig;
  channels: {
    name: string;
    unit: string;
    range: SensorRange;
  }[];
  accuracy: string;
  responseTime?: string;
  operatingTemp?: SensorRange;
  tags: string[];
}

export const sensorLibrary: Record<string, SensorTemplate> = {
  // Temperature Sensors
  'dht22': {
    category: 'temperature',
    defaultName: 'DHT22 Temperature & Humidity',
    manufacturer: 'ASAIR',
    model: 'DHT22/AM2302',
    description: 'Digital temperature and humidity sensor',
    defaultProtocol: {
      type: 'digital',
      settings: {
        pin: 4,
        mode: 'input_pullup',
        debounce: 0
      }
    },
    channels: [
      { name: 'Temperature', unit: '°C', range: { min: -40, max: 80, unit: '°C', resolution: 0.1 } },
      { name: 'Humidity', unit: '%', range: { min: 0, max: 100, unit: '%', resolution: 0.1 } }
    ],
    accuracy: '±0.5°C, ±2% RH',
    responseTime: '2s',
    operatingTemp: { min: -40, max: 80, unit: '°C' },
    tags: ['temperature', 'humidity', 'digital', 'environmental']
  },

  'bmp280': {
    category: 'pressure',
    defaultName: 'BMP280 Pressure Sensor',
    manufacturer: 'Bosch',
    model: 'BMP280',
    description: 'Digital pressure and temperature sensor',
    defaultProtocol: {
      type: 'i2c',
      settings: {
        address: 0x76,
        bus: 1,
        speed: 400000
      }
    },
    channels: [
      { name: 'Pressure', unit: 'hPa', range: { min: 300, max: 1100, unit: 'hPa', resolution: 0.01 } },
      { name: 'Temperature', unit: '°C', range: { min: -40, max: 85, unit: '°C', resolution: 0.01 } }
    ],
    accuracy: '±1 hPa, ±1°C',
    responseTime: '5.5ms',
    operatingTemp: { min: -40, max: 85, unit: '°C' },
    tags: ['pressure', 'temperature', 'i2c', 'environmental', 'altitude']
  },

  'mpu6050': {
    category: 'acceleration',
    defaultName: 'MPU6050 6-Axis IMU',
    manufacturer: 'InvenSense',
    model: 'MPU-6050',
    description: '6-axis motion tracking device with 3-axis accelerometer and 3-axis gyroscope',
    defaultProtocol: {
      type: 'i2c',
      settings: {
        address: 0x68,
        bus: 1,
        speed: 400000
      }
    },
    channels: [
      { name: 'Accel X', unit: 'g', range: { min: -16, max: 16, unit: 'g', resolution: 0.001 } },
      { name: 'Accel Y', unit: 'g', range: { min: -16, max: 16, unit: 'g', resolution: 0.001 } },
      { name: 'Accel Z', unit: 'g', range: { min: -16, max: 16, unit: 'g', resolution: 0.001 } },
      { name: 'Gyro X', unit: '°/s', range: { min: -2000, max: 2000, unit: '°/s', resolution: 0.1 } },
      { name: 'Gyro Y', unit: '°/s', range: { min: -2000, max: 2000, unit: '°/s', resolution: 0.1 } },
      { name: 'Gyro Z', unit: '°/s', range: { min: -2000, max: 2000, unit: '°/s', resolution: 0.1 } },
      { name: 'Temperature', unit: '°C', range: { min: -40, max: 85, unit: '°C', resolution: 0.1 } }
    ],
    accuracy: '±2% FS',
    responseTime: '1ms',
    operatingTemp: { min: -40, max: 85, unit: '°C' },
    tags: ['acceleration', 'gyroscope', 'imu', 'motion', 'i2c']
  },

  'load_cell_hx711': {
    category: 'force',
    defaultName: 'Load Cell with HX711',
    manufacturer: 'Generic',
    model: 'HX711',
    description: '24-bit ADC for weigh scales with load cell',
    defaultProtocol: {
      type: 'digital',
      settings: {
        pin: '5,6', // DT, SCK
        mode: 'input',
        edge: 'falling'
      }
    },
    channels: [
      { name: 'Force', unit: 'kg', range: { min: 0, max: 200, unit: 'kg', resolution: 0.001 } }
    ],
    accuracy: '±0.1% FS',
    responseTime: '10ms',
    tags: ['force', 'weight', 'load', 'strain']
  },

  'max31855': {
    category: 'temperature',
    defaultName: 'MAX31855 Thermocouple',
    manufacturer: 'Maxim',
    model: 'MAX31855',
    description: 'Cold-junction compensated thermocouple-to-digital converter',
    defaultProtocol: {
      type: 'spi',
      settings: {
        bus: 0,
        device: 0,
        mode: 0,
        speed: 5000000,
        bitsPerWord: 8
      }
    },
    channels: [
      { name: 'Thermocouple', unit: '°C', range: { min: -270, max: 1800, unit: '°C', resolution: 0.25 } },
      { name: 'Internal', unit: '°C', range: { min: -55, max: 125, unit: '°C', resolution: 0.0625 } }
    ],
    accuracy: '±2°C',
    responseTime: '100ms',
    operatingTemp: { min: -55, max: 125, unit: '°C' },
    tags: ['temperature', 'thermocouple', 'spi', 'high-temp']
  },

  'ultrasonic_hcsr04': {
    category: 'displacement',
    defaultName: 'HC-SR04 Ultrasonic',
    manufacturer: 'Generic',
    model: 'HC-SR04',
    description: 'Ultrasonic distance measurement sensor',
    defaultProtocol: {
      type: 'digital',
      settings: {
        pin: '23,24', // Trigger, Echo
        mode: 'input',
        edge: 'both'
      }
    },
    channels: [
      { name: 'Distance', unit: 'cm', range: { min: 2, max: 400, unit: 'cm', resolution: 0.3 } }
    ],
    accuracy: '±3mm',
    responseTime: '10ms',
    operatingTemp: { min: -15, max: 70, unit: '°C' },
    tags: ['distance', 'ultrasonic', 'level', 'proximity']
  },

  'mq2_gas': {
    category: 'gas',
    defaultName: 'MQ-2 Gas Sensor',
    manufacturer: 'Hanwei',
    model: 'MQ-2',
    description: 'Combustible gas and smoke detector',
    defaultProtocol: {
      type: 'analog',
      settings: {
        channel: 0,
        range: { min: 0, max: 5, unit: 'V' },
        resolution: 12,
        samplingRate: 100,
        inputType: 'single-ended'
      }
    },
    channels: [
      { name: 'Gas Concentration', unit: 'ppm', range: { min: 200, max: 10000, unit: 'ppm' } }
    ],
    accuracy: '±5%',
    responseTime: '10s',
    operatingTemp: { min: -20, max: 50, unit: '°C' },
    tags: ['gas', 'smoke', 'safety', 'environmental']
  },

  'ina219_current': {
    category: 'electrical',
    defaultName: 'INA219 Current Monitor',
    manufacturer: 'Texas Instruments',
    model: 'INA219',
    description: 'High-side current/voltage/power monitor',
    defaultProtocol: {
      type: 'i2c',
      settings: {
        address: 0x40,
        bus: 1,
        speed: 400000
      }
    },
    channels: [
      { name: 'Current', unit: 'A', range: { min: -3.2, max: 3.2, unit: 'A', resolution: 0.001 } },
      { name: 'Voltage', unit: 'V', range: { min: 0, max: 26, unit: 'V', resolution: 0.001 } },
      { name: 'Power', unit: 'W', range: { min: 0, max: 83.2, unit: 'W', resolution: 0.001 } }
    ],
    accuracy: '±0.5%',
    responseTime: '0.5ms',
    tags: ['current', 'voltage', 'power', 'monitoring', 'i2c']
  },

  'bh1750_light': {
    category: 'optical',
    defaultName: 'BH1750 Light Sensor',
    manufacturer: 'ROHM',
    model: 'BH1750',
    description: 'Digital ambient light sensor',
    defaultProtocol: {
      type: 'i2c',
      settings: {
        address: 0x23,
        bus: 1,
        speed: 100000
      }
    },
    channels: [
      { name: 'Illuminance', unit: 'lux', range: { min: 1, max: 65535, unit: 'lux', resolution: 1 } }
    ],
    accuracy: '±20%',
    responseTime: '120ms',
    operatingTemp: { min: -40, max: 85, unit: '°C' },
    tags: ['light', 'illuminance', 'optical', 'i2c']
  },

  'flow_meter_yfs201': {
    category: 'flow',
    defaultName: 'YF-S201 Flow Sensor',
    manufacturer: 'Generic',
    model: 'YF-S201',
    description: 'Hall effect water flow sensor',
    defaultProtocol: {
      type: 'digital',
      settings: {
        pin: 17,
        mode: 'input_pullup',
        edge: 'rising'
      }
    },
    channels: [
      { name: 'Flow Rate', unit: 'L/min', range: { min: 1, max: 30, unit: 'L/min', resolution: 0.1 } }
    ],
    accuracy: '±10%',
    responseTime: '0.5s',
    operatingTemp: { min: -25, max: 80, unit: '°C' },
    tags: ['flow', 'water', 'liquid', 'hall-effect']
  },

  // Industrial sensors
  'pt100_rtd': {
    category: 'temperature',
    defaultName: 'PT100 RTD',
    manufacturer: 'Various',
    model: 'PT100',
    description: 'Platinum resistance temperature detector',
    defaultProtocol: {
      type: 'analog',
      settings: {
        channel: 0,
        range: { min: 0, max: 5, unit: 'V' },
        resolution: 24,
        samplingRate: 10,
        inputType: 'differential'
      }
    },
    channels: [
      { name: 'Temperature', unit: '°C', range: { min: -200, max: 850, unit: '°C', resolution: 0.01 } }
    ],
    accuracy: '±0.15°C @ 0°C',
    responseTime: '3s',
    tags: ['temperature', 'rtd', 'industrial', 'precision']
  },

  'vibration_adxl345': {
    category: 'vibration',
    defaultName: 'ADXL345 Vibration Sensor',
    manufacturer: 'Analog Devices',
    model: 'ADXL345',
    description: '3-axis digital accelerometer for vibration monitoring',
    defaultProtocol: {
      type: 'i2c',
      settings: {
        address: 0x53,
        bus: 1,
        speed: 400000
      }
    },
    channels: [
      { name: 'Vibration X', unit: 'g', range: { min: -16, max: 16, unit: 'g', resolution: 0.004 } },
      { name: 'Vibration Y', unit: 'g', range: { min: -16, max: 16, unit: 'g', resolution: 0.004 } },
      { name: 'Vibration Z', unit: 'g', range: { min: -16, max: 16, unit: 'g', resolution: 0.004 } }
    ],
    accuracy: '±0.5% FS',
    responseTime: '1.6ms',
    operatingTemp: { min: -40, max: 85, unit: '°C' },
    tags: ['vibration', 'acceleration', 'monitoring', 'i2c']
  }
};

// Helper function to create sensor from template
export function createSensorFromTemplate(
  templateId: string, 
  customName?: string,
  customSettings?: Partial<SensorMetadata>
): Partial<SensorMetadata> {
  const template = sensorLibrary[templateId];
  if (!template) {
    throw new Error(`Sensor template '${templateId}' not found`);
  }

  return {
    name: customName || template.defaultName,
    description: template.description,
    category: template.category,
    connectionType: template.defaultProtocol.type as any,
    tags: template.tags,
    specification: {
      manufacturer: template.manufacturer,
      model: template.model,
      accuracy: template.accuracy,
      responseTime: template.responseTime,
      operatingTemp: template.operatingTemp
    },
    channels: template.channels.map((ch, idx) => ({
      id: `ch${idx}`,
      name: ch.name,
      type: 'primary' as const,
      range: ch.range,
      unit: ch.unit
    })),
    ...customSettings
  };
}

// Get sensors by category
export function getSensorsByCategory(category: SensorCategory): Record<string, SensorTemplate> {
  return Object.entries(sensorLibrary)
    .filter(([_, template]) => template.category === category)
    .reduce((acc, [key, template]) => ({ ...acc, [key]: template }), {});
}

// Search sensors
export function searchSensors(query: string): Record<string, SensorTemplate> {
  const lowerQuery = query.toLowerCase();
  return Object.entries(sensorLibrary)
    .filter(([key, template]) => 
      key.includes(lowerQuery) ||
      template.defaultName.toLowerCase().includes(lowerQuery) ||
      template.manufacturer.toLowerCase().includes(lowerQuery) ||
      template.model.toLowerCase().includes(lowerQuery) ||
      template.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
    .reduce((acc, [key, template]) => ({ ...acc, [key]: template }), {});
}