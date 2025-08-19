# Machine Manager Integration Guide

## Overview

The W.I.T. platform now includes a universal Machine Manager system that provides a unified interface for controlling all types of 3D printers and workshop machines. This system is integrated into `dev_server.py` and works alongside the existing printer management code.

## Architecture

### Core Components

1. **Machine Interface** (`core/machine_interface.py`)
   - Defines universal interfaces for all machines
   - `IMachine`, `IMachineConnection`, `IMachineStateReporter`, `IMachineCommandHandler`

2. **Connection Handlers** (`core/connections/`)
   - `SerialConnection`: USB/Serial GCODE printers
   - `HTTPConnection`: REST API based printers
   - `OctoPrintConnection`: OctoPrint API
   - `PrusaLinkConnection`: PrusaLink protocol

3. **State Manager** (`core/state_manager.py`)
   - Normalizes states across different platforms
   - Provides event system for state changes
   - Maps platform-specific states to universal states

4. **Discovery Service** (`core/discovery_service.py`)
   - Auto-discovers USB printers
   - mDNS discovery for OctoPrint
   - Network scanning for known endpoints

5. **Machine Manager** (`core/machine_manager.py`)
   - Central coordination point
   - Legacy compatibility layer
   - WebSocket integration

## Integration with dev_server.py

### Initialization

```python
# Machine Manager is loaded automatically if available
if MACHINE_MANAGER_AVAILABLE:
    machine_manager = get_machine_manager()
    
    # WebSocket state change callbacks are registered
    machine_manager.add_state_changed_callback(on_state_change)
```

### API Endpoints

All existing endpoints now check Machine Manager first:

1. **Add Printer** (`POST /api/v1/equipment/printers`)
   - Attempts to use Machine Manager
   - Falls back to legacy if needed

2. **List Printers** (`GET /api/v1/equipment/printers`)
   - Returns machines from Machine Manager if available
   - Otherwise uses legacy storage

3. **Get Status** (`GET /api/v1/equipment/printers/{id}`)
   - Checks Machine Manager first
   - Normalized status format

4. **Send Command** (`POST /api/v1/equipment/printers/{id}/commands`)
   - Maps PrusaConnect commands to universal commands
   - Supports all machine types

5. **Delete Printer** (`DELETE /api/v1/equipment/printers/{id}`)
   - Removes from Machine Manager
   - Cleans up connections

### Startup Configuration

Enable discovery by setting environment variable:
```bash
ENABLE_MACHINE_DISCOVERY=true python dev_server.py
```

## Usage Examples

### Adding a Serial Printer

```python
POST /api/v1/equipment/printers
{
    "printer_id": "prusa_mk3",
    "name": "Prusa MK3S+",
    "connection_type": "serial",
    "port": "/dev/ttyUSB0",
    "baudrate": 115200,
    "manufacturer": "Prusa",
    "model": "MK3S+"
}
```

### Adding an OctoPrint Printer

```python
POST /api/v1/equipment/printers
{
    "printer_id": "octo_001",
    "name": "OctoPrint Ender 3",
    "connection_type": "octoprint",
    "url": "http://octopi.local",
    "api_key": "your-api-key",
    "manufacturer": "Creality",
    "model": "Ender 3"
}
```

### Sending Commands

```python
POST /api/v1/equipment/printers/{printer_id}/commands
{
    "command": "HOME",
    "kwargs": {"axis": "XYZ"}
}
```

## State Normalization

All printer states are normalized to these universal states:
- `IDLE` - Ready to print
- `PRINTING` - Actively printing
- `PAUSED` - Print paused
- `ERROR` - Error condition
- `COMPLETE` - Job completed
- `PREPARING` - Heating, homing, etc.

## Benefits

1. **Universal Interface**: One API for all printer types
2. **Auto-Discovery**: Finds printers automatically
3. **State Management**: Consistent states across platforms
4. **Event System**: Real-time updates via WebSocket
5. **Extensible**: Easy to add new printer types

## Testing

Run the integration test:
```bash
python test_machine_integration.py
```

This will:
- Add a test printer via Machine Manager
- Get status
- Send commands
- Clean up

## Troubleshooting

### Machine Manager Not Loading

Check imports in dev_server.py output:
- ✅ Machine Manager: Active - Universal printer control enabled
- ⚠️ Machine Manager: Not available - using legacy system

### Discovery Not Working

1. Enable discovery: `ENABLE_MACHINE_DISCOVERY=true`
2. Check logs for discovery attempts
3. Ensure printers are on same network

### Commands Failing

1. Check machine capabilities
2. Verify connection status
3. Review command mapping in machine_manager.py

## Credits

This implementation was inspired by OctoEverywhere's universal printer control architecture (https://github.com/QuinnDamerell/OctoPrint-OctoEverywhere).