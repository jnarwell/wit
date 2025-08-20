# Node-RED Plugin for W.I.T. Universal Desktop Controller

This plugin integrates Node-RED, a flow-based visual programming tool, with the W.I.T. platform to enable IoT automation, sensor data processing, and machine control workflows.

## Features

- **Visual Flow Programming**: Create automation workflows with drag-and-drop interface
- **W.I.T. Integration**: Custom nodes for sensors and machines
- **Real-time Data**: Process sensor data and control machines in real-time
- **Pre-built Templates**: Quick-start flows for common automation tasks
- **Auto-discovery**: Automatically import W.I.T. sensors and machines

## Installation

The plugin is automatically loaded when the Universal Desktop Controller starts. Node-RED will be installed locally if not already present.

## Usage

### Starting Node-RED

1. Open the W.I.T. web interface
2. Navigate to Software Integrations
3. Find Node-RED and click "Start"
4. Click "Open Editor" to access the Node-RED flow editor

### Creating Flows

1. Use the template library for quick starts:
   - **Sensor Monitor**: Collect and log sensor data
   - **Machine Control**: Automate machine operations
   - **Scheduled Tasks**: Run automations on schedules
   - **Alert System**: Send notifications based on conditions

2. Custom W.I.T. nodes available:
   - `wit-sensor`: Input node for sensor data
   - `wit-machine`: Output node for machine commands

### Example Flow

```json
[
  {
    "id": "1",
    "type": "wit-sensor",
    "name": "Temperature Sensor",
    "sensorId": "temp-001",
    "wires": [["2"]]
  },
  {
    "id": "2",
    "type": "function",
    "name": "Check Threshold",
    "func": "if (msg.payload.value > 30) {\n  msg.payload = { alert: true };\n  return msg;\n}",
    "wires": [["3"]]
  },
  {
    "id": "3",
    "type": "wit-machine",
    "name": "Turn on Fan",
    "machineId": "fan-001",
    "command": "start"
  }
]
```

## Configuration

Configuration is stored in `~/.node-red-wit/`:
- `settings.js`: Node-RED configuration
- `wit-flows.json`: Your automation flows
- `wit-nodes/`: Custom W.I.T. nodes

## API Commands

- `start`: Start Node-RED server
- `stop`: Stop Node-RED server
- `restart`: Restart Node-RED
- `openEditor`: Open flow editor in browser
- `getStatus`: Get server status
- `getFlows`: Retrieve all flows
- `deployFlow`: Deploy a new flow
- `createFlow`: Create flow from template
- `syncWithWIT`: Import sensors/machines from W.I.T.

## Troubleshooting

### Node-RED won't start
- Check if port 1880 is already in use
- Verify Node.js is installed
- Check logs in UDC settings

### Can't see W.I.T. nodes
- Restart Node-RED from the control panel
- Check `~/.node-red-wit/wit-nodes/` directory

### Flows not executing
- Ensure Node-RED is running (green status)
- Check node configuration
- Verify W.I.T. backend connection

## Development

To add custom nodes:
1. Create node file in `wit-nodes/`
2. Add to `package.json`
3. Restart Node-RED

## License

MIT