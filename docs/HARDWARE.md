# W.I.T. Hardware Integration Guide

## Overview

W.I.T. supports integration with a wide variety of workshop equipment through multiple connection protocols. This guide covers how to connect and configure different types of hardware.

## Supported Equipment Types

### 3D Printers

#### Prusa Printers
- **PrusaLink**: Network-connected Prusa printers (MK4, XL, MINI+)
- **PrusaConnect**: Cloud-connected Prusa printers
- **Serial**: Direct USB connection for older models

#### Other 3D Printers
- **OctoPrint**: Any printer running OctoPrint
- **Marlin**: Direct serial connection to Marlin firmware
- **Klipper**: Via Moonraker API
- **RepRapFirmware**: Network connection

### CNC Machines
- **GRBL**: Serial connection to GRBL controllers
- **LinuxCNC**: Network API integration
- **Mach3/4**: Via plugin (planned)

### Other Equipment
- **Laser Cutters**: GRBL-based or proprietary APIs
- **Vinyl Cutters**: Serial communication
- **IoT Sensors**: MQTT or HTTP APIs
- **Industrial Equipment**: Modbus protocol

## Connection Methods

### 1. Network Connection (Recommended)

Most modern equipment supports network connectivity:

```json
{
  "printer_id": "prusa_mk4_01",
  "name": "Prusa MK4",
  "type": "prusalink",
  "connection_type": "network",
  "ip_address": "192.168.1.100",
  "api_key": "your-api-key-here"
}
```

#### Finding Your Device IP
```bash
# Scan network for devices
nmap -sn 192.168.1.0/24

# Or use W.I.T. discovery
GET /api/v1/equipment/printers/discover
```

### 2. Serial/USB Connection

For direct USB connections:

```json
{
  "printer_id": "ender3_01",
  "name": "Ender 3",
  "type": "serial",
  "connection_type": "serial",
  "port": "/dev/ttyUSB0",
  "baudrate": 115200
}
```

#### Finding Serial Ports
```bash
# Linux/Mac
ls /dev/tty*

# Or use W.I.T. API
GET /api/v1/microcontrollers/ports
```

### 3. MQTT Connection

For IoT devices:

```json
{
  "device_id": "sensor_01",
  "name": "Temperature Sensor",
  "type": "mqtt",
  "mqtt_topic": "workshop/sensors/temp1",
  "mqtt_broker": "localhost:1883"
}
```

## Equipment-Specific Setup

### PrusaLink Setup

1. **Enable PrusaLink** on your printer:
   - Menu → Settings → Network → PrusaLink
   - Set a username and password

2. **Find IP Address**:
   - Menu → Settings → Network → IP Address

3. **Get API Key**:
   - Access printer web interface: `http://[printer-ip]`
   - Settings → API Keys → Add Key

4. **Add to W.I.T.**:
   ```bash
   POST /api/v1/equipment/printers
   {
     "printer_id": "prusa_mk4_workshop",
     "name": "Workshop MK4",
     "type": "prusalink",
     "connection_type": "network",
     "ip_address": "192.168.1.100",
     "api_key": "your-api-key"
   }
   ```

### OctoPrint Setup

1. **Install OctoPrint** on Raspberry Pi or computer

2. **Get API Key**:
   - OctoPrint Settings → API
   - Generate Application Key

3. **Add to W.I.T.**:
   ```bash
   POST /api/v1/equipment/printers
   {
     "printer_id": "octoprint_ender3",
     "name": "Ender 3 OctoPrint",
     "type": "octoprint",
     "connection_type": "network",
     "ip_address": "octopi.local",
     "api_key": "your-octoprint-api-key"
   }
   ```

### Serial Printer Setup

1. **Connect printer via USB**

2. **Find serial port**:
   ```bash
   # List ports before connecting
   ls /dev/tty* > before.txt
   
   # Connect printer
   
   # List ports after connecting
   ls /dev/tty* > after.txt
   
   # See new port
   diff before.txt after.txt
   ```

3. **Add to W.I.T.**:
   ```bash
   POST /api/v1/equipment/printers
   {
     "printer_id": "serial_printer",
     "name": "Direct Connected Printer",
     "type": "serial",
     "connection_type": "serial",
     "port": "/dev/ttyUSB0",
     "baudrate": 115200,
     "manufacturer": "Creality",
     "model": "Ender 3"
   }
   ```

## Auto-Discovery

W.I.T. can automatically discover some equipment:

```bash
GET /api/v1/equipment/printers/discover
```

Response:
```json
[
  {
    "name": "Prusa MK4",
    "type": "prusalink",
    "address": "192.168.1.100",
    "port": 80
  },
  {
    "name": "OctoPrint on octopi",
    "type": "octoprint",
    "address": "192.168.1.105",
    "port": 80
  }
]
```

## Printer Bridge Mode

For printers with limited APIs, use the W.I.T. Printer Bridge:

1. **Connect bridge client**:
   ```bash
   python scripts/application/wit_printer_bridge.py \
     --printer-id YOUR_PRINTER_ID \
     --wit-url ws://localhost:8000
   ```

2. **Bridge translates** W.I.T. commands to native G-code

3. **Full control** via W.I.T. interface

## Testing Connections

Always test before adding equipment:

```bash
POST /api/v1/equipment/printers/test
{
  "type": "prusalink",
  "ip_address": "192.168.1.100",
  "api_key": "test-key"
}
```

## Troubleshooting

### Connection Refused
- Check IP address is correct
- Verify device is on same network
- Check firewall settings
- Ensure API is enabled on device

### Authentication Failed
- Verify API key is correct
- Check API key permissions
- Regenerate API key if needed

### Serial Connection Issues
- Check USB cable
- Verify correct port
- Try different baud rates (9600, 57600, 115200, 250000)
- Check user has serial port permissions:
  ```bash
  # Add user to dialout group (Linux)
  sudo usermod -a -G dialout $USER
  # Logout and login again
  ```

### Discovery Not Working
- Ensure devices support mDNS/Bonjour
- Check network allows multicast
- Try manual IP scanning
- Verify no VLAN separation

## Security Considerations

### API Keys
- Store securely (never in code)
- Use minimum required permissions
- Rotate regularly
- Use HTTPS in production

### Network Security
- Use VLANs to isolate equipment
- Configure firewall rules
- Use VPN for remote access
- Monitor access logs

### Physical Security
- Limit USB access
- Secure equipment physically
- Use authentication on devices
- Log all operations

## Performance Optimization

### Polling Intervals
Configure appropriate polling intervals:

```python
# Fast updates for active printer
"polling_interval": 1000,  # 1 second

# Slower updates for idle equipment
"idle_polling_interval": 10000,  # 10 seconds
```

### Connection Pooling
W.I.T. automatically manages connection pools:
- Maximum 5 concurrent connections per device
- Connection timeout: 30 seconds
- Automatic reconnection on failure

### Caching
Status data is cached to reduce load:
- Cache duration: 500ms for active devices
- Cache duration: 5s for idle devices

## Advanced Configuration

### Custom Protocol Handler

For unsupported equipment, create custom handlers:

```python
from core.machine_interface import IMachine, IMachineConnection

class CustomMachineConnection(IMachineConnection):
    async def connect(self) -> bool:
        # Custom connection logic
        pass
    
    async def send_command(self, command: str) -> str:
        # Custom command translation
        pass
```

### MQTT Topics

Standard MQTT topic structure:
```
wit/equipment/{type}/{id}/status
wit/equipment/{type}/{id}/command
wit/equipment/{type}/{id}/response
```

### Modbus Configuration

For industrial equipment:
```json
{
  "device_id": "plc_01",
  "type": "modbus",
  "connection": {
    "host": "192.168.1.200",
    "port": 502,
    "unit_id": 1
  },
  "registers": {
    "temperature": {"address": 0x0001, "type": "float32"},
    "pressure": {"address": 0x0003, "type": "float32"}
  }
}
```

## Future Hardware Support

Planned integrations:
- Haas CNC machines
- Universal Robots arms
- Epilog laser cutters
- Tormach mills
- Pick-and-place machines
- Industrial cameras
- Environmental sensors

## Contributing Hardware Support

To add support for new hardware:

1. Study existing connection handlers
2. Implement IMachine interface
3. Add discovery mechanism
4. Create documentation
5. Submit pull request

See [DEVELOPMENT.md](DEVELOPMENT.md) for details.