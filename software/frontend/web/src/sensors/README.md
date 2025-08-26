# WIT Sensors System Architecture

## Overview

The WIT Sensors system is a comprehensive data acquisition and management platform designed to handle various sensor types, protocols, and data formats. It's built with scalability, real-time performance, and flexibility in mind.

## Directory Structure

```
sensors/
├── types/              # TypeScript type definitions
│   ├── sensor.types.ts     # Core sensor types and interfaces
│   ├── protocols.ts        # Communication protocol definitions
│   └── data-formats.ts     # Data serialization formats
├── interfaces/         # Service interfaces
│   └── index.ts           # Main service contracts
├── services/          # Core services
│   ├── data-acquisition/  # DAQ service implementation
│   ├── streaming/         # Real-time data streaming
│   ├── processing/        # Data processing and analysis
│   └── storage/          # Data persistence
├── components/        # React components
│   ├── configuration/    # Sensor configuration UI
│   ├── visualization/    # Data visualization components
│   ├── calibration/      # Calibration interfaces
│   ├── alerts/          # Alert management UI
│   └── acquisition/     # Data acquisition controls
├── hooks/            # React hooks
├── utils/            # Utility functions
│   └── sensor-library.ts  # Pre-defined sensor templates
└── stores/           # State management

```

## Key Features

### 1. Universal Sensor Support
- **Multiple Protocols**: I2C, SPI, UART, CAN, EtherCAT, Modbus, OPC UA, MQTT, WebSocket
- **Sensor Categories**: Temperature, pressure, flow, vibration, acceleration, force, etc.
- **Auto-Discovery**: TEDS-like automatic sensor recognition
- **Sensor Library**: Pre-configured templates for common sensors

### 2. Data Acquisition
- **High-Speed Sampling**: Up to 1 MHz for analog inputs
- **Synchronized Groups**: Hardware/software synchronized multi-sensor capture
- **Triggering**: Manual, scheduled, threshold, and external triggers
- **Real-time Processing**: On-the-fly filtering and calibration

### 3. Communication Protocols

#### I2C
```typescript
{
  type: 'i2c',
  settings: {
    address: 0x68,
    bus: 1,
    speed: 400000
  }
}
```

#### SPI
```typescript
{
  type: 'spi',
  settings: {
    bus: 0,
    device: 0,
    mode: 0,
    speed: 5000000
  }
}
```

#### WebSocket (Real-time streaming)
```typescript
{
  type: 'websocket',
  settings: {
    url: 'ws://localhost:8080/sensors',
    reconnect: true,
    pingInterval: 30000
  }
}
```

### 4. Data Formats

#### JSON Format (Human-readable)
```json
{
  "version": "1.0",
  "timestamp": "2024-01-20T10:30:00Z",
  "sensor": {
    "id": "sensor-123",
    "name": "Temperature Sensor 1",
    "type": "dht22"
  },
  "data": {
    "temperature": {
      "value": 23.5,
      "unit": "°C",
      "quality": "good"
    },
    "humidity": {
      "value": 45.2,
      "unit": "%",
      "quality": "good"
    }
  }
}
```

#### Binary Format (High-performance)
- Optimized for minimal overhead
- Supports compression (gzip, lz4, zstd)
- Includes checksums for data integrity

### 5. Services

#### Data Acquisition Service
```typescript
interface IDataAcquisitionService {
  registerSensor(metadata: SensorMetadata): Promise<string>;
  configureSensor(config: SensorConfiguration): Promise<void>;
  startAcquisition(sensorIds: string[]): Promise<void>;
  stopAcquisition(sensorIds: string[]): Promise<void>;
}
```

#### Streaming Service
```typescript
interface IStreamingService {
  connect(url: string): Promise<void>;
  subscribeSensor(sensorId: string, callback: Function): string;
  setStreamingRate(sensorId: string, rate: number): void;
}
```

#### Processing Service
```typescript
interface IDataProcessingService {
  applyFilter(data: SensorReading[], filterType: string): SensorReading[];
  calculateStatistics(data: SensorReading[]): SensorStatistics;
  detectAnomalies(data: SensorReading[]): AnomalyEvent[];
}
```

## Usage Examples

### 1. Register a New Sensor
```typescript
const sensor = await createSensorFromTemplate('dht22', 'Room Temperature');
const sensorId = await daqService.registerSensor(sensor);
```

### 2. Configure and Start Acquisition
```typescript
await daqService.configureSensor({
  sensorId,
  enabled: true,
  samplingRate: 100, // 100 Hz
  filterType: 'lowpass',
  filterFrequency: 50
});

await daqService.startAcquisition([sensorId]);
```

### 3. Subscribe to Real-time Data
```typescript
const subId = streamingService.subscribeSensor(sensorId, (reading) => {
  console.log(`Temperature: ${reading.channels.temperature.value}°C`);
});
```

### 4. Set Up Alerts
```typescript
await alertService.createAlert({
  name: 'High Temperature Alert',
  sensorId,
  channelId: 'temperature',
  condition: {
    type: 'threshold',
    operator: '>',
    value: 30,
    duration: 60 // seconds
  },
  severity: 'warning',
  actions: [{
    type: 'ui_notification',
    target: 'dashboard'
  }]
});
```

## Integration Points

### Backend API
- RESTful endpoints for sensor management
- WebSocket server for real-time streaming
- Time-series database for historical data

### Hardware Interfaces
- Direct GPIO access for digital sensors
- ADC interfaces for analog sensors
- Protocol-specific drivers (I2C, SPI, etc.)

### External Systems
- OPC UA servers for industrial integration
- MQTT brokers for IoT connectivity
- Cloud services for remote monitoring

## Performance Considerations

1. **Buffering**: Implement circular buffers for high-speed data
2. **Decimation**: Reduce data rate for storage/display
3. **Compression**: Use appropriate compression for data type
4. **Caching**: Cache frequently accessed sensor metadata
5. **Batch Operations**: Group multiple sensor reads

## Security

1. **Authentication**: Token-based auth for API access
2. **Encryption**: TLS for all network communications
3. **Validation**: Input validation for all sensor data
4. **Audit Trail**: Log all configuration changes
5. **Access Control**: Role-based sensor permissions

## Future Enhancements

1. **Machine Learning**: Predictive maintenance and anomaly detection
2. **Edge Computing**: Local processing for reduced latency
3. **Sensor Fusion**: Combine multiple sensors for derived measurements
4. **Digital Twins**: Virtual sensor models for simulation
5. **Blockchain**: Immutable sensor data for compliance