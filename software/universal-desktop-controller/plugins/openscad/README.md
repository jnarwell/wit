# OpenSCAD Plugin for W.I.T. Universal Desktop Controller

This plugin provides seamless integration with OpenSCAD, the programmers' solid 3D CAD modeller.

## Features

- **Launch OpenSCAD** - Open the OpenSCAD application
- **File Management** - Create, open, and manage .scad files
- **Live Preview** - Render models in preview or full quality
- **Export Capabilities** - Export to STL, OFF, AMF, 3MF, DXF, SVG, PNG
- **Parametric Design** - Extract and modify customizable variables
- **Template Library** - Start with pre-built templates
- **Syntax Checking** - Validate OpenSCAD code
- **File Watching** - Auto-render on file changes

## Supported Commands

- `launch` - Launch OpenSCAD application
- `openFile` - Open a .scad file
- `newFile` - Create a new file from template
- `render` - Render the model (preview/full)
- `export` - Export to various formats
- `compile` - Check syntax and compile code
- `listProjects` - List all OpenSCAD projects
- `createProject` - Create a new project
- `getVariables` - Extract customizable parameters
- `updateVariables` - Update model parameters
- `generateSTL` - Quick STL export
- `generatePreview` - Generate preview image
- `checkSyntax` - Validate OpenSCAD syntax
- `getExamples` - Get example models
- `watchFile` - Watch for file changes

## Configuration

The plugin stores its configuration in the UDC data directory:

```json
{
  "openscadPath": "auto",  // Path to OpenSCAD or "auto" for auto-detection
  "projectsPath": "~/Documents/OpenSCAD",
  "autoSave": true,
  "renderQuality": "preview",  // "preview" or "render"
  "exportFormats": ["stl", "off", "amf", "3mf", "dxf", "svg", "png"],
  "customizer": {
    "enabled": true
  },
  "defaultCamera": {
    "translation": [0, 0, 0],
    "rotation": [55, 0, 25],
    "distance": 140
  }
}
```

## Templates

The plugin includes several built-in templates:

1. **Basic** - Simple starting point
2. **Parametric Box** - Customizable box with rounded corners
3. **Gear** - Parametric gear generator

## Customizer Support

Models can include customizable parameters using OpenSCAD's customizer syntax:

```openscad
// Parameters
diameter = 20; // [10:50]
height = 30; // [10:100]
wall_thickness = 2; // [1:5]
```

## Export Formats

- **STL** - Standard for 3D printing
- **OFF** - Object File Format
- **AMF** - Additive Manufacturing Format
- **3MF** - 3D Manufacturing Format
- **DXF** - 2D profiles for laser cutting
- **SVG** - 2D vector graphics
- **PNG** - Rendered images

## Installation

1. Install OpenSCAD from https://openscad.org/downloads.html
2. The plugin will auto-detect the installation
3. Configure projects directory if needed

## Platform Support

- **macOS**: `/Applications/OpenSCAD.app`
- **Windows**: `C:\Program Files\OpenSCAD\`
- **Linux**: `/usr/bin/openscad` or via package manager

## Examples

### Create a new parametric model:
```javascript
sendCommand('openscad', 'newFile', {
  name: 'my_model',
  template: 'parametric_box'
});
```

### Export to STL:
```javascript
sendCommand('openscad', 'generateSTL', {
  filePath: '~/Documents/OpenSCAD/models/my_model.scad'
});
```

### Extract variables:
```javascript
sendCommand('openscad', 'getVariables', {
  filePath: '~/Documents/OpenSCAD/models/my_model.scad'
});
```

## Troubleshooting

- **OpenSCAD not found**: Install from official website or update plugin config
- **Render fails**: Check syntax errors in the model
- **Export fails**: Ensure model is valid and manifold

## License

This plugin is part of the W.I.T. project and follows the same license terms.