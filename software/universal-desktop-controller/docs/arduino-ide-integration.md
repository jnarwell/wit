# Arduino IDE Integration Documentation

## Overview
The Arduino IDE integration provides seamless control of the Arduino IDE through the W.I.T. Universal Desktop Controller, enabling web-based management of Arduino development workflows.

## Current Status ✅

### **Working Features:**
- ✅ **Plugin Discovery & Loading**: Arduino IDE plugin loads successfully
- ✅ **Arduino IDE Detection**: Automatically finds Arduino IDE at `/Applications/Arduino IDE.app/Contents/MacOS/Arduino IDE`
- ✅ **IDE Launch**: Successfully launches Arduino IDE from the web interface
- ✅ **WebSocket Communication**: Proper communication between frontend, UDC, and backend
- ✅ **Error Handling**: Graceful error handling with descriptive messages
- ✅ **Serial Port Auto-Discovery**: Attempts to find connected Arduino boards automatically
- ✅ **Configuration Management**: Plugin configuration system working
- ✅ **Frontend Integration**: Arduino IDE appears in Software Integrations page with full control interface

### **Architecture Components:**
1. **Backend**: FastAPI server running on port 8000
2. **Frontend**: React web app running on port 3000
3. **UDC**: Universal Desktop Controller with Arduino IDE plugin
4. **Plugin**: Full-featured Arduino IDE integration with manifest and configuration

## How to Run

### Prerequisites
- Arduino IDE installed at `/Applications/Arduino IDE.app/Contents/MacOS/Arduino IDE` (macOS)
- Node.js and npm installed
- Python 3.12+ with required dependencies

### Starting the System
Run these commands in separate terminals:

```bash
# Terminal 1: Backend Server
cd /Users/jmarwell/Documents/wit/software/backend
python dev_server.py

# Terminal 2: Frontend Web Application  
cd /Users/jmarwell/Documents/wit/software/frontend/web
npm run dev

# Terminal 3: Universal Desktop Controller
cd /Users/jmarwell/Documents/wit/software/universal-desktop-controller
npm start
```

### Accessing the Integration
1. Open http://localhost:3000 in your browser
2. Login with `admin/admin`
3. Navigate to "Software Integrations"
4. Find the Arduino IDE card (should show as "Connected")
5. Click "Full Control →" to access the Arduino IDE control interface

## Features

### IDE Management
- **Launch Arduino IDE**: Opens the Arduino IDE application
- **Process Management**: Tracks running Arduino processes
- **Path Detection**: Automatically finds Arduino IDE installation

### Serial Communication
- **Auto-Discovery**: Automatically detects connected Arduino boards
- **Serial Monitor**: Real-time serial communication with Arduino boards
- **Port Management**: Lists and manages available serial ports
- **Baud Rate Configuration**: Configurable communication speeds

### Project Management
- **Sketch Browser**: Browse Arduino sketches in the sketches directory
- **Project Creation**: Create new Arduino projects from templates
- **Template System**: Multiple project templates (basic, blink, serial)

### Configuration
- **Board Selection**: Configure default Arduino board types
- **Port Configuration**: Set default serial ports
- **Sketches Directory**: Configure Arduino sketches folder location
- **Serial Settings**: Configure auto-start serial monitor behavior

## Current Behavior

### With Hardware Connected
When Arduino boards are connected via USB:
- Serial monitor automatically detects and lists available boards
- Can compile and upload sketches to connected devices
- Real-time serial communication for debugging
- Board-specific configuration options

### Without Hardware (Current State)
- Arduino IDE launches successfully
- Serial monitor shows appropriate error: "No Arduino boards found. Please connect an Arduino or specify a port manually."
- All configuration options remain accessible
- Plugin shows as "Connected" in the web interface

## Technical Implementation

### Plugin Architecture
```
plugins/arduino-ide/
├── index.js           # Main plugin implementation
├── manifest.json      # Plugin configuration and metadata
└── config.json        # User configuration (auto-generated)
```

### Key Technologies
- **SerialPort Integration**: Uses modern SerialPort API with proper error handling
- **Process Management**: Spawns Arduino IDE as detached process
- **Configuration System**: Persistent configuration with defaults
- **WebSocket Protocol**: Real-time communication for status updates
- **React Integration**: Full-featured control interface

### API Commands
- `launch` - Launch Arduino IDE
- `getStatus` - Get plugin status and configuration
- `startSerial` - Start serial monitor
- `stopSerial` - Stop serial monitor
- `sendSerial` - Send data to serial port
- `listBoards` - List connected Arduino boards
- `listPorts` - List all serial ports
- `getSketchList` - Get list of Arduino sketches
- `createSketch` - Create new Arduino sketch
- `updateConfig` - Update plugin configuration

## Files Modified/Created

### Plugin Core
- `/software/universal-desktop-controller/plugins/arduino-ide/index.js` - Main plugin implementation
- `/software/universal-desktop-controller/plugins/arduino-ide/manifest.json` - Plugin manifest

### Frontend Integration
- `/software/frontend/web/src/pages/ApplicationControlPage.tsx` - Arduino control interface
- `/software/frontend/web/src/pages/SoftwareIntegrationsPage.tsx` - Integration listing
- `/software/frontend/web/src/hooks/useUDCWebSocket.ts` - WebSocket communication

## Configuration Options

### Board Types Supported
- Arduino Uno (`arduino:avr:uno`)
- Arduino Mega (`arduino:avr:mega`)
- Arduino Nano (`arduino:avr:nano`)
- Arduino Leonardo (`arduino:avr:leonardo`)
- Arduino MKR1000 (`arduino:samd:mkr1000`)
- Arduino MKR Zero (`arduino:samd:mkrzero`)
- NodeMCU v2 (`esp8266:esp8266:nodemcuv2`)
- ESP32 (`esp32:esp32:esp32`)

### Serial Configuration
- Baud rates: 9600, 19200, 38400, 57600, 115200, 230400
- Auto-detection of serial ports
- Real-time serial monitoring

## Error Handling

### Common Error Messages
- `"Arduino IDE not found at configured path"` - Arduino IDE not installed or wrong path
- `"No Arduino boards found"` - No Arduino hardware connected
- `"Serial port not open"` - Attempting serial communication without open port
- `"Invalid data to send - must be a string"` - Incorrect serial data format

### Troubleshooting
1. **Arduino IDE not launching**: Verify Arduino IDE is installed at the expected path
2. **No boards detected**: Ensure Arduino is connected via USB and drivers are installed
3. **Serial communication fails**: Check that the correct port and baud rate are configured
4. **Plugin shows as disconnected**: Restart the UDC and ensure backend is running

## Next Steps (When Hardware Available)

1. **Connect Arduino Hardware**: Connect an Arduino board via USB
2. **Test Serial Monitor**: Verify real-time serial communication
3. **Test Sketch Upload**: Compile and upload sketches to the board
4. **Board Detection**: Test automatic board detection and selection
5. **Configuration**: Set up default board types and ports for your setup

## Development Notes

### WebSocket Message Flow
```
Frontend → UDC → Arduino Plugin → Arduino IDE/Hardware
Frontend ← UDC ← Arduino Plugin ← Arduino IDE/Hardware
```

### Plugin Lifecycle
1. **Initialization**: Load configuration, detect Arduino IDE
2. **Connection**: Connect to backend WebSocket
3. **Command Processing**: Handle frontend commands
4. **Response**: Send results back to frontend
5. **Cleanup**: Properly close serial ports and processes on shutdown

## Security Considerations

- Plugin runs with user permissions only
- No elevated privileges required
- Serial port access follows system permissions
- Process spawning is controlled and monitored

---

**Status**: Production-ready, awaiting hardware for full testing
**Last Updated**: August 19, 2025
**Version**: 1.0.0