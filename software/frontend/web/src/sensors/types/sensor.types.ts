// Core sensor type definitions inspired by professional DAQ systems

export type SensorConnectionType = 
  | 'analog_voltage'
  | 'analog_current'
  | 'i2c'
  | 'spi'
  | 'uart'
  | 'can'
  | 'ethercat'
  | 'modbus'
  | 'opc_ua'
  | 'mqtt'
  | 'websocket'
  | 'digital'
  | 'iepe'
  | 'thermocouple'
  | 'rtd'
  | 'strain_gauge';

export type SensorCategory =
  | 'temperature'
  | 'pressure'
  | 'flow'
  | 'level'
  | 'vibration'
  | 'acceleration'
  | 'force'
  | 'torque'
  | 'displacement'
  | 'velocity'
  | 'humidity'
  | 'gas'
  | 'electrical'
  | 'optical'
  | 'acoustic'
  | 'environmental';

export interface SensorRange {
  min: number;
  max: number;
  unit: string;
  resolution?: number;
}

export interface SensorCalibration {
  id: string;
  date: string;
  type: 'factory' | 'user' | 'automatic';
  coefficients: Record<string, number>;
  validUntil?: string;
  certificateUrl?: string;
}

export interface SensorChannel {
  id: string;
  name: string;
  type: 'primary' | 'auxiliary';
  range: SensorRange;
  currentValue?: number;
  unit: string;
  scalingFactor?: number;
  offset?: number;
}

export interface SensorSpec {
  manufacturer: string;
  model: string;
  serialNumber?: string;
  dataSheet?: string;
  accuracy: string;
  responseTime?: string;
  operatingTemp?: SensorRange;
  powerRequirements?: string;
}

export interface SensorMetadata {
  id: string;
  name: string;
  description?: string;
  category: SensorCategory;
  connectionType: SensorConnectionType;
  location?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  specification: SensorSpec;
  channels: SensorChannel[];
  calibration?: SensorCalibration;
}

export interface SensorConfiguration {
  sensorId: string;
  enabled: boolean;
  samplingRate: number; // Hz
  filterType?: 'none' | 'lowpass' | 'highpass' | 'bandpass' | 'notch';
  filterFrequency?: number;
  triggerMode?: 'continuous' | 'threshold' | 'edge' | 'window';
  triggerSettings?: Record<string, any>;
  dataFormat?: 'raw' | 'scaled' | 'engineering_units';
  storagePolicy?: 'all' | 'on_change' | 'decimated';
  alertThresholds?: {
    warning?: { min?: number; max?: number };
    critical?: { min?: number; max?: number };
  };
}

export interface SensorReading {
  sensorId: string;
  timestamp: number;
  channels: {
    [channelId: string]: {
      value: number;
      unit: string;
      quality: 'good' | 'uncertain' | 'bad';
    };
  };
  metadata?: {
    samplingRate?: number;
    sequenceNumber?: number;
    checksum?: string;
  };
}

export interface SensorStatus {
  sensorId: string;
  connected: boolean;
  lastSeen: string;
  health: 'healthy' | 'degraded' | 'error';
  diagnostics: {
    signalQuality?: number; // 0-100
    noiseLevel?: number;
    driftDetected?: boolean;
    communicationErrors?: number;
  };
  errors?: string[];
}

// TEDS-like automatic sensor recognition
export interface SensorTEDS {
  manufacturer: string;
  model: string;
  serialNumber: string;
  calibrationData: Record<string, any>;
  channelInfo: {
    count: number;
    types: string[];
    ranges: SensorRange[];
  };
}

// Data acquisition group for synchronized multi-sensor capture
export interface DAQGroup {
  id: string;
  name: string;
  sensors: string[]; // sensor IDs
  syncMode: 'hardware' | 'software' | 'gps' | 'ntp';
  masterClock?: string; // sensor ID acting as master
  startTrigger?: {
    type: 'manual' | 'scheduled' | 'external' | 'threshold';
    settings: Record<string, any>;
  };
}