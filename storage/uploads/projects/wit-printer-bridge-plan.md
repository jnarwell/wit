# W.I.T. Printer Bridge Implementation Plan 🌉

**Date:** January 2025  
**Project:** W.I.T. Terminal - Printer Bridge  
**Status:** Planning Phase

---

## 📋 Executive Summary

Build a local bridge service that enables full printer control from W.I.T. by translating PrusaConnect-style commands to printer-specific protocols (G-code via PrusaLink API).

---

## 🎯 Problem Statement

- **Current State:** W.I.T. can send commands but PrusaLink (local) doesn't support PrusaConnect's cloud API
- **Issue:** Temperature control and printer commands result in 404 errors
- **Solution:** Create a bridge service that translates between W.I.T. and the printer

---

## 🏗️ Architecture Overview

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   W.I.T. UI     │────────>│  W.I.T. Backend │────────>│  Bridge Agent   │
│  (React App)    │         │  (FastAPI)      │         │  (Python)       │
└─────────────────┘         └─────────────────┘         └─────────────────┘
                                     ↑                            │
                                     │       WebSocket            │ G-code
                                     └────────────────────────────┤
                                                                  ↓
                                                         ┌─────────────────┐
                                                         │     Printer     │
                                                         │  (PrusaLink)    │
                                                         └─────────────────┘
```

---

## 📦 Components to Build

### 1. **Bridge Agent** (`wit_printer_bridge.py`)
- WebSocket client connecting to W.I.T. backend
- HTTP client for printer communication
- Command translator (PrusaConnect → G-code)
- Status reporter (printer telemetry → W.I.T.)

### 2. **Backend Updates** (`dev_server.py`)
- WebSocket endpoint: `/ws/printer-bridge/{printer_id}`
- Bridge registry to track connected bridges
- Command routing to appropriate bridge
- Status broadcasting from bridge to UI

### 3. **Frontend Updates** (Optional)
- Bridge connection status indicator
- "Bridge Connected" badge on printer widget

---

## 🔧 Technical Implementation

### Bridge Agent Features
```python
# Core capabilities
- Command translation (SET_NOZZLE_TEMPERATURE → M104)
- Status polling (every 5 seconds)
- Error handling and reconnection
- Multiple printer support
- Secure authentication
```

### Supported Commands
| W.I.T. Command | G-code | Description |
|----------------|---------|-------------|
| SET_NOZZLE_TEMPERATURE | M104 S{temp} | Set hotend temperature |
| SET_HEATBED_TEMPERATURE | M140 S{temp} | Set bed temperature |
| HOME | G28 {axes} | Home printer axes |
| MOVE | G0 X{x} Y{y} Z{z} | Move to position |
| SET_FLOW | M221 S{percent} | Adjust flow rate |
| SET_SPEED | M220 S{percent} | Adjust print speed |
| GCODE | {raw} | Direct G-code passthrough |

### WebSocket Protocol
```json
// Bridge → W.I.T.
{
  "type": "bridge_register",
  "printer_id": "printer-123",
  "capabilities": ["temperature", "gcode", "status"]
}

// W.I.T. → Bridge
{
  "type": "command",
  "id": "cmd_12345",
  "command": "SET_NOZZLE_TEMPERATURE",
  "kwargs": {"nozzle_temperature": 210}
}

// Bridge → W.I.T.
{
  "type": "status_update",
  "printer_id": "printer-123",
  "status": {
    "temperature": {"tool0": {"actual": 205, "target": 210}},
    "state": {"text": "idle"}
  }
}
```

---

## 🚀 Deployment Options

### Option 1: Development (Manual Run)
```bash
python3 wit_printer_bridge.py \
  --wit-server ws://localhost:8000 \
  --printer-url http://192.168.1.134 \
  --printer-pass GkSsqbykCym6Xd8 \
  --printer-id M175306585185Q
```

### Option 2: Docker Container
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt wit_printer_bridge.py ./
RUN pip install -r requirements.txt
CMD ["python", "wit_printer_bridge.py"]
```

### Option 3: Systemd Service (Production)
```ini
[Unit]
Description=W.I.T. Printer Bridge
After=network.target

[Service]
Type=simple
User=wit
WorkingDirectory=/opt/wit-bridge
ExecStart=/usr/bin/python3 /opt/wit-bridge/wit_printer_bridge.py
Restart=always

[Install]
WantedBy=multi-user.target
```

### Option 4: Raspberry Pi Setup
1. Install Raspberry Pi OS Lite
2. Install Python 3.9+
3. Copy bridge script
4. Configure as systemd service
5. Optional: Add webcam support

---

## 📝 Configuration

### Environment Variables
```bash
# W.I.T. Server
WIT_SERVER_URL=ws://localhost:8000
WIT_API_KEY=optional-for-security

# Printer Settings
PRINTER_URL=http://192.168.1.134
PRINTER_USERNAME=maker
PRINTER_PASSWORD=your-password
PRINTER_ID=M175306585185Q

# Bridge Settings
BRIDGE_LOG_LEVEL=INFO
BRIDGE_RECONNECT_DELAY=5
BRIDGE_STATUS_INTERVAL=5
```

### Configuration File (`bridge_config.yaml`)
```yaml
wit:
  server: ws://localhost:8000
  reconnect_delay: 5

printers:
  - id: M175306585185Q
    url: http://192.168.1.134
    username: maker
    password: ${PRINTER_PASSWORD}
    type: prusalink
    
bridge:
  status_interval: 5
  command_timeout: 30
  log_level: INFO
```

---

## 🧪 Testing Plan

### 1. Unit Tests
- Command translation accuracy
- Error handling scenarios
- Reconnection logic

### 2. Integration Tests
- W.I.T. → Bridge → Printer flow
- Status update propagation
- Multiple printer handling

### 3. Test Commands
```bash
# Test bridge connection
curl -X POST http://localhost:8000/api/v1/equipment/printers/{id}/commands \
  -H "Content-Type: application/json" \
  -d '{"command": "SET_NOZZLE_TEMPERATURE", "kwargs": {"nozzle_temperature": 30}}'

# Verify in logs
tail -f bridge.log | grep "SET_NOZZLE_TEMPERATURE"
```

---

## 🔒 Security Considerations

1. **Authentication**
   - Bridge authenticates with W.I.T. (API key/JWT)
   - Bridge authenticates with printer (digest auth)

2. **Network Security**
   - Bridge runs on local network only
   - No external internet access required
   - Optional: VPN for remote access

3. **Command Validation**
   - Temperature limits (0-250°C nozzle, 0-100°C bed)
   - Movement bounds checking
   - G-code sanitization

4. **Rate Limiting**
   - Max 10 commands per second
   - Cooldown for rapid temperature changes

---

## 📊 Monitoring & Logging

### Metrics to Track
- Bridge uptime
- Commands processed
- Command success rate
- Average response time
- Printer connection status

### Log Format
```
2025-01-20 15:30:45 [INFO] Bridge connected to W.I.T.
2025-01-20 15:30:46 [INFO] Connected to printer at 192.168.1.134
2025-01-20 15:31:00 [INFO] Command received: SET_NOZZLE_TEMPERATURE (210°C)
2025-01-20 15:31:01 [INFO] G-code sent: M104 S210
2025-01-20 15:31:01 [INFO] Command completed successfully
```

---

## 🔄 Future Enhancements

### Phase 1 (MVP) ✓
- Basic command translation
- Temperature control
- Status reporting

### Phase 2
- Print job management
- File upload to printer
- Print progress tracking
- Webcam integration

### Phase 3
- Multi-printer support
- Advanced G-code macros
- Filament tracking
- Power control (smart plugs)
- Failure detection

### Phase 4
- Cloud connectivity
- Mobile app support
- AI print monitoring
- Predictive maintenance

---

## 🛠️ Troubleshooting Guide

### Bridge Won't Connect to W.I.T.
1. Check W.I.T. server is running
2. Verify WebSocket endpoint exists
3. Check firewall rules
4. Verify URL format (ws:// not http://)

### Bridge Won't Connect to Printer
1. Verify printer IP is correct
2. Check printer credentials
3. Ensure PrusaLink is enabled
4. Test with curl: `curl -u maker:pass http://printer-ip/api/version`

### Commands Not Working
1. Check bridge logs for errors
2. Verify G-code endpoint exists
3. Test G-code manually via web UI
4. Check printer firmware version

---

## 📚 Resources

### Documentation
- [PrusaLink API](https://github.com/prusa3d/Prusa-Link-Web)
- [G-code Reference](https://marlinfw.org/meta/gcode/)
- [WebSocket Protocol](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

### Example Code
- Bridge implementation: `wit_printer_bridge.py`
- Test script: `test_bridge.py`
- Backend updates: `bridge_websocket_endpoint.py`

### Community
- W.I.T. GitHub: [your-repo]
- Discord: [your-discord]
- Forum: [your-forum]

---

## ✅ Implementation Checklist

- [ ] Test G-code endpoints with `test_bridge.py`
- [ ] Add WebSocket endpoint to `dev_server.py`
- [ ] Implement bridge agent
- [ ] Test with single printer
- [ ] Add error handling
- [ ] Create systemd service
- [ ] Document deployment process
- [ ] Add monitoring/alerting
- [ ] Test with multiple printers
- [ ] Production deployment

---

## 🎯 Success Criteria

1. **Functional Requirements**
   - ✓ Commands from UI control physical printer
   - ✓ Real-time status updates in UI
   - ✓ Error handling and recovery
   - ✓ Support for multiple printers

2. **Performance Requirements**
   - Command latency < 500ms
   - Status update frequency: 5 seconds
   - 99% uptime for bridge service

3. **User Experience**
   - Seamless integration with existing UI
   - Clear error messages
   - No manual intervention required

---

**Last Updated:** January 2025  
**Next Review:** When ready to implement  
**Contact:** Your Name

---

*This plan provides everything needed to implement the W.I.T. Printer Bridge when you're ready. The bridge will give you full control over your printer through the W.I.T. interface, just like PrusaConnect but running entirely on your local network!*