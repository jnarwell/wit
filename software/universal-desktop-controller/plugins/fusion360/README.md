# Fusion 360 Plugin for W.I.T. Universal Desktop Controller

## Overview

The Fusion 360 plugin provides comprehensive integration with Autodesk Fusion 360, enabling AI-driven CAD/CAM automation and professional design workflows through the W.I.T. platform.

## Features

### 🎯 Core Capabilities
- **Process Management**: Launch and control Fusion 360 instances
- **Project Management**: Create, open, and manage Fusion 360 projects
- **Parametric Control**: Real-time parameter manipulation and design updates
- **CAD Operations**: Create and modify 3D models programmatically
- **CAM Integration**: Generate toolpaths and manufacturing workflows
- **Simulation**: Structural and thermal analysis capabilities
- **Export/Import**: Support for STL, STEP, IGES, and other formats

### 🔧 AI Integration Ready
- **Full API Exposure**: Complete Fusion 360 API access through HTTP bridge
- **Natural Language Control**: AI can execute complex CAD operations
- **Context Awareness**: Integration with W.I.T.'s workshop management
- **Automated Workflows**: From design concept to manufacturing

### 🏗️ Architecture
- **UDC Plugin**: Node.js plugin running in Universal Desktop Controller
- **Add-in Bridge**: Python add-in running inside Fusion 360
- **HTTP Communication**: RESTful API for real-time command execution
- **File Watching**: Monitor project changes and updates

## Installation

### Prerequisites
- W.I.T. Universal Desktop Controller
- Node.js dependencies (automatically installed)
- Autodesk Fusion 360 (Personal or Commercial license) - Optional for initial setup

### Setup Steps

#### 1. UDC Plugin Installation
The UDC plugin is automatically available in the W.I.T. software integrations.

**Note**: The plugin will load successfully even if Fusion 360 is not installed on your system. You can configure the Fusion 360 installation path later through the plugin settings.

#### 2. Fusion 360 Add-in Installation

**Manual Installation:**
1. Open Fusion 360
2. Go to **Tools > Add-Ins > Scripts and Add-Ins**
3. Click the **Create** button
4. Navigate to the bridge folder: `plugins/fusion360/bridge/`
5. Select the `UDC_Bridge.py` file
6. Click **OK** to install

**Alternative Installation:**
1. Copy the entire `bridge` folder to:
   - **Windows**: `%APPDATA%\\Autodesk\\Autodesk Fusion 360\\API\\AddIns\\`
   - **macOS**: `~/Library/Application Support/Autodesk/Autodesk Fusion 360/API/AddIns/`

#### 3. Configure and Start Bridge
1. In Fusion 360, go to **Scripts and Add-Ins**
2. Find **UDC_Bridge** in the list
3. Click **Run** to start the HTTP server
4. The bridge will start on port 8360 (configurable)

## Configuration

### UDC Plugin Settings
- **Fusion 360 Path**: Auto-detected or manually configured
- **Workspace Path**: Default project directory
- **Communication Port**: HTTP bridge port (default: 8360)
- **Enable Features**: CAM, Simulation, Generative Design options
- **Auto-launch**: Start Fusion 360 with plugin

### Bridge Settings
The bridge runs on `http://localhost:8360` and provides:
- `/health` - Health check endpoint
- `/status` - Fusion 360 status information
- `/api/command` - Command execution endpoint
- `/api/projects` - Project management

## Usage Examples

### Basic Operations

```javascript
// Launch Fusion 360
await sendCommand('fusion360', 'launch');

// Get available projects  
const projects = await sendCommand('fusion360', 'getProjects');

// Create a new project
await sendCommand('fusion360', 'createProject', {
  projectName: 'My Widget Design',
  templateType: 'mechanical'
});

// Create a parametric box
await sendCommand('fusion360', 'createModel', {
  modelType: 'box',
  parameters: {
    width: 50,
    height: 30, 
    depth: 20
  }
});
```

### Advanced CAM Operations

```javascript
// Set up CAM operations
await sendCommand('fusion360', 'setupCAM', {
  setupName: 'Milling Setup 1',
  stock: { type: 'box', dimensions: [60, 40, 30] },
  origin: { x: 0, y: 0, z: 30 }
});

// Generate toolpaths
await sendCommand('fusion360', 'generateToolpaths', {
  setupName: 'Milling Setup 1',
  operations: [
    { type: 'face', tool: '10mm_face_mill' },
    { type: 'adaptive', tool: '6mm_endmill' },
    { type: 'finish', tool: '3mm_ball_endmill' }
  ]
});
```

### AI-Driven Design

```javascript
// AI can generate complex designs
await sendCommand('fusion360', 'generateDesign', {
  prompt: 'Create a bracket for mounting a 50mm motor to a 20mm rail',
  constraints: {
    material: 'aluminum',
    maxStress: '100MPa',
    safetyFactor: 3
  }
});

// AI can optimize existing designs
await sendCommand('fusion360', 'optimizeDesign', {
  objectives: ['minimize_weight', 'maximize_strength'],
  constraints: { maxDeflection: '0.1mm' }
});
```

## API Reference

### Core Commands
- `launch` - Launch Fusion 360 process
- `getProjects` - List available projects
- `openProject` - Open specific project
- `createProject` - Create new project
- `saveProject` - Save current project

### CAD Operations
- `createModel` - Create parametric models
- `modifyModel` - Modify existing geometry
- `setParameters` - Update design parameters
- `getParameters` - Get current parameters
- `exportModel` - Export to various formats
- `importModel` - Import external files

### CAM Operations
- `setupCAM` - Configure manufacturing setup
- `generateToolpaths` - Create toolpaths
- `postProcessCAM` - Generate G-code
- `validateDesign` - Check manufacturability

### Simulation
- `runSimulation` - Execute FEA/CFD analysis
- `optimizeDesign` - AI-powered optimization
- `generateDesign` - Generative design

## Troubleshooting

### Common Issues

**Fusion 360 Not Detected**
- Ensure Fusion 360 is installed
- Check installation paths in plugin settings
- Verify executable permissions

**Bridge Connection Failed**
- Ensure UDC Bridge add-in is installed and running
- Check firewall settings for port 8360
- Verify Fusion 360 process is running

**Add-in Installation Issues**
- Use "Create" button in Scripts and Add-Ins dialog
- Check file permissions in installation directory
- Restart Fusion 360 after installation

**API Command Failures**
- Ensure Fusion 360 has an active design/document
- Check parameter names and values
- Verify workspace and project access

### Debug Mode

Enable debug logging in plugin configuration:
```javascript
this.debug = true;
```

## Limitations

1. **Desktop Application**: Requires Fusion 360 desktop version
2. **License Dependency**: Users must have valid Fusion 360 licenses
3. **Platform Support**: Windows and macOS only (Linux via Wine)
4. **Add-in Requirement**: Manual add-in installation required
5. **Network Dependency**: Cloud features require internet connection

## Security Considerations

- HTTP bridge runs on localhost only
- No authentication required (local access only)
- File system access limited to Fusion 360 workspace
- Python script execution in Fusion 360 sandbox

## Development

### Extending the Bridge

Add new commands to the bridge by:
1. Adding command handler in `execute_command()` method
2. Implementing the command logic
3. Adding corresponding UDC plugin method
4. Testing with Fusion 360 API

### Contributing

See the main W.I.T. development guide for contribution guidelines.

## License

This plugin is part of the W.I.T. project and follows the same licensing terms.