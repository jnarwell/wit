# ESP32 Integration Guide

## Overview

The WIT platform now supports direct ESP32 integration via WebSocket or MQTT protocols. This allows ESP32 devices to stream sensor data directly to the platform without requiring the Universal Desktop Controller.

## Features

- **Direct WiFi Connection**: ESP32 connects directly to WIT backend
- **Multiple Protocols**: WebSocket for real-time bidirectional communication or MQTT for lightweight pub/sub
- **Auto-Discovery**: Devices announce themselves on the network
- **Secure Communication**: Optional authentication tokens
- **Example Firmware**: Ready-to-use Arduino sketch provided

## Setup Steps

### 1. Access Configuration Page

Navigate to **Sensors > Configuration** in the WIT interface.

### 2. Add ESP32 Device

1. Click "Add ESP32" button in the ESP32 Devices section
2. Fill in the configuration:
   - **Device Name**: Friendly name for your ESP32
   - **Protocol**: Choose WebSocket or MQTT
   - **Server IP**: WIT server IP (auto-filled with current host)
   - **Port**: 8080 for WebSocket, 1883 for MQTT
   - **Auth Token**: Optional security token

### 3. Flash ESP32 Firmware

The configuration modal provides example firmware code that includes:

```cpp
// Key components:
- WiFi connection management
- WebSocket/MQTT client setup
- JSON message formatting
- Sensor data reading and transmission
- Command handling from server
```

### 4. Connect and Monitor

Once configured:
- ESP32 appears in device list with connection status
- Real-time data streams to Live Data page
- Configure alerts and thresholds
- View historical data

## Supported Sensor Types

The ESP32 firmware can send data for any sensor type:

- **Environmental**: Temperature, humidity, pressure, air quality
- **Motion**: Accelerometer, gyroscope, magnetometer
- **Analog**: Any 0-3.3V analog sensor
- **Digital**: Binary sensors, counters
- **I2C/SPI**: Connected sensor modules

## Message Format

### WebSocket Messages

```json
{
  "type": "sensor_data",
  "device_id": "esp32_01",
  "data": {
    "temperature": 23.5,
    "humidity": 45.2,
    "pressure": 1013.25
  },
  "timestamp": 1705750800000
}
```

### MQTT Topics

- **Data**: `wit/sensors/{device_id}/data`
- **Status**: `wit/sensors/{device_id}/status`
- **Commands**: `wit/sensors/{device_id}/command`

## Security

1. **Network Security**: Use WPA2/WPA3 WiFi encryption
2. **Authentication**: Configure auth tokens for each device
3. **TLS Support**: Enable HTTPS/WSS for encrypted communication
4. **Access Control**: Device-specific permissions in WIT

## Troubleshooting

### Connection Issues
- Verify ESP32 and WIT server are on same network
- Check firewall allows WebSocket (8080) or MQTT (1883) ports
- Monitor ESP32 serial output for connection errors

### Data Not Appearing
- Confirm message format matches expected JSON structure
- Check device is authenticated (if using tokens)
- Verify sensor readings are valid numbers

## Next Steps

1. Explore the Live Data page to see real-time sensor values
2. Set up alerts for threshold monitoring
3. Configure data retention policies
4. Integrate with other WIT features like projects and machines