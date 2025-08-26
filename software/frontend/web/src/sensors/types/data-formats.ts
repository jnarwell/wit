// Data format specifications for sensor data storage and streaming

// Binary data format for high-performance streaming
export interface BinaryDataPacket {
  header: {
    magic: number; // 0x57495453 ('WITS' in hex)
    version: number; // Protocol version
    flags: number; // Bit flags for compression, encryption, etc.
    timestamp: bigint; // Nanoseconds since epoch
    sequenceNumber: number;
    packetSize: number;
  };
  sensorData: {
    sensorId: ArrayBuffer; // 16-byte UUID
    channelCount: number;
    channels: Array<{
      channelId: number;
      dataType: DataType;
      value: ArrayBuffer;
      quality: number; // 0-100
    }>;
  };
  checksum: ArrayBuffer; // CRC32 or SHA256
}

export enum DataType {
  INT8 = 0,
  INT16 = 1,
  INT32 = 2,
  INT64 = 3,
  UINT8 = 4,
  UINT16 = 5,
  UINT32 = 6,
  UINT64 = 7,
  FLOAT32 = 8,
  FLOAT64 = 9,
  BOOLEAN = 10,
  STRING = 11,
  BINARY = 12,
  TIMESTAMP = 13
}

// JSON format for compatibility and debugging
export interface JSONDataPacket {
  version: string;
  timestamp: string; // ISO 8601
  sequenceNumber: number;
  sensor: {
    id: string;
    name: string;
    type: string;
  };
  data: {
    [channelName: string]: {
      value: number | string | boolean;
      unit: string;
      quality: 'good' | 'uncertain' | 'bad';
      timestamp?: string; // Channel-specific timestamp if different
    };
  };
  metadata?: {
    location?: string;
    tags?: string[];
    calibration?: string;
    [key: string]: any;
  };
}

// Compressed time-series format for storage
export interface TimeSeriesBlock {
  sensorId: string;
  channelId: string;
  startTime: number;
  endTime: number;
  samplingRate: number;
  compression: 'none' | 'gzip' | 'lz4' | 'zstd';
  encoding: 'delta' | 'simple8b' | 'gorilla' | 'raw';
  data: ArrayBuffer;
  statistics: {
    count: number;
    min: number;
    max: number;
    mean: number;
    stdDev: number;
  };
}

// Batch format for multiple sensors
export interface BatchDataPacket {
  batchId: string;
  timestamp: number;
  synchronized: boolean;
  readings: Array<{
    sensorId: string;
    timestamp: number;
    channels: Record<string, any>;
  }>;
}

// Event-based format for alerts and triggers
export interface EventDataPacket {
  eventId: string;
  eventType: 'threshold' | 'anomaly' | 'system' | 'user';
  severity: 'info' | 'warning' | 'critical';
  timestamp: number;
  sensorId: string;
  channelId?: string;
  triggerValue: number;
  threshold?: {
    type: 'min' | 'max' | 'range';
    value: number | [number, number];
  };
  message: string;
  metadata?: Record<string, any>;
}

// Streaming protocol messages
export interface StreamMessage {
  type: 'data' | 'subscribe' | 'unsubscribe' | 'config' | 'heartbeat' | 'error';
  payload: any;
}

export interface SubscribeMessage extends StreamMessage {
  type: 'subscribe';
  payload: {
    sensors: string[];
    channels?: string[];
    samplingRate?: number;
    format?: 'json' | 'binary' | 'msgpack';
  };
}

export interface ConfigMessage extends StreamMessage {
  type: 'config';
  payload: {
    sensorId: string;
    config: Record<string, any>;
  };
}

// Data quality indicators
export interface DataQuality {
  value: number; // 0-100
  factors: {
    signalStrength?: number;
    noiseLevel?: number;
    communicationErrors?: number;
    calibrationStatus?: 'valid' | 'expired' | 'none';
    sensorHealth?: 'good' | 'degraded' | 'failed';
  };
}

// Aggregation formats for reduced data transfer
export interface AggregatedDataPacket {
  sensorId: string;
  channelId: string;
  period: {
    start: number;
    end: number;
    duration: number; // seconds
  };
  aggregation: {
    type: 'mean' | 'median' | 'mode' | 'sum' | 'count';
    values: {
      min: number;
      max: number;
      mean: number;
      median?: number;
      stdDev?: number;
      percentiles?: {
        p50: number;
        p90: number;
        p95: number;
        p99: number;
      };
    };
  };
  sampleCount: number;
}

// Export formats
export interface CSVExportFormat {
  headers: string[];
  delimiter: ',' | ';' | '\t';
  dateFormat: string;
  includeMetadata: boolean;
  includeQuality: boolean;
}

export interface ParquetExportFormat {
  compression: 'snappy' | 'gzip' | 'lz4' | 'none';
  rowGroupSize: number;
  schema: {
    fields: Array<{
      name: string;
      type: string;
      nullable: boolean;
    }>;
  };
}

export interface HDF5ExportFormat {
  groups: {
    sensors: boolean;
    channels: boolean;
    metadata: boolean;
  };
  compression: 'gzip' | 'lzf' | 'none';
  chunkSize: number;
}

// Serialization utilities
export class DataSerializer {
  static toBinary(packet: JSONDataPacket): ArrayBuffer {
    // Implementation would convert JSON to efficient binary format
    const encoder = new TextEncoder();
    return encoder.encode(JSON.stringify(packet)).buffer;
  }

  static fromBinary(buffer: ArrayBuffer): JSONDataPacket {
    // Implementation would parse binary format to JSON
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(buffer));
  }

  static compress(data: ArrayBuffer, method: 'gzip' | 'lz4' | 'zstd'): ArrayBuffer {
    // Implementation would compress data
    return data; // Placeholder
  }

  static decompress(data: ArrayBuffer, method: 'gzip' | 'lz4' | 'zstd'): ArrayBuffer {
    // Implementation would decompress data
    return data; // Placeholder
  }
}

// Data validation schemas
export const dataSchemas = {
  sensorReading: {
    type: 'object',
    required: ['sensorId', 'timestamp', 'channels'],
    properties: {
      sensorId: { type: 'string', format: 'uuid' },
      timestamp: { type: 'number', minimum: 0 },
      channels: {
        type: 'object',
        patternProperties: {
          '.*': {
            type: 'object',
            required: ['value', 'unit'],
            properties: {
              value: { type: ['number', 'string', 'boolean'] },
              unit: { type: 'string' },
              quality: { type: 'string', enum: ['good', 'uncertain', 'bad'] }
            }
          }
        }
      }
    }
  }
};