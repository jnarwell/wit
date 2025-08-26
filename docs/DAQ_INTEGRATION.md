# DAQ (Data Acquisition) Integration Guide

## Overview

The WIT platform provides comprehensive support for industrial DAQ (Data Acquisition) systems through multiple standard protocols. This cross-platform solution works on Windows, macOS, and Linux without requiring proprietary software like Dewesoft.

## Architecture

```
┌─────────────────┐    Protocol    ┌─────────────────┐    WebSocket    ┌─────────────────┐
│   DAQ System    │ ◄─────────────► │   WIT Backend   │ ◄─────────────► │  WIT Frontend   │
│                 │   TCP/Ethernet  │                 │   ws://8000/    │                 │
│ - Modbus TCP    │                 │ - Python APIs   │                 │ - Device Mgmt   │
│ - OPC UA        │                 │ - Real-time     │                 │ - Live Data     │
│ - Raw TCP       │                 │ - Data Storage  │                 │ - Visualization │
│ - HTTP REST     │                 │ - Multi-device  │                 │ - Alerts        │
└─────────────────┘                 └─────────────────┘                 └─────────────────┘
```

## Supported Protocols

### 1. Modbus TCP
**Best for**: PLCs, RTUs, industrial sensors
- **Port**: 502 (default)
- **Features**: Holding registers, input registers, multiple data types
- **Library**: pymodbus (cross-platform)

### 2. OPC UA
**Best for**: Modern industrial automation systems
- **Port**: 4840 (default)
- **Features**: Secure communication, complex data structures
- **Library**: asyncua (cross-platform)

### 3. Raw TCP
**Best for**: Custom protocols, legacy systems
- **Port**: Configurable
- **Features**: CSV, binary, custom formats
- **Library**: Native Python sockets

### 4. HTTP REST
**Best for**: Web-enabled DAQs, cloud systems
- **Port**: 80/443 (default)
- **Features**: JSON responses, RESTful APIs
- **Library**: aiohttp (built-in)

## Quick Start

### Prerequisites

Install required dependencies:
```bash
# For Modbus support
pip install pymodbus

# For OPC UA support
pip install asyncua

# For HTTP client support (usually included)
pip install aiohttp
```

### Step 1: Access Configuration

1. Navigate to **Sensors → Configuration** in WIT
2. Scroll to **Professional DAQs** section
3. Click **"Add DAQ"**

### Step 2: Configure Connection

1. **Device Name**: Give your DAQ a descriptive name
2. **Protocol**: Choose appropriate protocol for your device
3. **Host/IP**: Enter the DAQ system's network address
4. **Port**: Default ports are auto-filled
5. **Poll Interval**: Set how often to read data (seconds)

### Step 3: Configure Channels

Each channel represents a data point from your DAQ:

#### For Modbus TCP:
- **Channel Name**: Descriptive name (e.g., "Temperature")
- **Register Address**: Modbus register number
- **Register Type**: Holding or Input registers
- **Data Type**: int16, int32, or float32
- **Scale/Offset**: For unit conversion

#### For OPC UA:
- **Channel Name**: Descriptive name
- **Node ID**: OPC UA node identifier (e.g., "ns=2;s=Channel1")
- **Data Type**: Expected data type
- **Scale/Offset**: For unit conversion

### Step 4: Test Connection

1. Click **"Connect DAQ"**
2. Verify connection status shows "Connected"
3. Check that data is being received
4. Use the **"Read"** button to manually fetch data

## Protocol-Specific Configuration

### Modbus TCP Configuration

```json
{
  "name": "Production Line PLC",
  "protocol": "modbus_tcp",
  "host": "192.168.1.100",
  "port": 502,
  "poll_interval": 1.0,
  "channels": [
    {
      "name": "Temperature_Tank_1",
      "address": 40001,
      "register_type": "holding",
      "data_type": "float32",
      "scale": 0.1,
      "offset": 0,
      "unit": "°C"
    },
    {
      "name": "Pressure_Line_A",
      "address": 40003,
      "register_type": "holding",
      "data_type": "int16",
      "scale": 0.01,
      "offset": 0,
      "unit": "bar"
    }
  ]
}
```

### OPC UA Configuration

```json
{
  "name": "SCADA Server",
  "protocol": "opcua",
  "host": "192.168.1.50",
  "port": 4840,
  "poll_interval": 0.5,
  "channels": [
    {
      "name": "Flow_Rate",
      "node_id": "ns=2;s=FlowMeter.Value",
      "data_type": "float32",
      "scale": 1.0,
      "offset": 0,
      "unit": "L/min"
    },
    {
      "name": "Motor_Speed",
      "node_id": "ns=2;s=Motor.RPM",
      "data_type": "int32",
      "scale": 1.0,
      "offset": 0,
      "unit": "RPM"
    }
  ]
}
```

### Raw TCP Configuration

```json
{
  "name": "Custom Data Logger",
  "protocol": "raw_tcp",
  "host": "192.168.1.200",
  "port": 9999,
  "poll_interval": 2.0,
  "read_command": "READ\n",
  "format": "csv",
  "channels": [
    {
      "name": "Sensor_1",
      "data_type": "float32",
      "scale": 1.0,
      "offset": 0,
      "unit": "V"
    },
    {
      "name": "Sensor_2", 
      "data_type": "float32",
      "scale": 1.0,
      "offset": 0,
      "unit": "A"
    }
  ]
}
```

### HTTP REST Configuration

```json
{
  "name": "Weather Station API",
  "protocol": "http_rest",
  "host": "api.weather-station.local",
  "port": 80,
  "poll_interval": 60.0,
  "endpoint": "/api/sensors",
  "channels": [
    {
      "name": "Outdoor_Temperature",
      "json_path": "sensors.temperature",
      "data_type": "float32",
      "scale": 1.0,
      "offset": 0,
      "unit": "°C"
    },
    {
      "name": "Wind_Speed",
      "json_path": "weather.wind.speed",
      "data_type": "float32",
      "scale": 3.6,
      "offset": 0,
      "unit": "km/h"
    }
  ]
}
```

## Cross-Platform Benefits

### Unlike Dewesoft:
- **macOS Compatible**: Runs natively on Mac systems
- **Linux Support**: Works on any Linux distribution  
- **No Licensing**: Open-source solution, no per-seat costs
- **Cloud Ready**: Can be deployed in containers or cloud instances
- **Custom Protocols**: Easy to add new protocol support

### Hardware Agnostic:
- Works with any Ethernet-connected DAQ
- Standard protocol support means vendor independence
- No proprietary drivers required
- Network-based communication for easy scaling

## Advanced Features

### Multi-Device Support

Connect multiple DAQ systems simultaneously:

```python
# Backend automatically handles multiple devices
devices = [
    {"name": "Line 1 PLC", "protocol": "modbus_tcp", "host": "192.168.1.10"},
    {"name": "Line 2 PLC", "protocol": "modbus_tcp", "host": "192.168.1.11"},
    {"name": "SCADA", "protocol": "opcua", "host": "192.168.1.50"},
    {"name": "Weather", "protocol": "http_rest", "host": "api.weather.local"}
]
```

### Real-Time Data Streaming

Data flows automatically to connected clients:

```javascript
// Frontend automatically receives updates via WebSocket
daqService.subscribe((data) => {
  if (data.type === 'daq_data') {
    console.log(`Device ${data.deviceId}:`, data.data.channels);
    updateCharts(data.data.channels);
  }
});
```

### Data Scaling and Units

Apply engineering units and scaling:

```json
{
  "name": "Pressure_Sensor",
  "address": 40005,
  "data_type": "int16",
  "scale": 0.01,     // Convert from centibars to bars
  "offset": -1.0,    // Remove atmospheric pressure offset
  "unit": "bar(g)"   // Gauge pressure in bars
}
```

### Error Handling and Reconnection

Automatic error recovery:
- Connection failures trigger automatic reconnection
- Individual channel errors don't affect other channels
- Exponential backoff prevents network flooding
- Status monitoring shows connection health

## Integration Examples

### Siemens S7 PLC via Modbus TCP

```python
# Configuration for Siemens S7-1200/1500 with Modbus TCP
{
  "name": "Siemens_S7_1500",
  "protocol": "modbus_tcp",
  "host": "192.168.1.15",
  "port": 502,
  "channels": [
    {
      "name": "Tank_Level",
      "address": 4001,      # DB1.DBD0 mapped to 40001
      "data_type": "float32",
      "unit": "mm"
    },
    {
      "name": "Motor_Current",
      "address": 4003,      # DB1.DBD4 mapped to 40003
      "data_type": "float32", 
      "unit": "A"
    }
  ]
}
```

### Allen-Bradley CompactLogix via Ethernet/IP

```python
# Use OPC UA server or Modbus TCP module
{
  "name": "AB_CompactLogix",
  "protocol": "modbus_tcp",  # Via 1756-M02AS module
  "host": "192.168.1.20",
  "port": 502,
  "channels": [
    {
      "name": "Conveyor_Speed",
      "address": 40100,
      "data_type": "int32",
      "scale": 0.1,
      "unit": "m/min"
    }
  ]
}
```

### Schneider Electric Modicon via Modbus TCP

```python
{
  "name": "Schneider_M580",
  "protocol": "modbus_tcp",
  "host": "192.168.1.25", 
  "port": 502,
  "channels": [
    {
      "name": "Power_Consumption",
      "address": 3001,       # Input register
      "register_type": "input",
      "data_type": "int32",
      "scale": 0.001,
      "unit": "kW"
    }
  ]
}
```

### National Instruments CompactDAQ via OPC UA

```python
{
  "name": "NI_cDAQ",
  "protocol": "opcua",
  "host": "192.168.1.30",
  "port": 4840,
  "channels": [
    {
      "name": "Thermocouple_1",
      "node_id": "ns=2;s=cDAQ1Mod1/ai0",
      "data_type": "float32",
      "unit": "°C"
    },
    {
      "name": "Strain_Gauge_1", 
      "node_id": "ns=2;s=cDAQ1Mod2/ai0",
      "data_type": "float32",
      "unit": "με"
    }
  ]
}
```

## Security Considerations

### Network Security
- Use VLANs to isolate industrial networks
- Configure firewalls for specific ports only
- Consider VPN for remote access
- Monitor network traffic for anomalies

### Authentication
- OPC UA supports user/password authentication
- Use certificates for OPC UA when available
- Modbus TCP typically uses network-level security
- HTTP REST can use API keys or tokens

### Data Validation
- All incoming data is validated and sanitized
- Out-of-range values are flagged
- Malformed packets are logged and rejected
- Rate limiting prevents DOS attacks

## Performance Optimization

### Polling Strategy
```python
# Optimize polling intervals based on data criticality
fast_channels = ["Emergency_Stop", "Pressure_Alarm"]    # 100ms
normal_channels = ["Temperature", "Flow_Rate"]          # 1s  
slow_channels = ["Tank_Level", "Daily_Production"]      # 10s
```

### Batch Reading
```python
# Read multiple registers in single request
{
  "batch_read": True,
  "start_address": 40001,
  "count": 10,           # Read 10 consecutive registers
  "channels": [
    {"name": "Temp_1", "offset": 0},
    {"name": "Temp_2", "offset": 2}, 
    {"name": "Pressure", "offset": 4}
  ]
}
```

### Memory Management
- Configurable data retention periods
- Automatic data archiving for historical analysis
- Compression for long-term storage
- Circular buffers for real-time data

## Troubleshooting

### Connection Issues

1. **Network Connectivity**
   ```bash
   # Test basic connectivity
   ping 192.168.1.100
   
   # Test port availability
   telnet 192.168.1.100 502
   ```

2. **Firewall Problems**
   ```bash
   # Common ports to check:
   # Modbus TCP: 502
   # OPC UA: 4840
   # HTTP: 80/443
   ```

3. **Protocol-Specific Issues**
   - Modbus: Check device ID and register mapping
   - OPC UA: Verify node IDs and security settings
   - TCP: Confirm data format and commands
   - HTTP: Test API endpoints manually

### Data Quality Issues

1. **Scaling Problems**
   - Verify scale and offset values
   - Check data type matches device output
   - Test with known values

2. **Missing Data**
   - Check polling intervals
   - Verify channel configuration
   - Monitor connection stability

3. **Performance Issues**
   - Reduce polling frequency
   - Use batch reads where possible
   - Check network latency

### Logs and Debugging

Enable debug logging:
```python
import logging
logging.getLogger('pymodbus').setLevel(logging.DEBUG)
logging.getLogger('asyncua').setLevel(logging.DEBUG)
```

Check WIT backend logs for:
- Connection attempts and failures
- Data parsing errors
- Protocol-specific error codes
- Performance metrics

## API Reference

### REST Endpoints

```http
GET /api/v1/daq/protocols
# Returns list of supported protocols

POST /api/v1/daq/devices  
# Add new DAQ device

GET /api/v1/daq/devices
# List all DAQ devices

GET /api/v1/daq/devices/{device_id}/data
# Read current data from device

DELETE /api/v1/daq/devices/{device_id}
# Remove DAQ device
```

### WebSocket API

```javascript
// Connect to DAQ WebSocket
const ws = new WebSocket('ws://localhost:8000/api/v1/daq/ws');

// Receive real-time data
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'device_list':
      console.log('DAQ devices:', message.devices);
      break;
      
    case 'daq_data':
      console.log(`Data from ${message.device_id}:`, message.data);
      break;
  }
};
```

## Future Enhancements

### Planned Features
1. **Ethernet/IP Support**: Direct Allen-Bradley communication
2. **HART Protocol**: Smart field device support
3. **Profinet**: Siemens and other industrial networks
4. **Data Analytics**: Built-in analysis and trending
5. **Mobile Apps**: iOS/Android monitoring
6. **Cloud Sync**: AWS/Azure integration

### Plugin Architecture
The DAQ system is designed to be extensible:
- New protocols can be added as plugins
- Custom data processing pipelines
- Third-party integrations
- User-defined dashboards

## Resources

- [Modbus Protocol Specification](https://modbus.org/)
- [OPC UA Information Model](https://opcfoundation.org/)
- [Industrial Ethernet Standards](https://www.odva.org/)
- [WIT Platform Documentation](/docs/)
- [Python Industrial Automation](https://python.org/)