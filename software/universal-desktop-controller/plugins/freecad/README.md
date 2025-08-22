# FreeCAD Plugin for W.I.T. Universal Desktop Controller

## Overview

The FreeCAD plugin integrates the open-source parametric 3D CAD modeler with the W.I.T. platform, enabling AI-driven parametric design, engineering analysis, and technical documentation through FreeCAD's comprehensive Python API.

## Features

### 🎯 Parametric Design
- **Feature-Based Modeling**: Create complex parts using parametric features (pad, pocket, revolution, loft)
- **Constraint-Based Sketching**: 2D sketches with geometric constraints that drive 3D geometry
- **Assembly Design**: Create assemblies with parts and constraints
- **Design History**: Full parametric history tree for easy modifications

### 🛠️ Engineering Capabilities
- **Multi-Workbench Support**: Part, PartDesign, Draft, Sketcher, Arch, FEM, Path, Assembly
- **FEM Analysis**: Finite Element Analysis for structural simulation
- **Technical Drawings**: Generate 2D drawings from 3D models with TechDraw
- **CAM/Path Generation**: Create toolpaths for CNC machining
- **Sheet Metal Design**: Specialized tools for sheet metal parts

### 🤖 AI Integration
- **Natural Language Modeling**: "Create a bracket with 4 mounting holes"
- **Parametric Generation**: AI creates fully parametric models
- **Design Optimization**: AI suggests improvements based on constraints
- **Batch Processing**: Generate variations of designs automatically
- **Smart Templates**: AI-powered project templates

### 🐍 Python Scripting
- **Full API Access**: Complete access to FreeCAD's Python API
- **Macro Recording**: Record and playback operations
- **Custom Scripts**: Execute complex modeling operations
- **Workbench Development**: Create custom workbenches
- **Automation**: Batch processing and design automation

## Installation Requirements

### FreeCAD Version
- **Minimum**: FreeCAD 0.19
- **Recommended**: FreeCAD 0.21 or later
- **Supported Platforms**: Windows, macOS, Linux

### Installation Paths
The plugin automatically detects FreeCAD installations at:

**macOS:**
- `/Applications/FreeCAD.app/Contents/MacOS/FreeCAD`
- `/Applications/FreeCAD [version].app/Contents/MacOS/FreeCAD`

**Windows:**
- `C:\\Program Files\\FreeCAD [version]\\bin\\FreeCAD.exe`
- `%LOCALAPPDATA%\\Programs\\FreeCAD\\bin\\FreeCAD.exe`

**Linux:**
- `/usr/bin/freecad`
- `/usr/local/bin/freecad`
- `/snap/bin/freecad`

## Configuration

### Default Settings
```json
{
  "projectsPath": "~/Documents/FreeCAD",
  "pythonScriptsPath": "~/Documents/FreeCAD/Scripts",
  "macrosPath": "~/Documents/FreeCAD/Macros",
  "defaultWorkbench": "PartDesign",
  "exportFormats": ["step", "iges", "stl", "obj", "dxf", "svg", "pdf"],
  "aiIntegration": {
    "enabled": true
  }
}
```

### Directory Structure
```
~/Documents/FreeCAD/
├── Projects/          # .FCStd project files
├── Scripts/           # Python scripts for automation
│   ├── wit_ai_helper.py      # AI helper functions
│   └── wit_templates.py      # Project templates
├── Macros/            # FreeCAD macros
├── Exports/           # Exported models
└── Templates/         # Custom templates
```

## Available Commands

### Core Commands
- `launch` - Launch FreeCAD application
- `openFile` - Open FreeCAD document (.FCStd)
- `newFile` - Create new project from template
- `executeScript` - Execute Python script
- `getStatus` - Get plugin status

### Modeling Commands
- `createPrimitive` - Create basic shapes (box, cylinder, sphere)
- `createSketch` - Create 2D sketch on face
- `createFeature` - Create parametric features
- `modifyObject` - Modify object properties
- `applyConstraint` - Apply geometric constraints

### Document Operations
- `listProjects` - List FreeCAD projects
- `listObjects` - List objects in document
- `getDocumentInfo` - Get document information
- `saveDocument` - Save current document
- `exportModel` - Export to various formats

### Advanced Features
- `createAssembly` - Create assembly with parts
- `performFEA` - Run FEM analysis
- `generateDrawing` - Create technical drawings
- `generateGCode` - Generate CNC toolpaths

## Usage Examples

### Create Parametric Box
```javascript
await sendCommand('freecad', 'createPrimitive', {
    type: 'box',
    dimensions: {
        length: 100,
        width: 50,
        height: 20
    },
    name: 'ParametricBox'
});
```

### AI-Driven Design
```javascript
// AI generates parametric bracket
await sendCommand('freecad', 'executeScript', {
    script: `
# Create bracket with mounting holes
doc = FreeCAD.newDocument("Bracket")
body = doc.addObject('PartDesign::Body', 'Bracket')

# Base sketch...
# Pad feature...
# Hole pattern...
    `
});
```

### Export to STEP
```javascript
await sendCommand('freecad', 'exportModel', {
    objectName: 'Bracket',
    filePath: '~/Documents/FreeCAD/Exports/bracket.step',
    format: 'step'
});
```

### Assembly Creation
```javascript
await sendCommand('freecad', 'executeScript', {
    script: `
from wit_ai_helper import create_assembly
parts = ['Part1', 'Part2', 'Part3']
assembly_name = create_assembly(parts, 'MainAssembly')
    `
});
```

## AI Terminal Integration

### Natural Language Examples
```
User: "Create a mounting bracket 100mm x 50mm with 4 holes"
AI: → Generates parametric FreeCAD model
    → Creates base sketch with dimensions
    → Adds pad feature for thickness
    → Creates hole pattern with constraints
    → All dimensions remain parametric

User: "Make the holes 8mm diameter, 10mm from edges"
AI: → Modifies existing constraints
    → Updates hole diameter parameter
    → Adjusts position constraints
    → Model updates automatically

User: "Generate a gear with 24 teeth, module 2"
AI: → Uses involute gear profile
    → Creates fully parametric gear
    → Adds hub and keyway features
    → Ready for 3D printing or CNC
```

## Workbench Integration

### Supported Workbenches
- **Part**: CSG solid modeling
- **PartDesign**: Feature-based parametric modeling
- **Draft**: 2D drafting and annotations
- **Sketcher**: Constraint-based 2D sketching
- **Arch**: Architectural modeling
- **FEM**: Finite Element Analysis
- **Path**: CAM and CNC operations
- **TechDraw**: Technical drawing generation

### Custom Workbench Development
```python
# Example custom workbench
class MyWorkbench(Workbench):
    def __init__(self):
        self.__class__.Icon = "path/to/icon.svg"
        self.__class__.MenuText = "My Workbench"
        self.__class__.ToolTip = "Custom workbench"
        
    def Initialize(self):
        # Add commands
        self.appendToolbar("My Tools", ["MyCommand1", "MyCommand2"])
```

## Project Templates

### Available Templates
1. **Mechanical**: Standard mechanical part with datum planes
2. **Assembly**: Multi-part assembly structure
3. **Sheet Metal**: Sheet metal specific features
4. **Architectural**: Building and construction setup

### Creating Custom Templates
```python
def create_custom_template():
    doc = FreeCAD.newDocument("CustomTemplate")
    
    # Add standard elements
    body = doc.addObject('PartDesign::Body', 'MainBody')
    
    # Add reference geometry
    doc.addObject('PartDesign::Plane', 'RefPlane1')
    doc.addObject('PartDesign::Line', 'RefAxis1')
    
    # Save as template
    doc.saveAs("template_custom.FCStd")
```

## Troubleshooting

### Common Issues

**FreeCAD Not Detected**
- Ensure FreeCAD is installed in standard location
- Add FreeCAD to system PATH
- Check executable permissions

**Script Execution Errors**
- Verify Python syntax
- Check FreeCAD API compatibility
- Ensure required workbenches are loaded

**Export Failures**
- Verify export format support
- Check file path permissions
- Ensure geometry is valid for export

**Performance Issues**
- Use FreeCADCmd for headless operations
- Simplify complex geometries
- Enable multi-threading in preferences

### Debug Mode
Enable verbose logging:
```json
{
  "debug": true,
  "logLevel": "verbose"
}
```

## Advanced Features

### FEM Analysis Integration
```python
# Simple FEM setup
import FemGui
import ObjectsFem

# Create analysis
analysis = ObjectsFem.makeAnalysis(doc, "StructuralAnalysis")

# Add material
material = ObjectsFem.makeMaterialSolid(doc, "Steel")
material.Material = {'Name': 'Steel', 'YoungsModulus': '210000 MPa'}

# Create mesh
mesh = ObjectsFem.makeMeshNetgen(doc, "Mesh")
mesh.MaxSize = 10

# Add constraints and forces
```

### Parametric Variations
```python
# Generate design variations
for thickness in [2, 3, 4, 5]:
    for hole_dia in [6, 8, 10]:
        # Modify parameters
        doc.getObject("Sketch").setDatum("thickness", thickness)
        doc.getObject("Sketch").setDatum("hole_diameter", hole_dia)
        doc.recompute()
        
        # Export variant
        export_name = f"bracket_t{thickness}_d{hole_dia}.step"
```

### OpenSCAD Integration
FreeCAD can import OpenSCAD files:
```python
import importCSG
doc = importCSG.open("model.scad")
```

## Best Practices

### Parametric Design
1. **Use Constraints**: Always fully constrain sketches
2. **Name Features**: Give meaningful names to features
3. **Design Intent**: Build models with modification in mind
4. **Reference Geometry**: Use datum planes and axes

### Performance
1. **Simplify Sketches**: Avoid overly complex sketches
2. **Use Links**: Link common parts instead of copying
3. **Disable Auto-Recompute**: For complex models
4. **Clean Topology**: Remove unnecessary edges/faces

### Collaboration
1. **Use External Files**: Link to shared components
2. **Document Parameters**: Comment important dimensions
3. **Version Control**: FreeCAD files work with Git
4. **Export Neutrally**: Use STEP for sharing

## License

This plugin is part of the W.I.T. project and follows the same MIT license terms.

## Support

For issues and feature requests:
- GitHub Issues: [W.I.T. Repository](https://github.com/yourusername/wit/issues)
- FreeCAD Forum: [forum.freecadweb.org](https://forum.freecadweb.org)
- Documentation: [Plugin Development Guide](../../docs/PLUGIN_DEVELOPMENT_GUIDE.md)