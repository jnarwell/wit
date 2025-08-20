/**
 * Blender Plugin for W.I.T. Universal Desktop Controller
 * AI-powered 3D modeling, animation, and rendering with Blender's Python API
 */

const { WITPlugin } = require('../../src/plugins/base/WITPlugin');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { promisify } = require('util');
const execAsync = promisify(exec);

class BlenderPlugin extends WITPlugin {
    constructor(context) {
        super(context);
        
        this.blenderPath = null;
        this.blenderVersion = null;
        this.activeProcesses = new Map();
        this.watchedFiles = new Map();
        this.recentProjects = [];
        this.tempScripts = new Map();
        
        // Default configuration
        this.config = {
            projectsPath: path.join(os.homedir(), 'Documents', 'Blender'),
            pythonScriptsPath: path.join(os.homedir(), 'Documents', 'Blender', 'Scripts'),
            addonsPath: path.join(os.homedir(), 'Documents', 'Blender', 'Addons'),
            autoSave: true,
            renderEngine: 'CYCLES',
            renderSamples: 128,
            exportFormats: ['obj', 'fbx', 'gltf', 'dae', 'ply', 'stl', 'x3d'],
            aiIntegration: {
                enabled: true
            },
            renderPresets: {
                preview: { samples: 32, resolution: [640, 480] },
                medium: { samples: 128, resolution: [1920, 1080] },
                high: { samples: 256, resolution: [3840, 2160] }
            },
            ...this.config
        };
    }
    
    async initialize() {
        try {
            await super.initialize();
            
            this.log('Blender plugin initializing...');
            
            // Ensure directories exist
            const directories = [
                this.expandPath(this.config.projectsPath),
                this.expandPath(this.config.pythonScriptsPath),
                this.expandPath(this.config.addonsPath)
            ];
            
            for (const dir of directories) {
                try {
                    await fs.mkdir(dir, { recursive: true });
                    this.log(`Created directory: ${dir}`);
                } catch (error) {
                    this.warn(`Directory already exists or creation failed: ${dir}`, error.message);
                }
            }
            
            // Find Blender installation
            await this.findBlenderInstallation();
            
            if (this.blenderPath) {
                await this.getBlenderVersion();
                this.log(`Found Blender ${this.blenderVersion} at: ${this.blenderPath}`);
                
                // Load recent projects
                await this.loadRecentProjects();
                
                // Create initial Python scripts
                await this.createDefaultScripts();
            } else {
                this.warn('Blender not found on system');
            }
            
        } catch (error) {
            this.error('Failed to initialize Blender plugin:', error);
            throw error;
        }
    }
    
    async findBlenderInstallation() {
        const platforms = {
            darwin: [
                '/Applications/Blender.app/Contents/MacOS/Blender',
                '/Applications/Blender 4.2.app/Contents/MacOS/Blender',
                '/Applications/Blender 4.1.app/Contents/MacOS/Blender',
                '/Applications/Blender 4.0.app/Contents/MacOS/Blender',
                '/Applications/Blender 3.6.app/Contents/MacOS/Blender',
                '/Applications/Blender 3.5.app/Contents/MacOS/Blender',
                '/Applications/Blender 3.4.app/Contents/MacOS/Blender',
                '/Applications/Blender 3.3.app/Contents/MacOS/Blender',
                '/usr/local/bin/blender',
                '/opt/homebrew/bin/blender'
            ],
            win32: [
                'C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe',
                'C:\\Program Files\\Blender Foundation\\Blender 4.1\\blender.exe',
                'C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe',
                'C:\\Program Files\\Blender Foundation\\Blender 3.6\\blender.exe',
                'C:\\Program Files\\Blender Foundation\\Blender 3.5\\blender.exe',
                'C:\\Program Files\\Blender Foundation\\Blender 3.4\\blender.exe',
                'C:\\Program Files\\Blender Foundation\\Blender 3.3\\blender.exe',
                '%LOCALAPPDATA%\\Programs\\Blender Foundation\\Blender\\blender.exe'
            ],
            linux: [
                '/usr/bin/blender',
                '/usr/local/bin/blender',
                '/snap/bin/blender',
                '/opt/blender/blender',
                '/opt/blender-3.6/blender',
                '/opt/blender-3.5/blender',
                '/opt/blender-3.4/blender'
            ]
        };
        
        const platformPaths = platforms[process.platform] || [];
        
        for (let blenderPath of platformPaths) {
            // Expand environment variables
            if (blenderPath.includes('%')) {
                blenderPath = blenderPath.replace(/%([^%]+)%/g, (_, varName) => {
                    return process.env[varName] || '';
                });
            }
            
            try {
                await fs.access(blenderPath, fs.constants.F_OK | fs.constants.X_OK);
                this.blenderPath = blenderPath;
                return blenderPath;
            } catch (error) {
                // Continue to next path
            }
        }
        
        // Try to find in PATH
        try {
            const { stdout } = await execAsync(process.platform === 'win32' ? 'where blender' : 'which blender');
            this.blenderPath = stdout.trim().split('\n')[0];
            return this.blenderPath;
        } catch (error) {
            this.warn('Blender not found in PATH');
        }
        
        return null;
    }
    
    async getBlenderVersion() {
        if (!this.blenderPath) return null;
        
        try {
            const { stdout } = await execAsync(`"${this.blenderPath}" --version`);
            const versionMatch = stdout.match(/Blender\\s+(\\d+\\.\\d+(?:\\.\\d+)?)/i);
            this.blenderVersion = versionMatch ? versionMatch[1] : 'unknown';
            return this.blenderVersion;
        } catch (error) {
            this.warn('Could not get Blender version:', error.message);
            return null;
        }
    }
    
    async createDefaultScripts() {
        const scriptsDir = this.expandPath(this.config.pythonScriptsPath);
        
        // AI helper script
        const aiHelperScript = `import bpy
import bmesh
import mathutils
import json
import sys
import os

class WITBlenderAI:
    @staticmethod
    def create_primitive(obj_type, location=(0, 0, 0), rotation=(0, 0, 0), scale=(1, 1, 1)):
        """Create basic primitive objects"""
        bpy.ops.mesh.primitive_cube_add(location=location)
        if obj_type == 'cube':
            pass  # Already created
        elif obj_type == 'sphere':
            bpy.ops.mesh.primitive_uv_sphere_add(location=location)
        elif obj_type == 'cylinder':
            bpy.ops.mesh.primitive_cylinder_add(location=location)
        elif obj_type == 'plane':
            bpy.ops.mesh.primitive_plane_add(location=location)
        elif obj_type == 'cone':
            bpy.ops.mesh.primitive_cone_add(location=location)
        elif obj_type == 'torus':
            bpy.ops.mesh.primitive_torus_add(location=location)
        
        obj = bpy.context.active_object
        obj.rotation_euler = rotation
        obj.scale = scale
        return obj.name
    
    @staticmethod
    def create_material(name, color=(0.8, 0.8, 0.8, 1.0), metallic=0.0, roughness=0.5):
        """Create PBR material"""
        material = bpy.data.materials.new(name=name)
        material.use_nodes = True
        
        # Clear existing nodes
        material.node_tree.nodes.clear()
        
        # Add principled BSDF
        bsdf = material.node_tree.nodes.new(type='ShaderNodeBsdfPrincipled')
        bsdf.inputs['Base Color'].default_value = color
        bsdf.inputs['Metallic'].default_value = metallic
        bsdf.inputs['Roughness'].default_value = roughness
        
        # Add output
        output = material.node_tree.nodes.new(type='ShaderNodeOutputMaterial')
        material.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
        
        return material.name
    
    @staticmethod
    def apply_material(obj_name, material_name):
        """Apply material to object"""
        obj = bpy.data.objects.get(obj_name)
        material = bpy.data.materials.get(material_name)
        
        if obj and material:
            if obj.data.materials:
                obj.data.materials[0] = material
            else:
                obj.data.materials.append(material)
            return True
        return False
    
    @staticmethod
    def get_scene_info():
        """Get current scene information"""
        scene_info = {
            'objects': [],
            'materials': [],
            'cameras': [],
            'lights': []
        }
        
        for obj in bpy.data.objects:
            obj_data = {
                'name': obj.name,
                'type': obj.type,
                'location': list(obj.location),
                'rotation': list(obj.rotation_euler),
                'scale': list(obj.scale)
            }
            
            if obj.type == 'MESH':
                scene_info['objects'].append(obj_data)
            elif obj.type == 'CAMERA':
                scene_info['cameras'].append(obj_data)
            elif obj.type == 'LIGHT':
                scene_info['lights'].append(obj_data)
        
        for material in bpy.data.materials:
            scene_info['materials'].append(material.name)
        
        return scene_info
    
    @staticmethod
    def setup_render(engine='CYCLES', samples=128, resolution=(1920, 1080)):
        """Setup render settings"""
        scene = bpy.context.scene
        scene.render.engine = engine
        
        if engine == 'CYCLES':
            scene.cycles.samples = samples
        
        scene.render.resolution_x = resolution[0]
        scene.render.resolution_y = resolution[1]
        
        return True
    
    @staticmethod
    def render_image(filepath):
        """Render current scene"""
        bpy.context.scene.render.filepath = filepath
        bpy.ops.render.render(write_still=True)
        return True

# Make functions available globally
for attr_name in dir(WITBlenderAI):
    if not attr_name.startswith('_'):
        globals()[attr_name] = getattr(WITBlenderAI, attr_name)
`;
        
        try {
            await fs.writeFile(path.join(scriptsDir, 'wit_ai_helper.py'), aiHelperScript);
            this.log('Created AI helper script');
        } catch (error) {
            this.error('Failed to create AI helper script:', error);
        }
        
        // Template generator script
        const templateScript = `import bpy
import os

def create_project_template(template_type):
    # Clear existing mesh objects
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    
    if template_type == 'basic':
        # Basic scene with cube
        bpy.ops.mesh.primitive_cube_add()
        
    elif template_type == 'product_viz':
        # Product visualization setup
        bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
        
        # Add camera
        bpy.ops.object.camera_add(location=(7, -7, 5))
        
        # Add lights
        bpy.ops.object.light_add(type='SUN', location=(5, 5, 10))
        
    elif template_type == 'character':
        # Character modeling template
        bpy.ops.mesh.primitive_cube_add(location=(0, 0, 1))  # Body
        bpy.ops.mesh.primitive_uv_sphere_add(location=(0, 0, 2))  # Head
        
    elif template_type == 'architectural':
        # Architectural template
        bpy.ops.mesh.primitive_plane_add(scale=(10, 10, 1))  # Floor
        bpy.ops.mesh.primitive_cube_add(location=(0, 0, 1.5), scale=(2, 2, 1.5))  # Building
        
    return "Template created successfully"

def setup_lighting(style='studio'):
    # Remove existing lights
    for obj in bpy.data.objects:
        if obj.type == 'LIGHT':
            bpy.data.objects.remove(obj)
    
    if style == 'studio':
        # 3-point lighting setup
        bpy.ops.object.light_add(type='SUN', location=(5, 5, 10), rotation=(0.4, 0, 0.8))
        bpy.ops.object.light_add(type='AREA', location=(-3, 3, 5), rotation=(0.4, 0, -0.8))
        bpy.ops.object.light_add(type='SPOT', location=(0, -5, 2), rotation=(1.2, 0, 0))
        
    elif style == 'natural':
        # Natural lighting
        bpy.ops.object.light_add(type='SUN', location=(10, 10, 20))
        
    elif style == 'dramatic':
        # Dramatic single light
        bpy.ops.object.light_add(type='SPOT', location=(5, 0, 10), rotation=(0.6, 0, 1.57))
        
    return f"{style} lighting setup complete"
`;
        
        try {
            await fs.writeFile(path.join(scriptsDir, 'wit_templates.py'), templateScript);
            this.log('Created template script');
        } catch (error) {
            this.error('Failed to create template script:', error);
        }
    }
    
    async start() {
        await super.start();
        this.log('Blender plugin started');
        
        // Emit status update for frontend
        this.eventBus.emit('plugin_status_update', {
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
                this.warn(`Failed to kill process ${id}:`, error.message);
            }
        }
        this.activeProcesses.clear();
        
        // Cleanup temp scripts
        for (const [id, scriptPath] of this.tempScripts.entries()) {
            try {
                await fs.unlink(scriptPath);
            } catch (error) {
                this.warn(`Failed to cleanup temp script ${scriptPath}:`, error.message);
            }
        }
        this.tempScripts.clear();
        
        this.log('Blender plugin stopped');
    }
    
    async onMessage(message) {
        const { command, payload } = message;
        
        try {
            switch (command) {
                case 'launch':
                    return await this.launchBlender(payload);
                    
                case 'openFile':
                    return await this.openFile(payload);
                    
                case 'newFile':
                    return await this.newFile(payload);
                    
                case 'executeScript':
                    return await this.executeScript(payload);
                    
                case 'render':
                    return await this.render(payload);
                    
                case 'export':
                    return await this.export(payload);
                    
                case 'import':
                    return await this.import(payload);
                    
                case 'getStatus':
                    return this.getStatus();
                    
                case 'listProjects':
                    return await this.listProjects(payload);
                    
                case 'listObjects':
                    return await this.listObjects(payload);
                    
                case 'createObject':
                    return await this.createObject(payload);
                    
                case 'modifyObject':
                    return await this.modifyObject(payload);
                    
                case 'deleteObject':
                    return await this.deleteObject(payload);
                    
                case 'setMaterial':
                    return await this.setMaterial(payload);
                    
                case 'generateMesh':
                    return await this.generateMesh(payload);
                    
                case 'setupLighting':
                    return await this.setupLighting(payload);
                    
                case 'getSceneInfo':
                    return await this.getSceneInfo(payload);
                    
                case 'saveProject':
                    return await this.saveProject(payload);
                    
                default:
                    throw new Error(`Unknown command: ${command}`);
            }
        } catch (error) {
            this.error(`Command '${command}' failed:`, error);
            throw error;
        }
    }
    
    async launchBlender(options = {}) {
        if (!this.blenderPath) {
            return {
                success: false,
                message: 'Blender is not installed. Please install Blender first.'
            };
        }
        
        this.log('Launching Blender with options:', options);
        
        const args = [];
        
        // Add file to open if provided
        if (options.filePath) {
            args.push(options.filePath);
        }
        
        // Add background mode if requested
        if (options.background) {
            args.push('--background');
        }
        
        // Add Python script if provided
        if (options.script) {
            args.push('--python-expr', options.script);
        }
        
        // Add custom arguments
        if (options.args) {
            args.push(...options.args);
        }
        
        try {
            const blenderProcess = spawn(this.blenderPath, args, {
                detached: !options.background,
                stdio: options.background ? 'pipe' : 'ignore'
            });
            
            if (!options.background) {
                blenderProcess.unref();
            }
            
            const processId = `blender_${Date.now()}`;
            this.activeProcesses.set(processId, blenderProcess);
            
            // Monitor process
            blenderProcess.on('exit', (code) => {
                this.log(`Blender process ${processId} exited with code:`, code);
                this.activeProcesses.delete(processId);
            });
            
            blenderProcess.on('error', (error) => {
                this.error(`Blender process ${processId} error:`, error);
                this.activeProcesses.delete(processId);
            });
            
            return {
                success: true,
                processId,
                pid: blenderProcess.pid
            };
        } catch (error) {
            this.error('Failed to launch Blender:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    async executeScript(payload) {
        if (!this.blenderPath) {
            throw new Error('Blender is not installed');
        }
        
        const { script, filePath } = payload;
        
        // Create temporary script file
        const tempDir = path.join(os.tmpdir(), 'wit_blender');
        await fs.mkdir(tempDir, { recursive: true });
        
        const tempScriptPath = path.join(tempDir, `script_${Date.now()}.py`);
        await fs.writeFile(tempScriptPath, script);
        
        const scriptId = `script_${Date.now()}`;
        this.tempScripts.set(scriptId, tempScriptPath);
        
        try {
            const args = ['--background'];
            
            if (filePath) {
                args.push(filePath);
            }
            
            args.push('--python', tempScriptPath);
            
            const { stdout, stderr } = await execAsync(`"${this.blenderPath}" ${args.join(' ')}`);
            
            // Cleanup temp script
            setTimeout(async () => {
                try {
                    await fs.unlink(tempScriptPath);
                    this.tempScripts.delete(scriptId);
                } catch (error) {
                    this.warn('Failed to cleanup temp script:', error);
                }
            }, 1000);
            
            return {
                success: true,
                output: stdout,
                errors: stderr || null
            };
        } catch (error) {
            this.error('Script execution failed:', error);
            return {
                success: false,
                message: error.message,
                output: error.stdout || null,
                errors: error.stderr || null
            };
        }
    }
    
    async createObject(payload) {
        const { type, name, location = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] } = payload;
        
        const script = `
import bpy
import sys
sys.path.append("${this.expandPath(this.config.pythonScriptsPath)}")
from wit_ai_helper import create_primitive

result = create_primitive("${type}", location=${JSON.stringify(location)}, rotation=${JSON.stringify(rotation)}, scale=${JSON.stringify(scale)})
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
    
    async render(payload) {
        if (!this.blenderPath) {
            throw new Error('Blender is not installed');
        }
        
        const { 
            filePath, 
            outputPath, 
            engine = this.config.renderEngine,
            samples = this.config.renderSamples,
            resolution = [1920, 1080]
        } = payload;
        
        if (!filePath) {
            throw new Error('File path is required for rendering');
        }
        
        const script = `
import bpy
import sys
sys.path.append("${this.expandPath(this.config.pythonScriptsPath)}")
from wit_ai_helper import setup_render, render_image

setup_render(engine="${engine}", samples=${samples}, resolution=${JSON.stringify(resolution)})
render_image("${outputPath}")
print("RENDER_COMPLETE")
`;
        
        const result = await this.executeScript({ script, filePath });
        
        if (result.success && result.output.includes('RENDER_COMPLETE')) {
            return {
                success: true,
                outputPath,
                message: 'Render completed successfully'
            };
        }
        
        return {
            success: false,
            message: 'Render failed',
            output: result.output,
            errors: result.errors
        };
    }
    
    async getSceneInfo(payload = {}) {
        const { filePath } = payload;
        
        const script = `
import bpy
import sys
import json
sys.path.append("${this.expandPath(this.config.pythonScriptsPath)}")
from wit_ai_helper import get_scene_info

scene_info = get_scene_info()
print("SCENE_INFO:" + json.dumps(scene_info))
`;
        
        const result = await this.executeScript({ script, filePath });
        
        if (result.success) {
            const match = result.output.match(/SCENE_INFO:(.+)/);
            if (match) {
                try {
                    const sceneInfo = JSON.parse(match[1]);
                    return {
                        success: true,
                        sceneInfo
                    };
                } catch (error) {
                    this.error('Failed to parse scene info:', error);
                }
            }
        }
        
        return {
            success: false,
            message: 'Failed to get scene information'
        };
    }
    
    async listProjects() {
        const projectsPath = this.expandPath(this.config.projectsPath);
        
        try {
            const files = await fs.readdir(projectsPath);
            const projects = [];
            
            for (const file of files) {
                if (file.endsWith('.blend')) {
                    const filePath = path.join(projectsPath, file);
                    try {
                        const stats = await fs.stat(filePath);
                        projects.push({
                            name: path.basename(file, '.blend'),
                            path: filePath,
                            relativePath: file,
                            size: stats.size,
                            modified: stats.mtime.toISOString(),
                            created: stats.birthtime.toISOString()
                        });
                    } catch (error) {
                        this.warn(`Failed to get stats for ${file}:`, error);
                    }
                }
            }
            
            // Sort by modification time, newest first
            projects.sort((a, b) => new Date(b.modified) - new Date(a.modified));
            
            return projects;
        } catch (error) {
            this.error('Failed to list projects:', error);
            return [];
        }
    }
    
    getStatus() {
        try {
            const baseStatus = super.getStatus();
            return {
                ...baseStatus,
                installed: !!this.blenderPath,
                path: this.blenderPath || null,
                version: this.blenderVersion || 'unknown',
                projectsPath: this.config.projectsPath,
                activeProcesses: this.activeProcesses.size,
                watchedFiles: this.watchedFiles.size,
                recentProjects: this.recentProjects.slice(0, 5),
                supportedFormats: this.config.exportFormats || [],
                aiEnabled: this.config.aiIntegration?.enabled || false,
                renderEngine: this.config.renderEngine,
                pythonScriptsPath: this.config.pythonScriptsPath
            };
        } catch (error) {
            this.error('Error getting status:', error);
            return {
                initialized: false,
                started: false,
                error: error.message
            };
        }
    }
    
    // Additional methods for other commands would be implemented here...
    async openFile(payload) {
        const { filePath } = payload;
        return await this.launchBlender({ filePath });
    }
    
    async newFile(payload) {
        const { template = 'basic', name } = payload;
        const projectsPath = this.expandPath(this.config.projectsPath);
        const fileName = name ? `${name}.blend` : `project_${Date.now()}.blend`;
        const filePath = path.join(projectsPath, fileName);
        
        return await this.launchBlender({ 
            script: `
import bpy
import sys
sys.path.append("${this.expandPath(this.config.pythonScriptsPath)}")
from wit_templates import create_project_template
create_project_template("${template}")
bpy.ops.wm.save_mainfile(filepath="${filePath}")
`
        });
    }
    
    async setupLighting(payload) {
        const { style = 'studio', filePath } = payload;
        
        const script = `
import sys
sys.path.append("${this.expandPath(this.config.pythonScriptsPath)}")
from wit_templates import setup_lighting
result = setup_lighting("${style}")
print(f"LIGHTING_RESULT: {result}")
`;
        
        return await this.executeScript({ script, filePath });
    }
    
    // Placeholder methods for remaining commands
    async export(payload) { return { success: false, message: 'Export not yet implemented' }; }
    async import(payload) { return { success: false, message: 'Import not yet implemented' }; }
    async listObjects(payload) { return { success: false, message: 'List objects not yet implemented' }; }
    async modifyObject(payload) { return { success: false, message: 'Modify object not yet implemented' }; }
    async deleteObject(payload) { return { success: false, message: 'Delete object not yet implemented' }; }
    async setMaterial(payload) { return { success: false, message: 'Set material not yet implemented' }; }
    async generateMesh(payload) { return { success: false, message: 'Generate mesh not yet implemented' }; }
    async saveProject(payload) { return { success: false, message: 'Save project not yet implemented' }; }
    
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
            this.warn('Failed to load recent projects:', error);
        }
    }
}

module.exports = BlenderPlugin;