// Sensor service interfaces

import { 
  SensorMetadata, 
  SensorConfiguration, 
  SensorReading, 
  SensorStatus,
  SensorTEDS,
  DAQGroup
} from '../types/sensor.types';

// Main data acquisition service interface
export interface IDataAcquisitionService {
  // Sensor management
  registerSensor(metadata: SensorMetadata): Promise<string>;
  updateSensor(sensorId: string, updates: Partial<SensorMetadata>): Promise<void>;
  removeSensor(sensorId: string): Promise<void>;
  getSensor(sensorId: string): Promise<SensorMetadata | null>;
  listSensors(filter?: SensorFilter): Promise<SensorMetadata[]>;
  
  // Configuration
  configureSensor(config: SensorConfiguration): Promise<void>;
  getConfiguration(sensorId: string): Promise<SensorConfiguration | null>;
  
  // Auto-discovery
  discoverSensors(): Promise<SensorTEDS[]>;
  autoConfigureSensor(teds: SensorTEDS): Promise<string>;
  
  // Data acquisition
  startAcquisition(sensorIds: string[]): Promise<void>;
  stopAcquisition(sensorIds: string[]): Promise<void>;
  
  // Group operations
  createDAQGroup(group: Omit<DAQGroup, 'id'>): Promise<string>;
  startGroupAcquisition(groupId: string): Promise<void>;
  stopGroupAcquisition(groupId: string): Promise<void>;
}

// Real-time streaming interface
export interface IStreamingService {
  // WebSocket connections
  connect(url: string, options?: StreamOptions): Promise<void>;
  disconnect(): void;
  
  // Subscriptions
  subscribeSensor(sensorId: string, callback: (reading: SensorReading) => void): string;
  unsubscribe(subscriptionId: string): void;
  
  // Batch operations
  subscribeMultiple(sensorIds: string[], callback: (readings: SensorReading[]) => void): string;
  
  // Stream control
  setStreamingRate(sensorId: string, rate: number): void;
  pauseStream(sensorId: string): void;
  resumeStream(sensorId: string): void;
}

// Data processing interface
export interface IDataProcessingService {
  // Real-time processing
  applyFilter(data: SensorReading[], filterType: string, params: any): SensorReading[];
  calculateStatistics(data: SensorReading[], window: number): SensorStatistics;
  detectAnomalies(data: SensorReading[], threshold: number): AnomalyEvent[];
  
  // Calibration
  applyCalibration(reading: SensorReading, calibration: any): SensorReading;
  calculateCalibrationCurve(referenceData: any[], measuredData: any[]): CalibrationCurve;
  
  // Feature extraction
  extractFeatures(data: SensorReading[], features: string[]): FeatureSet;
  performFFT(data: number[], samplingRate: number): FrequencySpectrum;
}

// Storage interface
export interface IStorageService {
  // Time-series operations
  storeReading(reading: SensorReading): Promise<void>;
  storeBatch(readings: SensorReading[]): Promise<void>;
  
  // Retrieval
  getReadings(sensorId: string, timeRange: TimeRange, options?: QueryOptions): Promise<SensorReading[]>;
  getLatestReading(sensorId: string): Promise<SensorReading | null>;
  
  // Aggregation
  getAggregatedData(sensorId: string, timeRange: TimeRange, interval: string): Promise<AggregatedData[]>;
  
  // Export
  exportData(sensorIds: string[], timeRange: TimeRange, format: ExportFormat): Promise<Blob>;
}

// Alert service interface
export interface IAlertService {
  // Alert configuration
  createAlert(alert: AlertConfiguration): Promise<string>;
  updateAlert(alertId: string, updates: Partial<AlertConfiguration>): Promise<void>;
  deleteAlert(alertId: string): Promise<void>;
  
  // Alert monitoring
  checkThresholds(reading: SensorReading): AlertEvent[];
  getActiveAlerts(): Promise<AlertEvent[]>;
  acknowledgeAlert(alertId: string): Promise<void>;
  
  // Notifications
  subscribeToAlerts(callback: (alert: AlertEvent) => void): string;
  unsubscribeFromAlerts(subscriptionId: string): void;
}

// Supporting types
export interface SensorFilter {
  category?: string;
  connectionType?: string;
  location?: string;
  tags?: string[];
  status?: 'active' | 'inactive' | 'error';
}

export interface StreamOptions {
  reconnect?: boolean;
  reconnectInterval?: number;
  compression?: boolean;
  authentication?: {
    type: 'token' | 'certificate';
    credentials: any;
  };
}

export interface SensorStatistics {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  rms: number;
  peakToPeak: number;
}

export interface AnomalyEvent {
  timestamp: number;
  sensorId: string;
  type: 'spike' | 'drift' | 'noise' | 'outOfRange';
  severity: 'low' | 'medium' | 'high';
  value: number;
  expectedRange: { min: number; max: number };
}

export interface CalibrationCurve {
  type: 'linear' | 'polynomial' | 'spline';
  coefficients: number[];
  r2: number;
  residuals: number[];
}

export interface FeatureSet {
  features: Record<string, number>;
  timestamp: number;
  windowSize: number;
}

export interface FrequencySpectrum {
  frequencies: number[];
  magnitudes: number[];
  phases: number[];
  dominantFrequency: number;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface QueryOptions {
  limit?: number;
  decimation?: number;
  includeMetadata?: boolean;
}

export interface AggregatedData {
  timestamp: number;
  count: number;
  min: number;
  max: number;
  avg: number;
  stdDev: number;
}

export type ExportFormat = 'csv' | 'json' | 'parquet' | 'hdf5' | 'matlab';

export interface AlertConfiguration {
  id?: string;
  name: string;
  sensorId: string;
  channelId?: string;
  condition: {
    type: 'threshold' | 'rate_of_change' | 'pattern' | 'correlation';
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    value: number;
    duration?: number; // seconds
  };
  severity: 'info' | 'warning' | 'critical';
  actions: AlertAction[];
  enabled: boolean;
}

export interface AlertAction {
  type: 'email' | 'sms' | 'webhook' | 'ui_notification';
  target: string;
  template?: string;
}

export interface AlertEvent {
  id: string;
  alertConfigId: string;
  sensorId: string;
  timestamp: number;
  value: number;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
}