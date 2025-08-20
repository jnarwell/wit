# Blender Plugin for W.I.T. Universal Desktop Controller

## Overview

The Blender plugin integrates Blender's powerful 3D modeling, animation, and rendering capabilities with the W.I.T. platform, enabling AI-driven 3D content creation and automation through Blender's comprehensive Python API.

## Features

### 🎨 AI-Powered 3D Modeling
- **Natural Language Commands**: "Create a gear with 20 teeth" → AI generates Python script → Blender executes
- **Procedural Generation**: AI creates complex geometries using mathematical algorithms
- **Design Iteration**: "Make it more aerodynamic" → AI modifies existing meshes
- **Parametric Control**: AI adjusts object properties based on specifications

### 🔧 Advanced Capabilities
- **Multi-Engine Rendering**: Cycles, Eevee, Workbench support
- **Animation Automation**: AI-generated animation sequences
- **Material Creation**: Procedural PBR materials with AI assistance
- **Lighting Setup**: Automatic scene lighting optimization
- **Batch Processing**: Render multiple angles/variations automatically
- **3D Printing Optimization**: Mesh optimization for additive manufacturing

### 🐍 Python API Integration
- **Script Execution**: Run custom Python scripts in Blender
- **Template System**: Predefined project templates
- **Add-on Management**: Install and configure Blender add-ons
- **Scene Manipulation**: Real-time scene modification via API
- **Export Pipeline**: Multi-format export automation

## Installation Requirements

### Blender Version
- **Minimum**: Blender 3.0+
- **Recommended**: Blender 4.0+ for latest features
- **Supported Platforms**: Windows, macOS, Linux

### Installation Paths
The plugin automatically detects Blender installations at:

**macOS:**
- `/Applications/Blender.app/Contents/MacOS/Blender`
- `/Applications/Blender [version].app/Contents/MacOS/Blender`

**Windows:**
- `C:\\Program Files\\Blender Foundation\\Blender [version]\\blender.exe`
- `%LOCALAPPDATA%\\Programs\\Blender Foundation\\Blender\\blender.exe`

**Linux:**
- `/usr/bin/blender`
- `/usr/local/bin/blender`
- `/snap/bin/blender`

## Configuration

### Default Settings
```json
{
  "projectsPath": "~/Documents/Blender",
  "pythonScriptsPath": "~/Documents/Blender/Scripts", 
  "renderEngine": "CYCLES",
  "renderSamples": 128,
  "aiIntegration": {
    "enabled": true
  },
  "renderPresets": {
    "preview": { "samples": 32, "resolution": [640, 480] },
    "medium": { "samples": 128, "resolution": [1920, 1080] },
    "high": { "samples": 256, "resolution": [3840, 2160] }
  }
}
```

### Directory Structure
```
~/Documents/Blender/
├── Projects/           # .blend project files
├── Scripts/           # Custom Python scripts
│   ├── wit_ai_helper.py      # AI helper functions
│   └── wit_templates.py      # Project templates
├── Addons/            # Custom Blender add-ons
├── Exports/           # Rendered images and exported models
└── Temp/              # Temporary files
```

## Available Commands

### Core Commands
- `launch` - Launch Blender application
- `openFile` - Open specific .blend file
- `newFile` - Create new project from template
- `executeScript` - Run Python script in Blender
- `getStatus` - Get plugin status and information

### 3D Modeling
- `createObject` - Create primitive objects (cube, sphere, cylinder, etc.)
- `modifyObject` - Modify object properties (location, rotation, scale)
- `deleteObject` - Remove objects from scene
- `listObjects` - List all objects in current scene
- `getSceneInfo` - Get comprehensive scene information

### Rendering & Export
- `render` - Render current scene to image
- `export` - Export scene to various formats (OBJ, FBX, GLTF, STL, etc.)
- `import` - Import models into Blender
- `setupLighting` - Configure scene lighting

### AI-Enhanced Features
- `generateMesh` - AI-generate procedural meshes
- `optimizeMesh` - Optimize mesh for specific use cases
- `createMaterial` - Generate PBR materials
- `cameraComposition` - AI-optimize camera positioning
- `batchRender` - Automated batch rendering

## Usage Examples

### Basic Object Creation
```javascript
// Create a cube at specific location
await sendCommand('blender', 'createObject', {
    type: 'cube',
    location: [2, 0, 1],
    scale: [1, 2, 0.5]
});
```

### AI-Driven Modeling
```javascript
// AI generates complex geometry
await sendCommand('blender', 'executeScript', {
    script: `
import bpy
# AI-generated script for creating mechanical part
bpy.ops.mesh.primitive_cylinder_add()
# Add threads, chamfers, etc.
    `
});
```

### Batch Rendering
```javascript
// Render scene from multiple angles
await sendCommand('blender', 'batchRender', {
    angles: [
        { location: [7, -7, 5], rotation: [55, 0, 45] },
        { location: [-7, 7, 5], rotation: [55, 0, -135] },
        { location: [0, -10, 3], rotation: [60, 0, 0] }
    ],
    outputDir: '~/Documents/Blender/Exports/'
});
```

### Material Creation
```javascript
// Create PBR material
await sendCommand('blender', 'executeScript', {
    script: `
from wit_ai_helper import create_material, apply_material
mat = create_material("Steel", color=(0.7, 0.7, 0.8, 1.0), metallic=0.9, roughness=0.2)
apply_material("Cube", mat)
    `
});
```

## AI Terminal Integration

### Natural Language Commands
```
User: "Create a product visualization scene for a smartphone"
AI: → Generates Blender Python script
    → Creates phone model with proper proportions  
    → Sets up studio lighting
    → Positions camera for hero shot
    → Applies realistic materials

User: "Make the phone case more rugged"
AI: → Modifies existing geometry
    → Adds corner protection details
    → Increases material roughness
    → Updates textures for durability appearance
```

### Advanced AI Workflows
```
User: "Generate 5 variations of this chair design"
AI: → Analyzes current chair model
    → Creates parametric variations
    → Renders each from same angle
    → Exports all as separate files

User: "Optimize this model for 3D printing"
AI: → Checks mesh for manifold issues
    → Adds support structures where needed
    → Adjusts wall thickness
    → Exports as STL with metadata
```

## Project Templates

### Available Templates
- **Basic**: Simple scene with cube and basic lighting
- **Product Visualization**: Studio setup for product photography
- **Character**: Basic character modeling template
- **Architectural**: Building/interior design template
- **Mechanical**: Engineering/CAD-style setup
- **Animation**: Character rigging and animation setup

### Custom Templates
Create custom templates in `wit_templates.py`:
```python
def create_custom_template():
    # Clear scene
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    
    # Add your custom setup
    # Objects, materials, lighting, cameras
    
    return "Custom template created"
```

## Troubleshooting

### Common Issues

**Blender Not Detected**
- Ensure Blender is installed in standard location
- Check if Blender is in system PATH
- Verify executable permissions

**Script Execution Fails**
- Check Python script syntax
- Ensure required modules are available
- Verify file paths are correct

**Render Failures**  
- Check scene has valid camera
- Ensure sufficient disk space
- Verify render settings are valid

**Performance Issues**
- Reduce render samples for preview
- Use simplified geometry during development  
- Close unnecessary Blender instances

### Debug Mode
Enable verbose logging in plugin configuration:
```json
{
  "debug": true,
  "logLevel": "verbose"
}
```

## Contributing

### Adding New Features
1. Extend the BlenderPlugin class
2. Add new Python helper functions to `wit_ai_helper.py`
3. Update command documentation
4. Add test cases

### Custom Scripts
Place custom Python scripts in:
- `~/Documents/Blender/Scripts/` - General scripts
- `~/Documents/Blender/Scripts/ai/` - AI-specific functions
- `~/Documents/Blender/Scripts/templates/` - Project templates

## License

This plugin is part of the W.I.T. project and follows the same MIT license terms.

## Support

For issues and feature requests:
- GitHub Issues: [W.I.T. Repository](https://github.com/yourusername/wit/issues)
- Discord: [W.I.T. Community](https://discord.gg/wit-makers)
- Documentation: [Plugin Development Guide](../../docs/PLUGIN_DEVELOPMENT_GUIDE.md)