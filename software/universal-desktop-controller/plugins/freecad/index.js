/**
 * FreeCAD Plugin for W.I.T. Universal Desktop Controller
 * Open-source parametric 3D modeler with Python scripting for engineering and product design
 */

const { WITPlugin } = require('../../src/plugins/base/WITPlugin');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { promisify } = require('util');
const execAsync = promisify(exec);

class FreeCADPlugin extends WITPlugin {
    constructor(context) {
        super(context);
        
        this.freecadPath = null;
        this.freecadCmdPath = null; // Command-line version for headless operations
        this.freecadVersion = null;
        this.activeProcesses = new Map();
        this.watchedFiles = new Map();
        this.recentProjects = [];
        this.tempScripts = new Map();
        
        // Default configuration
        this.config = {
            projectsPath: path.join(os.homedir(), 'Documents', 'FreeCAD'),
            pythonScriptsPath: path.join(os.homedir(), 'Documents', 'FreeCAD', 'Scripts'),
            macrosPath: path.join(os.homedir(), 'Documents', 'FreeCAD', 'Macros'),
            autoSave: true,
            defaultWorkbench: 'PartDesign',
            exportFormats: ['step', 'iges', 'stl', 'obj', 'dxf', 'svg', 'pdf'],
            aiIntegration: {
                enabled: true
            },
            parametricEngine: {
                constraintSolver: 'SolveSpace'
            },
            templates: {
                mechanical: 'Standard mechanical part template',
                assembly: 'Assembly with constraints',
                sheet_metal: 'Sheet metal part template',
                architectural: 'Architectural design template'
            },
            ...this.config
        };
    }
    
    async initialize() {
        try {
            await super.initialize();
            
            this.log('FreeCAD plugin initializing...');
            
            // Ensure directories exist
            const directories = [
                this.expandPath(this.config.projectsPath),
                this.expandPath(this.config.pythonScriptsPath),
                this.expandPath(this.config.macrosPath)
            ];
            
            for (const dir of directories) {
                try {
                    await fs.mkdir(dir, { recursive: true });
                    this.log(`Created directory: ${dir}`);
                } catch (error) {
                    this.log(`Warning: Directory already exists or creation failed: ${dir}`, error.message);
                }
            }
            
            // Find FreeCAD installation
            await this.findFreeCADInstallation();
            
            if (this.freecadPath) {
                await this.getFreeCADVersion();
                this.log(`Found FreeCAD ${this.freecadVersion} at: ${this.freecadPath}`);
                
                // Load recent projects
                await this.loadRecentProjects();
                
                // Create initial Python scripts
                await this.createDefaultScripts();
            } else {
                this.log('Warning: FreeCAD not found on system');
            }
            
        } catch (error) {
            this.log('Error: Failed to initialize FreeCAD plugin:', error);
            throw error;
        }
    }
    
    async findFreeCADInstallation() {
        const platforms = {
            darwin: [
                '/Applications/FreeCAD.app/Contents/MacOS/FreeCAD',
                '/Applications/FreeCAD.app/Contents/Resources/bin/FreeCADCmd',
                '/Applications/FreeCAD 0.21.app/Contents/MacOS/FreeCAD',
                '/Applications/FreeCAD 0.21.app/Contents/Resources/bin/FreeCADCmd',
                '/Applications/FreeCAD 0.20.app/Contents/MacOS/FreeCAD',
                '/Applications/FreeCAD 0.20.app/Contents/Resources/bin/FreeCADCmd',
                '/Applications/FreeCAD 0.19.app/Contents/MacOS/FreeCAD',
                '/usr/local/bin/freecad',
                '/opt/homebrew/bin/freecad'
            ],
            win32: [
                'C:\\Program Files\\FreeCAD 0.21\\bin\\FreeCAD.exe',
                'C:\\Program Files\\FreeCAD 0.21\\bin\\FreeCADCmd.exe',
                'C:\\Program Files\\FreeCAD 0.20\\bin\\FreeCAD.exe',
                'C:\\Program Files\\FreeCAD 0.20\\bin\\FreeCADCmd.exe',
                'C:\\Program Files\\FreeCAD 0.19\\bin\\FreeCAD.exe',
                'C:\\Program Files (x86)\\FreeCAD\\bin\\FreeCAD.exe',
                '%LOCALAPPDATA%\\Programs\\FreeCAD\\bin\\FreeCAD.exe'
            ],
            linux: [
                '/usr/bin/freecad',
                '/usr/bin/FreeCAD',
                '/usr/bin/freecadcmd',
                '/usr/bin/FreeCADCmd',
                '/usr/local/bin/freecad',
                '/snap/bin/freecad',
                '/opt/freecad/bin/FreeCAD'
            ]
        };
        
        const platformPaths = platforms[process.platform] || [];
        
        for (let freecadPath of platformPaths) {
            // Expand environment variables
            if (freecadPath.includes('%')) {
                freecadPath = freecadPath.replace(/%([^%]+)%/g, (_, varName) => {
                    return process.env[varName] || '';
                });
            }
            
            try {
                await fs.access(freecadPath, fs.constants.F_OK | fs.constants.X_OK);
                
                // Check if this is the GUI or command-line version
                if (freecadPath.toLowerCase().includes('cmd')) {
                    this.freecadCmdPath = freecadPath;
                } else {
                    this.freecadPath = freecadPath;
                }
                
                // Try to find the corresponding version
                if (this.freecadPath && !this.freecadCmdPath) {
                    const cmdPath = this.freecadPath.replace('FreeCAD', 'FreeCADCmd');
                    try {
                        await fs.access(cmdPath, fs.constants.F_OK | fs.constants.X_OK);
                        this.freecadCmdPath = cmdPath;
                    } catch (error) {
                        // Command-line version not found, that's okay
                    }
                }
                
                if (this.freecadPath) {
                    return this.freecadPath;
                }
            } catch (error) {
                // Continue to next path
            }
        }
        
        // Try to find in PATH
        try {
            const { stdout } = await execAsync(process.platform === 'win32' ? 'where freecad' : 'which freecad');
            this.freecadPath = stdout.trim().split('\n')[0];
            return this.freecadPath;
        } catch (error) {
            this.log('Warning: FreeCAD not found in PATH');
        }
        
        return null;
    }
    
    async getFreeCADVersion() {
        if (!this.freecadPath) return null;
        
        try {
            // FreeCAD version can be tricky to get, try different methods
            const script = `
import FreeCAD
print(FreeCAD.Version()[0] + "." + FreeCAD.Version()[1])
`;
            const result = await this.executeScript({ script, headless: true });
            if (result.success && result.output) {
                const versionMatch = result.output.match(/(\d+\.\d+)/);
                this.freecadVersion = versionMatch ? versionMatch[1] : 'unknown';
            } else {
                // Fallback: try to get version from executable name
                const versionMatch = this.freecadPath.match(/(\d+\.\d+)/);
                this.freecadVersion = versionMatch ? versionMatch[1] : 'unknown';
            }
            return this.freecadVersion;
        } catch (error) {
            this.log('Warning: Could not get FreeCAD version:', error.message);
            return null;
        }
    }
    
    async createDefaultScripts() {
        const scriptsDir = this.expandPath(this.config.pythonScriptsPath);
        
        // AI helper script for parametric modeling
        const aiHelperScript = `import FreeCAD
import FreeCADGui
import Part
import Sketcher
import Draft
import json
import os
import sys

class WITFreeCADAI:
    @staticmethod
    def create_parametric_box(length=10, width=10, height=10, name="ParametricBox"):
        """Create a parametric box with dimensions"""
        doc = FreeCAD.newDocument() if not FreeCAD.ActiveDocument else FreeCAD.ActiveDocument
        
        # Create body
        body = doc.addObject('PartDesign::Body', name)
        
        # Create sketch
        sketch = doc.addObject('Sketcher::SketchObject', 'Sketch')
        body.addObject(sketch)
        sketch.Support = (doc.getObject("XY_Plane"), [""])
        sketch.MapMode = "FlatFace"
        
        # Add rectangle
        sketch.addGeometry(Part.LineSegment(FreeCAD.Vector(0, 0, 0), FreeCAD.Vector(length, 0, 0)), False)
        sketch.addGeometry(Part.LineSegment(FreeCAD.Vector(length, 0, 0), FreeCAD.Vector(length, width, 0)), False)
        sketch.addGeometry(Part.LineSegment(FreeCAD.Vector(length, width, 0), FreeCAD.Vector(0, width, 0)), False)
        sketch.addGeometry(Part.LineSegment(FreeCAD.Vector(0, width, 0), FreeCAD.Vector(0, 0, 0)), False)
        
        # Add constraints
        sketch.addConstraint(Sketcher.Constraint('Coincident', 0, 2, 1, 1))
        sketch.addConstraint(Sketcher.Constraint('Coincident', 1, 2, 2, 1))
        sketch.addConstraint(Sketcher.Constraint('Coincident', 2, 2, 3, 1))
        sketch.addConstraint(Sketcher.Constraint('Coincident', 3, 2, 0, 1))
        sketch.addConstraint(Sketcher.Constraint('Horizontal', 0))
        sketch.addConstraint(Sketcher.Constraint('Horizontal', 2))
        sketch.addConstraint(Sketcher.Constraint('Vertical', 1))
        sketch.addConstraint(Sketcher.Constraint('Vertical', 3))
        
        # Create pad
        pad = doc.addObject("PartDesign::Pad", "Pad")
        body.addObject(pad)
        pad.Profile = sketch
        pad.Length = height
        
        doc.recompute()
        return body.Name
    
    @staticmethod
    def create_cylinder(radius=5, height=10, name="Cylinder"):
        """Create a cylinder"""
        doc = FreeCAD.ActiveDocument or FreeCAD.newDocument()
        cyl = doc.addObject("Part::Cylinder", name)
        cyl.Radius = radius
        cyl.Height = height
        doc.recompute()
        return cyl.Name
    
    @staticmethod
    def create_gear(teeth=20, module=1.0, pressure_angle=20, name="Gear"):
        """Create a gear using involute profile"""
        doc = FreeCAD.ActiveDocument or FreeCAD.newDocument()
        
        # This is a simplified gear - in practice you'd use the Gear workbench
        outer_radius = module * teeth / 2
        inner_radius = outer_radius * 0.8
        
        # Create base cylinder
        gear = doc.addObject("Part::Cylinder", name)
        gear.Radius = outer_radius
        gear.Height = module * 2.5
        
        doc.recompute()
        return gear.Name
    
    @staticmethod
    def apply_material(obj_name, material_name="Steel"):
        """Apply material properties to an object"""
        doc = FreeCAD.ActiveDocument
        if not doc:
            return False
            
        obj = doc.getObject(obj_name)
        if not obj:
            return False
            
        # In FreeCAD, materials are more complex than simple assignment
        # This is a placeholder for material assignment
        if hasattr(obj, 'ViewObject'):
            obj.ViewObject.ShapeColor = (0.7, 0.7, 0.8)  # Steel-like color
            
        return True
    
    @staticmethod
    def create_assembly(parts, name="Assembly"):
        """Create an assembly from parts"""
        doc = FreeCAD.ActiveDocument or FreeCAD.newDocument()
        
        # Create assembly container (simplified - real assembly uses Assembly4 or A2plus)
        assembly = doc.addObject("App::DocumentObjectGroup", name)
        
        for part_name in parts:
            part = doc.getObject(part_name)
            if part:
                assembly.addObject(part)
                
        doc.recompute()
        return assembly.Name
    
    @staticmethod
    def export_model(obj_name, filepath, format="step"):
        """Export object to various formats"""
        doc = FreeCAD.ActiveDocument
        if not doc:
            return False
            
        obj = doc.getObject(obj_name)
        if not obj:
            return False
            
        import importers
        
        if format.lower() == "step":
            import Import
            Import.export([obj], filepath)
        elif format.lower() == "stl":
            import Mesh
            Mesh.export([obj], filepath)
        elif format.lower() == "iges":
            import Import
            Import.export([obj], filepath)
            
        return True
    
    @staticmethod
    def get_document_info():
        """Get information about current document"""
        doc = FreeCAD.ActiveDocument
        if not doc:
            return {"error": "No active document"}
            
        info = {
            "name": doc.Name,
            "objects": [],
            "materials": [],
            "assemblies": []
        }
        
        for obj in doc.Objects:
            obj_data = {
                "name": obj.Name,
                "type": obj.TypeId,
                "label": obj.Label
            }
            
            if hasattr(obj, 'Shape'):
                try:
                    obj_data["volume"] = obj.Shape.Volume
                    obj_data["area"] = obj.Shape.Area
                    bbox = obj.Shape.BoundBox
                    obj_data["boundingBox"] = {
                        "length": bbox.XLength,
                        "width": bbox.YLength,
                        "height": bbox.ZLength
                    }
                except:
                    pass
                    
            info["objects"].append(obj_data)
            
        return info
    
    @staticmethod
    def perform_fea_simple(obj_name, force_value=1000, fixed_face_index=0):
        """Perform simple FEA analysis (requires FEM workbench)"""
        doc = FreeCAD.ActiveDocument
        if not doc:
            return {"error": "No active document"}
            
        try:
            import FemGui
            import ObjectsFem
            
            # Create analysis container
            analysis = ObjectsFem.makeAnalysis(doc, "Analysis")
            
            # Add object to analysis
            obj = doc.getObject(obj_name)
            if not obj:
                return {"error": "Object not found"}
                
            # This is a simplified FEA setup
            # Real FEA requires mesh generation, material assignment, constraints, etc.
            
            return {"status": "FEA setup created", "analysis": analysis.Name}
            
        except ImportError:
            return {"error": "FEM workbench not available"}

# Make functions available globally
for attr_name in dir(WITFreeCADAI):
    if not attr_name.startswith('_'):
        globals()[attr_name] = getattr(WITFreeCADAI, attr_name)
`;
        
        try {
            await fs.writeFile(path.join(scriptsDir, 'wit_ai_helper.py'), aiHelperScript);
            this.log('Created AI helper script');
        } catch (error) {
            this.log('Error: Failed to create AI helper script:', error);
        }
        
        // Template generator script
        const templateScript = `import FreeCAD
import FreeCADGui
import Part
import PartDesign
import Sketcher

def create_project_template(template_type):
    """Create project from template"""
    doc = FreeCAD.newDocument(template_type + "_project")
    
    if template_type == 'mechanical':
        # Mechanical part template with standard views
        body = doc.addObject('PartDesign::Body', 'Body')
        
        # Create base sketch
        sketch = doc.addObject('Sketcher::SketchObject', 'BaseSketch')
        body.addObject(sketch)
        
        # Add construction geometry
        sketch.addGeometry(Part.LineSegment(FreeCAD.Vector(-50, -50, 0), FreeCAD.Vector(50, -50, 0)), True)
        sketch.addGeometry(Part.LineSegment(FreeCAD.Vector(0, -100, 0), FreeCAD.Vector(0, 100, 0)), True)
        
    elif template_type == 'assembly':
        # Assembly template
        doc.addObject("App::DocumentObjectGroup", "Assembly")
        doc.addObject("App::DocumentObjectGroup", "Parts")
        doc.addObject("App::DocumentObjectGroup", "Hardware")
        
    elif template_type == 'sheet_metal':
        # Sheet metal template
        import SheetMetal
        body = doc.addObject('PartDesign::Body', 'SheetMetalBody')
        
    elif template_type == 'architectural':
        # Architectural template
        import Arch
        site = Arch.makeSite()
        building = Arch.makeBuilding()
        site.addObject(building)
        
    doc.recompute()
    return doc.Name

def setup_standard_views():
    """Setup standard orthographic views"""
    if FreeCADGui.ActiveDocument:
        FreeCADGui.ActiveDocument.ActiveView.viewIsometric()
        # Could add more view setups here

def create_drawing_sheet(doc_name):
    """Create technical drawing sheet"""
    doc = FreeCAD.getDocument(doc_name)
    if not doc:
        return None
        
    # This would use TechDraw workbench in real implementation
    sheet = doc.addObject('TechDraw::DrawPage', 'Sheet')
    template = doc.addObject('TechDraw::DrawSVGTemplate', 'Template')
    sheet.Template = template
    
    return sheet.Name
`;
        
        try {
            await fs.writeFile(path.join(scriptsDir, 'wit_templates.py'), templateScript);
            this.log('Created template script');
        } catch (error) {
            this.log('Error: Failed to create template script:', error);
        }
    }
    
    async start() {
        await super.start();
        this.log('FreeCAD plugin started');
        
        // Emit status update for frontend
        this.emit('plugin_status_update', {
            pluginId: this.id,
            status: 'active'
        });
    }
    
    async stop() {
        await super.stop();
        
        // Cleanup active processes
        for (const [id, process] of this.activeProcesses.entries()) {
            try {
                process.kill();
            } catch (error) {
                this.log(`Warning: Failed to kill process ${id}:`, error.message);
            }
        }
        this.activeProcesses.clear();
        
        // Cleanup temp scripts
        for (const [id, scriptPath] of this.tempScripts.entries()) {
            try {
                await fs.unlink(scriptPath);
            } catch (error) {
                this.log(`Warning: Failed to cleanup temp script ${scriptPath}:`, error.message);
            }
        }
        this.tempScripts.clear();
        
        this.log('FreeCAD plugin stopped');
    }
    
    async onMessage(message) {
        const { command, payload } = message;
        
        try {
            switch (command) {
                case 'launch':
                    return await this.launchFreeCAD(payload);
                    
                case 'openFile':
                    return await this.openFile(payload);
                    
                case 'newFile':
                    return await this.newFile(payload);
                    
                case 'executeScript':
                    return await this.executeScript(payload);
                    
                case 'executeCommand':
                    return await this.executeCommand(payload);
                    
                case 'getStatus':
                    return this.getStatus();
                    
                case 'listProjects':
                    return await this.listProjects(payload);
                    
                case 'listObjects':
                    return await this.listObjects(payload);
                    
                case 'createPrimitive':
                    return await this.createPrimitive(payload);
                    
                case 'createSketch':
                    return await this.createSketch(payload);
                    
                case 'createFeature':
                    return await this.createFeature(payload);
                    
                case 'modifyObject':
                    return await this.modifyObject(payload);
                    
                case 'exportModel':
                    return await this.exportModel(payload);
                    
                case 'getDocumentInfo':
                    return await this.getDocumentInfo(payload);
                    
                case 'saveDocument':
                    return await this.saveDocument(payload);
                    
                default:
                    throw new Error(`Unknown command: ${command}`);
            }
        } catch (error) {
            this.log(`Error: Command '${command}' failed:`, error);
            throw error;
        }
    }
    
    async launchFreeCAD(options = {}) {
        if (!this.freecadPath) {
            return {
                success: false,
                message: 'FreeCAD is not installed. Please install FreeCAD first.'
            };
        }
        
        this.log('Launching FreeCAD with options:', options);
        
        const args = [];
        
        // Add file to open if provided
        if (options.filePath) {
            args.push(options.filePath);
        }
        
        // Add console mode if requested
        if (options.console) {
            args.push('--console');
        }
        
        // Add custom arguments
        if (options.args) {
            args.push(...options.args);
        }
        
        try {
            const freecadProcess = spawn(this.freecadPath, args, {
                detached: true,
                stdio: 'ignore'
            });
            
            freecadProcess.unref();
            
            const processId = `freecad_${Date.now()}`;
            this.activeProcesses.set(processId, freecadProcess);
            
            // Monitor process
            freecadProcess.on('exit', (code) => {
                this.log(`FreeCAD process ${processId} exited with code:`, code);
                this.activeProcesses.delete(processId);
            });
            
            return {
                success: true,
                processId,
                pid: freecadProcess.pid
            };
        } catch (error) {
            this.log('Error: Failed to launch FreeCAD:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    async executeScript(payload) {
        const { script, filePath, headless = false } = payload;
        
        // Create temporary script file
        const tempDir = path.join(os.tmpdir(), 'wit_freecad');
        await fs.mkdir(tempDir, { recursive: true });
        
        const tempScriptPath = path.join(tempDir, `script_${Date.now()}.py`);
        
        // Wrap script with proper imports
        const wrappedScript = `
import sys
sys.path.append("${this.expandPath(this.config.pythonScriptsPath)}")

${script}
`;
        
        await fs.writeFile(tempScriptPath, wrappedScript);
        
        const scriptId = `script_${Date.now()}`;
        this.tempScripts.set(scriptId, tempScriptPath);
        
        try {
            let execPath = headless && this.freecadCmdPath ? this.freecadCmdPath : this.freecadPath;
            if (!execPath) {
                throw new Error('FreeCAD is not installed');
            }
            
            const args = [];
            
            if (filePath) {
                args.push(filePath);
            }
            
            args.push('--run', tempScriptPath);
            
            if (headless) {
                args.push('-c');  // Console mode
            }
            
            const { stdout, stderr } = await execAsync(`"${execPath}" ${args.join(' ')}`);
            
            // Cleanup temp script
            setTimeout(async () => {
                try {
                    await fs.unlink(tempScriptPath);
                    this.tempScripts.delete(scriptId);
                } catch (error) {
                    this.log('Warning: Failed to cleanup temp script:', error);
                }
            }, 1000);
            
            return {
                success: true,
                output: stdout,
                errors: stderr || null
            };
        } catch (error) {
            this.log('Error: Script execution failed:', error);
            return {
                success: false,
                message: error.message,
                output: error.stdout || null,
                errors: error.stderr || null
            };
        }
    }
    
    async createPrimitive(payload) {
        const { type, dimensions = {}, name } = payload;
        
        let script = `
import sys
sys.path.append("${this.expandPath(this.config.pythonScriptsPath)}")
from wit_ai_helper import create_parametric_box, create_cylinder, create_gear

`;
        
        switch (type) {
            case 'box':
                const { length = 10, width = 10, height = 10 } = dimensions;
                script += `result = create_parametric_box(${length}, ${width}, ${height}, "${name || 'Box'}")`;
                break;
                
            case 'cylinder':
                const { radius = 5, cylHeight = 10 } = dimensions;
                script += `result = create_cylinder(${radius}, ${cylHeight}, "${name || 'Cylinder'}")`;
                break;
                
            case 'gear':
                const { teeth = 20, module = 1.0 } = dimensions;
                script += `result = create_gear(${teeth}, ${module}, name="${name || 'Gear'}")`;
                break;
                
            default:
                throw new Error(`Unknown primitive type: ${type}`);
        }
        
        script += `
print(f"RESULT: {result}")
`;
        
        const result = await this.executeScript({ script });
        
        if (result.success) {
            const match = result.output.match(/RESULT: (.+)/);
            return {
                success: true,
                objectName: match ? match[1] : 'Unknown'
            };
        }
        
        return result;
    }
    
    async exportModel(payload) {
        const { objectName, filePath, format = 'step' } = payload;
        
        const script = `
import sys
sys.path.append("${this.expandPath(this.config.pythonScriptsPath)}")
from wit_ai_helper import export_model

result = export_model("${objectName}", "${filePath}", "${format}")
print(f"EXPORT_RESULT: {result}")
`;
        
        const result = await this.executeScript({ script });
        
        if (result.success && result.output.includes('EXPORT_RESULT: True')) {
            return {
                success: true,
                filePath,
                message: `Exported to ${format.toUpperCase()} format`
            };
        }
        
        return {
            success: false,
            message: 'Export failed',
            output: result.output,
            errors: result.errors
        };
    }
    
    async getDocumentInfo(payload = {}) {
        const { filePath } = payload;
        
        const script = `
import sys
import json
sys.path.append("${this.expandPath(this.config.pythonScriptsPath)}")
from wit_ai_helper import get_document_info

info = get_document_info()
print("DOCUMENT_INFO:" + json.dumps(info))
`;
        
        const result = await this.executeScript({ script, filePath });
        
        if (result.success) {
            const match = result.output.match(/DOCUMENT_INFO:(.+)/);
            if (match) {
                try {
                    const docInfo = JSON.parse(match[1]);
                    return {
                        success: true,
                        documentInfo: docInfo
                    };
                } catch (error) {
                    this.log('Error: Failed to parse document info:', error);
                }
            }
        }
        
        return {
            success: false,
            message: 'Failed to get document information'
        };
    }
    
    async listProjects() {
        const projectsPath = this.expandPath(this.config.projectsPath);
        
        try {
            const files = await fs.readdir(projectsPath);
            const projects = [];
            
            for (const file of files) {
                if (file.endsWith('.FCStd') || file.endsWith('.fcstd')) {
                    const filePath = path.join(projectsPath, file);
                    try {
                        const stats = await fs.stat(filePath);
                        projects.push({
                            name: path.basename(file, path.extname(file)),
                            path: filePath,
                            relativePath: file,
                            size: stats.size,
                            modified: stats.mtime.toISOString(),
                            created: stats.birthtime.toISOString()
                        });
                    } catch (error) {
                        this.log(`Warning: Failed to get stats for ${file}:`, error);
                    }
                }
            }
            
            // Sort by modification time, newest first
            projects.sort((a, b) => new Date(b.modified) - new Date(a.modified));
            
            return projects;
        } catch (error) {
            this.log('Error: Failed to list projects:', error);
            return [];
        }
    }
    
    getStatus() {
        try {
            const baseStatus = super.getStatus();
            return {
                ...baseStatus,
                installed: !!this.freecadPath,
                path: this.freecadPath || null,
                cmdPath: this.freecadCmdPath || null,
                version: this.freecadVersion || 'unknown',
                projectsPath: this.config.projectsPath,
                activeProcesses: this.activeProcesses.size,
                watchedFiles: this.watchedFiles.size,
                recentProjects: this.recentProjects.slice(0, 5),
                supportedFormats: this.config.exportFormats || [],
                aiEnabled: this.config.aiIntegration?.enabled || false,
                defaultWorkbench: this.config.defaultWorkbench,
                pythonScriptsPath: this.config.pythonScriptsPath
            };
        } catch (error) {
            this.log('Error: Error getting status:', error);
            return {
                initialized: false,
                started: false,
                error: error.message
            };
        }
    }
    
    // Additional methods for other commands
    async openFile(payload) {
        const { filePath } = payload;
        return await this.launchFreeCAD({ filePath });
    }
    
    async newFile(payload) {
        const { template = 'mechanical', name } = payload;
        const projectsPath = this.expandPath(this.config.projectsPath);
        const fileName = name ? `${name}.FCStd` : `project_${Date.now()}.FCStd`;
        const filePath = path.join(projectsPath, fileName);
        
        const script = `
import sys
sys.path.append("${this.expandPath(this.config.pythonScriptsPath)}")
from wit_templates import create_project_template

doc_name = create_project_template("${template}")
FreeCAD.getDocument(doc_name).saveAs("${filePath}")
print(f"PROJECT_CREATED: {doc_name}")
`;
        
        const result = await this.executeScript({ script });
        
        if (result.success && result.output.includes('PROJECT_CREATED')) {
            return await this.launchFreeCAD({ filePath });
        }
        
        return {
            success: false,
            message: 'Failed to create project from template'
        };
    }
    
    // Placeholder methods for remaining commands
    async executeCommand(payload) { return { success: false, message: 'Execute command not yet implemented' }; }
    async listObjects(payload) { return { success: false, message: 'List objects not yet implemented' }; }
    async createSketch(payload) { return { success: false, message: 'Create sketch not yet implemented' }; }
    async createFeature(payload) { return { success: false, message: 'Create feature not yet implemented' }; }
    async modifyObject(payload) { return { success: false, message: 'Modify object not yet implemented' }; }
    async saveDocument(payload) { return { success: false, message: 'Save document not yet implemented' }; }
    
    expandPath(filePath) {
        if (filePath.startsWith('~')) {
            return path.join(os.homedir(), filePath.slice(1));
        }
        return filePath;
    }
    
    async loadRecentProjects() {
        try {
            const projects = await this.listProjects();
            this.recentProjects = projects.slice(0, 10);
        } catch (error) {
            this.log('Warning: Failed to load recent projects:', error);
        }
    }
}

module.exports = FreeCADPlugin;