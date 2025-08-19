# PrusaConnect Capabilities

## Overview

PrusaConnect is Prusa's cloud-based printer control service that provides remote access to your Prusa 3D printers. Unlike PrusaLink (local API), PrusaConnect supports temperature control through its cloud API.

## Supported Features

### ✅ Temperature Control
- **Nozzle Temperature**: Full control via `set_target_hotend` command
- **Bed Temperature**: Full control via `set_target_bed` command
- **Multi-tool Support**: Specify tool index for printers with multiple extruders

### ✅ Monitoring
- Real-time temperature readings
- Print progress tracking
- Printer state monitoring
- File management

### ✅ Print Control
- Start/pause/resume/cancel prints
- Upload and manage G-code files
- Print queue management

### ❌ Movement Control
- Direct axis movement not supported via cloud API
- Homing operations not available
- Manual positioning requires local access

### ❌ Direct G-code Execution
- Raw G-code commands cannot be sent via cloud API
- All operations must use predefined API commands

## API Implementation

### Temperature Control Example

```python
# Set nozzle temperature
async with session.post(
    f"https://connect.prusa3d.com/api/v1/printers/{printer_id}/command",
    json={
        "command": "set_target_hotend",
        "target": 210.0,
        "tool": 0  # Tool index for multi-extruder printers
    },
    headers={"Authorization": f"Bearer {api_token}"}
) as resp:
    # Handle response

# Set bed temperature
async with session.post(
    f"https://connect.prusa3d.com/api/v1/printers/{printer_id}/command",
    json={
        "command": "set_target_bed",
        "target": 60.0
    },
    headers={"Authorization": f"Bearer {api_token}"}
) as resp:
    # Handle response
```

## Control Modes in W.I.T.

| Connection Type | Control Mode | Temperature | Movement | G-code | UI Indicator |
|----------------|--------------|-------------|----------|---------|--------------|
| PrusaConnect   | cloud        | ✅ Yes      | ❌ No    | ❌ No   | 🔵 Cloud Control |
| PrusaLink      | limited      | ❌ No       | ❌ No    | ❌ No   | 🟡 Limited Control |
| OctoPrint      | full         | ✅ Yes      | ✅ Yes   | ✅ Yes  | 🟢 Full Control |
| W.I.T. Bridge  | bridge       | ✅ Yes      | ✅ Yes   | ✅ Yes  | 🟢 Bridge Active |

## Testing Temperature Control

Use the provided test script to verify PrusaConnect temperature control:

```bash
cd software/backend
python test_prusaconnect_temp.py <printer_id> <api_token> [nozzle_temp] [bed_temp]
```

Example:
```bash
python test_prusaconnect_temp.py ABCD1234 your-api-token-here 50 40
```

## UI Behavior

When using PrusaConnect:
1. Temperature values are clickable and editable
2. Control mode shows as "Cloud Control (PrusaConnect)"
3. Movement controls (Home button) are disabled
4. Temperature changes are sent to Prusa's cloud API
5. Changes may take a few seconds to reflect due to cloud latency

## Comparison with PrusaLink

| Feature | PrusaLink (Local) | PrusaConnect (Cloud) |
|---------|-------------------|---------------------|
| Temperature Control | ❌ Read-only | ✅ Read/Write |
| Connection | Local network | Internet/Cloud |
| Security | HTTP Digest Auth | Bearer Token |
| Latency | Low | Medium |
| Bridge Required | Yes (for control) | No (for temp) |

## Notes

- PrusaConnect requires an active internet connection
- API tokens can be obtained from connect.prusa3d.com
- Temperature commands are rate-limited by Prusa's servers
- For full local control including movement, use the W.I.T. Bridge