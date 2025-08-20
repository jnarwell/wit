/**
 * OpenSCAD Plugin for W.I.T. Universal Desktop Controller
 * Provides programmatic 3D CAD modeling with OpenSCAD
 */

const { WITPlugin } = require('../../src/plugins/base/WITPlugin');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { promisify } = require('util');
const execAsync = promisify(exec);

class OpenSCADPlugin extends WITPlugin {
    constructor(context) {
        super(context);
        
        this.openscadPath = null;
        this.openscadVersion = null;
        this.activeProcesses = new Map();
        this.watchedFiles = new Map();
        this.recentProjects = [];
        
        // Default configuration
        this.config = {
            projectsPath: path.join(os.homedir(), 'Documents', 'OpenSCAD'),
            autoSave: true,
            renderQuality: 'preview',
            exportFormats: ['stl', 'off', 'amf', '3mf', 'dxf', 'svg', 'png'],
            customizer: {
                enabled: true
            },
            defaultCamera: {
                translation: [0, 0, 0],
                rotation: [55, 0, 25],
                distance: 140
            },
            ...this.config
        };
    }
    
    async initialize() {
        try {
            await super.initialize();
            
            this.log('OpenSCAD plugin initializing...');
            
            // Ensure projects directory exists
            try {
                const projectsPath = this.expandPath(this.config.projectsPath);
                await fs.mkdir(projectsPath, { recursive: true });
                
                // Create subdirectories for organization
                const subdirs = ['models', 'libraries', 'exports', 'templates'];
                for (const subdir of subdirs) {
                    await fs.mkdir(path.join(projectsPath, subdir), { recursive: true });
                }
            } catch (error) {
                this.log('Warning: Could not create project directories:', error.message);
            }
            
            // Detect OpenSCAD installation
            await this.detectOpenSCAD();
            
            if (this.openscadPath) {
                this.log(`OpenSCAD found at: ${this.openscadPath}`);
                this.log(`OpenSCAD version: ${this.openscadVersion || 'unknown'}`);
                
                // Load recent projects
                try {
                    await this.loadRecentProjects();
                } catch (error) {
                    this.log('Warning: Could not load recent projects:', error.message);
                }
                
                // Create example templates if they don't exist
                try {
                    await this.createExampleTemplates();
                } catch (error) {
                    this.log('Warning: Could not create example templates:', error.message);
                }
            } else {
                this.log('OpenSCAD not found. Please install OpenSCAD from https://openscad.org/downloads.html');
            }
            
            this.log('OpenSCAD plugin initialized');
        } catch (error) {
            this.log('Error during initialization:', error.message);
            // Don't throw - allow plugin to load even with errors
        }
    }
    
    async start() {
        await super.start();
        
        this.log('OpenSCAD plugin started successfully');
        
        // Emit status update to indicate plugin is active
        this.emit('plugin_status_update', {
            pluginId: this.id,
            status: 'active'
        });
    }
    
    async stop() {
        // Stop all active processes
        for (const [id, proc] of this.activeProcesses) {
            try {
                proc.kill('SIGTERM');
                this.log(`Stopped process: ${id}`);
            } catch (error) {
                this.log(`Failed to stop process ${id}:`, error.message);
            }
        }
        this.activeProcesses.clear();
        
        // Clear file watchers
        for (const [file, watcher] of this.watchedFiles) {
            if (watcher && typeof watcher.close === 'function') {
                watcher.close();
            }
        }
        this.watchedFiles.clear();
        
        await super.stop();
        this.log('OpenSCAD plugin stopped');
    }
    
    async detectOpenSCAD() {
        try {
            this.log('Detecting OpenSCAD installation...');
            
            // Check configured path first
            if (this.config.openscadPath && this.config.openscadPath !== 'auto') {
                try {
                    await fs.access(this.config.openscadPath);
                    this.openscadPath = this.config.openscadPath;
                    this.openscadVersion = await this.getOpenSCADVersion(this.openscadPath);
                    return;
                } catch (error) {
                    this.log('Configured OpenSCAD path not found:', this.config.openscadPath);
                }
            }
            
            // Auto-detect OpenSCAD
            const platform = os.platform();
            const manifest = require('./manifest.json');
            const possiblePaths = manifest.requirements.openscad.paths[platform] || [];
            
            for (const testPath of possiblePaths) {
                try {
                    const expandedPath = testPath.replace('%LOCALAPPDATA%', process.env.LOCALAPPDATA || '');
                    await fs.access(expandedPath);
                    this.openscadPath = expandedPath;
                    this.openscadVersion = await this.getOpenSCADVersion(expandedPath);
                    
                    // Save detected path
                    this.config.openscadPath = expandedPath;
                    try {
                        await this.saveData('config.json', this.config);
                    } catch (error) {
                        this.log('Warning: Could not save config:', error.message);
                    }
                    break;
                } catch (error) {
                    // Continue searching
                }
            }
            
            // Try command line
            if (!this.openscadPath) {
                try {
                    const { stdout } = await execAsync('which openscad || where openscad');
                    const cmdPath = stdout.trim().split('\n')[0];
                    if (cmdPath) {
                        this.openscadPath = cmdPath;
                        this.openscadVersion = await this.getOpenSCADVersion(cmdPath);
                    }
                } catch (error) {
                    // Command not found
                }
            }
        } catch (error) {
            this.log('Error detecting OpenSCAD:', error.message);
        }
    }
    
    async getOpenSCADVersion(openscadPath) {
        try {
            const { stdout } = await execAsync(`"${openscadPath}" --version`, {
                timeout: 5000
            });
            
            // Parse version from output
            const versionMatch = stdout.match(/OpenSCAD version (\d{4}\.\d{2}(?:\.\d+)?)/);
            return versionMatch ? versionMatch[1] : 'unknown';
        } catch (error) {
            this.log('Failed to get OpenSCAD version:', error.message);
            return 'unknown';
        }
    }
    
    async onMessage(message) {
        const { action, payload } = message;
        
        try {
            switch (action) {
                case 'getStatus':
                    return await this.getStatus();
                    
                case 'launch':
                    return await this.launchOpenSCAD(payload);
                    
                case 'openFile':
                    return await this.openFile(payload);
                    
                case 'newFile':
                    return await this.newFile(payload);
                    
                case 'render':
                    return await this.renderModel(payload);
                    
                case 'export':
                    return await this.exportModel(payload);
                    
                case 'compile':
                    return await this.compileCode(payload);
                    
                case 'listProjects':
                    return await this.listProjects();
                    
                case 'createProject':
                    return await this.createProject(payload);
                    
                case 'getVariables':
                    return await this.extractVariables(payload);
                    
                case 'updateVariables':
                    return await this.updateVariables(payload);
                    
                case 'generateSTL':
                    return await this.generateSTL(payload);
                    
                case 'generatePreview':
                    return await this.generatePreview(payload);
                    
                case 'checkSyntax':
                    return await this.checkSyntax(payload);
                    
                case 'getExamples':
                    return await this.getExamples();
                    
                case 'watchFile':
                    return await this.watchFile(payload);
                    
                default:
                    throw new Error(`Unknown action: ${action}`);
            }
        } catch (error) {
            this.log(`Error handling action ${action}:`, error);
            throw error;
        }
    }
    
    async getStatus() {
        try {
            const baseStatus = super.getStatus();
            return {
                ...baseStatus,
                installed: !!this.openscadPath,
                path: this.openscadPath || null,
                version: this.openscadVersion || 'unknown',
                projectsPath: this.config.projectsPath,
                activeProcesses: this.activeProcesses.size,
                watchedFiles: this.watchedFiles.size,
                recentProjects: this.recentProjects.slice(0, 5),
                supportedFormats: this.config.exportFormats || []
            };
        } catch (error) {
            this.log('Error getting status:', error);
            return {
                initialized: false,
                started: false,
                error: error.message
            };
        }
    }
    
    async launchOpenSCAD(payload = {}) {
        if (!this.openscadPath) {
            throw new Error('OpenSCAD not found. Please install OpenSCAD from https://openscad.org/downloads.html');
        }
        
        const args = [];
        
        if (payload.file) {
            args.push(this.expandPath(payload.file));
        }
        
        // Add camera settings if provided
        if (payload.camera) {
            args.push('--camera', this.formatCamera(payload.camera));
        }
        
        const process = spawn(this.openscadPath, args, {
            detached: true,
            stdio: 'ignore'
        });
        
        process.unref();
        
        const processId = `openscad-${Date.now()}`;
        this.activeProcesses.set(processId, process);
        
        process.on('exit', () => {
            this.activeProcesses.delete(processId);
        });
        
        return {
            success: true,
            processId,
            message: 'OpenSCAD launched successfully'
        };
    }
    
    async openFile(payload) {
        const { filePath } = payload;
        
        if (!filePath) {
            throw new Error('File path is required');
        }
        
        const expandedPath = this.expandPath(filePath);
        
        // Check if file exists
        try {
            await fs.access(expandedPath);
        } catch (error) {
            throw new Error(`File not found: ${expandedPath}`);
        }
        
        // Update recent projects
        await this.addToRecentProjects(expandedPath);
        
        // Launch OpenSCAD with the file
        return await this.launchOpenSCAD({ file: expandedPath });
    }
    
    async newFile(payload) {
        const { name, template = 'basic', content } = payload;
        
        if (!name) {
            throw new Error('File name is required');
        }
        
        const fileName = name.endsWith('.scad') ? name : `${name}.scad`;
        const filePath = path.join(this.expandPath(this.config.projectsPath), 'models', fileName);
        
        // Check if file already exists
        try {
            await fs.access(filePath);
            throw new Error(`File already exists: ${filePath}`);
        } catch (error) {
            if (error.message.includes('already exists')) {
                throw error;
            }
        }
        
        // Get template content
        let fileContent = content || await this.getTemplateContent(template);
        
        // Write file
        await fs.writeFile(filePath, fileContent, 'utf8');
        
        // Open in OpenSCAD
        await this.openFile({ filePath });
        
        return {
            success: true,
            filePath,
            message: `Created new file: ${fileName}`
        };
    }
    
    async renderModel(payload) {
        const { filePath, quality = 'preview' } = payload;
        
        if (!filePath) {
            throw new Error('File path is required');
        }
        
        if (!this.openscadPath) {
            throw new Error('OpenSCAD not found');
        }
        
        const expandedPath = this.expandPath(filePath);
        const outputPath = expandedPath.replace('.scad', `_${quality}.png`);
        
        const args = [
            expandedPath,
            '-o', outputPath,
            '--imgsize', '1024,768'
        ];
        
        if (quality === 'render') {
            args.push('--render');
        }
        
        return new Promise((resolve, reject) => {
            const process = spawn(this.openscadPath, args);
            let stderr = '';
            
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    resolve({
                        success: true,
                        outputPath,
                        message: `Model rendered successfully`
                    });
                } else {
                    reject(new Error(`Render failed: ${stderr}`));
                }
            });
        });
    }
    
    async exportModel(payload) {
        const { filePath, format = 'stl', outputPath } = payload;
        
        if (!filePath) {
            throw new Error('File path is required');
        }
        
        if (!this.openscadPath) {
            throw new Error('OpenSCAD not found');
        }
        
        if (!this.config.exportFormats.includes(format)) {
            throw new Error(`Unsupported format: ${format}. Supported formats: ${this.config.exportFormats.join(', ')}`);
        }
        
        const expandedPath = this.expandPath(filePath);
        const exportPath = outputPath || path.join(
            this.expandPath(this.config.projectsPath),
            'exports',
            path.basename(expandedPath, '.scad') + `.${format}`
        );
        
        const args = [
            expandedPath,
            '-o', exportPath
        ];
        
        // Add format-specific options
        if (format === 'stl' || format === 'off' || format === 'amf' || format === '3mf') {
            args.push('--render');
        }
        
        return new Promise((resolve, reject) => {
            const process = spawn(this.openscadPath, args);
            let stderr = '';
            
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            process.on('close', async (code) => {
                if (code === 0) {
                    // Get file size
                    const stats = await fs.stat(exportPath);
                    
                    resolve({
                        success: true,
                        outputPath: exportPath,
                        format,
                        size: stats.size,
                        message: `Exported to ${format.toUpperCase()} successfully`
                    });
                } else {
                    reject(new Error(`Export failed: ${stderr}`));
                }
            });
        });
    }
    
    async compileCode(payload) {
        const { code, filePath } = payload;
        
        if (!code && !filePath) {
            throw new Error('Code or file path is required');
        }
        
        if (!this.openscadPath) {
            throw new Error('OpenSCAD not found');
        }
        
        let targetPath;
        
        if (filePath) {
            targetPath = this.expandPath(filePath);
        } else {
            // Create temporary file
            targetPath = path.join(os.tmpdir(), `openscad_temp_${Date.now()}.scad`);
            await fs.writeFile(targetPath, code, 'utf8');
        }
        
        // Use OpenSCAD to check syntax
        const args = [
            targetPath,
            '-o', '/dev/null',  // Null output
            '--hardwarnings'
        ];
        
        return new Promise((resolve, reject) => {
            const process = spawn(this.openscadPath, args);
            let stdout = '';
            let stderr = '';
            
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            process.on('close', async (code) => {
                // Clean up temp file if created
                if (!filePath) {
                    try {
                        await fs.unlink(targetPath);
                    } catch (error) {
                        // Ignore cleanup errors
                    }
                }
                
                if (code === 0) {
                    resolve({
                        success: true,
                        message: 'Code compiled successfully',
                        output: stdout
                    });
                } else {
                    // Parse errors
                    const errors = this.parseCompilerErrors(stderr);
                    reject({
                        success: false,
                        errors,
                        rawOutput: stderr
                    });
                }
            });
        });
    }
    
    async extractVariables(payload) {
        const { filePath, code } = payload;
        
        let content;
        
        if (filePath) {
            content = await fs.readFile(this.expandPath(filePath), 'utf8');
        } else if (code) {
            content = code;
        } else {
            throw new Error('File path or code is required');
        }
        
        // Extract customizable variables (parameters)
        const variables = [];
        
        // Match patterns like: diameter = 10; // [5:20]
        const paramRegex = /^(\w+)\s*=\s*([^;]+);\s*\/\/\s*\[([^\]]+)\]/gm;
        let match;
        
        while ((match = paramRegex.exec(content)) !== null) {
            const [_, name, defaultValue, range] = match;
            
            // Parse range
            let type = 'number';
            let options = {};
            
            if (range.includes(':')) {
                // Numeric range [min:max] or [min:step:max]
                const parts = range.split(':');
                if (parts.length === 2) {
                    options = {
                        min: parseFloat(parts[0]),
                        max: parseFloat(parts[1])
                    };
                } else if (parts.length === 3) {
                    options = {
                        min: parseFloat(parts[0]),
                        step: parseFloat(parts[1]),
                        max: parseFloat(parts[2])
                    };
                }
            } else if (range.includes(',')) {
                // List of options
                type = 'select';
                options.values = range.split(',').map(v => v.trim());
            } else {
                // Boolean
                type = 'boolean';
            }
            
            variables.push({
                name,
                defaultValue: defaultValue.trim(),
                type,
                ...options
            });
        }
        
        // Also match simple variable declarations with comments
        const simpleRegex = /^(\w+)\s*=\s*([^;]+);\s*\/\/\s*(.+)$/gm;
        content.replace(simpleRegex, (_, name, value, comment) => {
            if (!variables.find(v => v.name === name)) {
                variables.push({
                    name,
                    defaultValue: value.trim(),
                    type: 'text',
                    description: comment.trim()
                });
            }
        });
        
        return {
            variables,
            count: variables.length
        };
    }
    
    async updateVariables(payload) {
        const { filePath, variables } = payload;
        
        if (!filePath || !variables) {
            throw new Error('File path and variables are required');
        }
        
        const expandedPath = this.expandPath(filePath);
        let content = await fs.readFile(expandedPath, 'utf8');
        
        // Update each variable
        for (const [name, value] of Object.entries(variables)) {
            const regex = new RegExp(`^(${name}\\s*=\\s*)([^;]+)(;.*)$`, 'gm');
            content = content.replace(regex, `$1${value}$3`);
        }
        
        // Save updated file
        if (this.config.autoSave) {
            await fs.writeFile(expandedPath, content, 'utf8');
        }
        
        return {
            success: true,
            updated: Object.keys(variables).length,
            message: 'Variables updated successfully'
        };
    }
    
    async generateSTL(payload) {
        return await this.exportModel({ ...payload, format: 'stl' });
    }
    
    async generatePreview(payload) {
        return await this.renderModel({ ...payload, quality: 'preview' });
    }
    
    async checkSyntax(payload) {
        try {
            const result = await this.compileCode(payload);
            return {
                success: true,
                valid: true,
                message: 'Syntax is valid'
            };
        } catch (error) {
            return {
                success: false,
                valid: false,
                errors: error.errors || [],
                message: 'Syntax errors found'
            };
        }
    }
    
    async listProjects() {
        const projectsPath = this.expandPath(this.config.projectsPath);
        const projects = [];
        
        try {
            // List all .scad files in models directory
            const modelsPath = path.join(projectsPath, 'models');
            const files = await this.findScadFiles(modelsPath);
            
            for (const file of files) {
                const stats = await fs.stat(file);
                const relativePath = path.relative(projectsPath, file);
                
                projects.push({
                    name: path.basename(file, '.scad'),
                    path: file,
                    relativePath,
                    size: stats.size,
                    modified: stats.mtime,
                    created: stats.birthtime
                });
            }
            
            // Sort by modified date
            projects.sort((a, b) => b.modified - a.modified);
        } catch (error) {
            this.log('Error listing projects:', error.message);
        }
        
        return projects;
    }
    
    async createProject(payload) {
        const { name, description, template = 'basic' } = payload;
        
        if (!name) {
            throw new Error('Project name is required');
        }
        
        const projectDir = path.join(this.expandPath(this.config.projectsPath), 'models', name);
        
        // Create project directory
        await fs.mkdir(projectDir, { recursive: true });
        
        // Create main file
        const mainFile = path.join(projectDir, `${name}.scad`);
        const content = await this.getTemplateContent(template, { name, description });
        
        await fs.writeFile(mainFile, content, 'utf8');
        
        // Create README
        const readmeContent = `# ${name}

${description || 'OpenSCAD project'}

## Usage
1. Open ${name}.scad in OpenSCAD
2. Adjust parameters in the Customizer panel
3. Render (F6) and export to desired format

## Files
- ${name}.scad - Main model file
`;
        
        await fs.writeFile(path.join(projectDir, 'README.md'), readmeContent, 'utf8');
        
        // Add to recent projects
        await this.addToRecentProjects(mainFile);
        
        return {
            success: true,
            projectPath: projectDir,
            mainFile,
            message: `Project '${name}' created successfully`
        };
    }
    
    async getExamples() {
        const templatesPath = path.join(this.expandPath(this.config.projectsPath), 'templates');
        const examples = [];
        
        try {
            const files = await fs.readdir(templatesPath);
            
            for (const file of files) {
                if (file.endsWith('.scad')) {
                    const filePath = path.join(templatesPath, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    
                    // Extract description from first comment
                    const descMatch = content.match(/^\/\*\s*(.+?)\s*\*\//s);
                    
                    examples.push({
                        name: path.basename(file, '.scad'),
                        file,
                        path: filePath,
                        description: descMatch ? descMatch[1].trim() : 'Example model'
                    });
                }
            }
        } catch (error) {
            this.log('Error loading examples:', error.message);
        }
        
        return examples;
    }
    
    async watchFile(payload) {
        const { filePath, action = 'start' } = payload;
        
        if (!filePath) {
            throw new Error('File path is required');
        }
        
        const expandedPath = this.expandPath(filePath);
        
        if (action === 'stop') {
            const watcher = this.watchedFiles.get(expandedPath);
            if (watcher) {
                watcher.close();
                this.watchedFiles.delete(expandedPath);
            }
            return { success: true, message: 'File watch stopped' };
        }
        
        // Start watching
        if (this.watchedFiles.has(expandedPath)) {
            return { success: true, message: 'File already being watched' };
        }
        
        try {
            const watcher = fs.watch(expandedPath, async (eventType) => {
                if (eventType === 'change') {
                    this.sendMessage({
                        type: 'file-changed',
                        file: expandedPath,
                        timestamp: new Date().toISOString()
                    });
                    
                    // Auto-render if configured
                    if (this.config.autoRender) {
                        try {
                            await this.renderModel({ filePath: expandedPath });
                        } catch (error) {
                            this.log('Auto-render failed:', error.message);
                        }
                    }
                }
            });
            
            this.watchedFiles.set(expandedPath, watcher);
            
            return {
                success: true,
                message: 'File watch started'
            };
        } catch (error) {
            throw new Error(`Failed to watch file: ${error.message}`);
        }
    }
    
    // Helper methods
    
    expandPath(filePath) {
        if (filePath.startsWith('~')) {
            return path.join(os.homedir(), filePath.slice(1));
        }
        return filePath;
    }
    
    formatCamera(camera) {
        const { translation = [0, 0, 0], rotation = [55, 0, 25], distance = 140 } = camera;
        return `${translation.join(',')},${rotation.join(',')},${distance}`;
    }
    
    parseCompilerErrors(stderr) {
        const errors = [];
        const lines = stderr.split('\n');
        
        for (const line of lines) {
            if (line.includes('ERROR:') || line.includes('WARNING:')) {
                errors.push({
                    type: line.includes('ERROR:') ? 'error' : 'warning',
                    message: line.trim()
                });
            }
        }
        
        return errors;
    }
    
    async findScadFiles(dir) {
        const files = [];
        
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    const subFiles = await this.findScadFiles(fullPath);
                    files.push(...subFiles);
                } else if (entry.name.endsWith('.scad')) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Ignore errors
        }
        
        return files;
    }
    
    async loadRecentProjects() {
        try {
            const data = await this.loadData('recent_projects.json');
            this.recentProjects = data || [];
        } catch (error) {
            this.recentProjects = [];
        }
    }
    
    async saveRecentProjects() {
        await this.saveData('recent_projects.json', this.recentProjects);
    }
    
    async addToRecentProjects(filePath) {
        // Remove if already exists
        this.recentProjects = this.recentProjects.filter(p => p.path !== filePath);
        
        // Add to beginning
        this.recentProjects.unshift({
            path: filePath,
            name: path.basename(filePath, '.scad'),
            lastOpened: new Date().toISOString()
        });
        
        // Keep only last 10
        this.recentProjects = this.recentProjects.slice(0, 10);
        
        await this.saveRecentProjects();
    }
    
    async getTemplateContent(template, vars = {}) {
        const templates = {
            basic: `// ${vars.name || 'Basic Model'}
// ${vars.description || 'Created with W.I.T. OpenSCAD Plugin'}

// Parameters
diameter = 20; // [10:50]
height = 30; // [10:100]
wall_thickness = 2; // [1:5]

// Model
difference() {
    cylinder(h=height, d=diameter, $fn=50);
    translate([0, 0, wall_thickness])
        cylinder(h=height, d=diameter-2*wall_thickness, $fn=50);
}
`,
            parametric_box: `// Parametric Box
// A customizable box with rounded corners

// Dimensions
width = 50; // [20:100]
depth = 40; // [20:100]
height = 30; // [10:80]
wall_thickness = 2; // [1:5]
corner_radius = 5; // [0:10]

// Features
has_lid = true; // [true, false]
lid_height = 10; // [5:20]

// Main box
module rounded_box(w, d, h, r) {
    hull() {
        for (x = [-1, 1]) {
            for (y = [-1, 1]) {
                translate([x*(w/2-r), y*(d/2-r), 0])
                    cylinder(h=h, r=r, $fn=30);
            }
        }
    }
}

// Box body
difference() {
    rounded_box(width, depth, height, corner_radius);
    translate([0, 0, wall_thickness])
        rounded_box(width-2*wall_thickness, depth-2*wall_thickness, height, corner_radius-wall_thickness);
}

// Lid (if enabled)
if (has_lid) {
    translate([width + 10, 0, 0]) {
        difference() {
            rounded_box(width, depth, lid_height, corner_radius);
            translate([0, 0, wall_thickness])
                rounded_box(width-2*wall_thickness, depth-2*wall_thickness, lid_height, corner_radius-wall_thickness);
        }
    }
}
`,
            gear: `// Parametric Gear
// Customizable gear generator

// Gear parameters
teeth = 20; // [10:50]
module_size = 2; // [1:5]
thickness = 5; // [2:20]
hole_diameter = 5; // [0:20]

// Calculate dimensions
pitch_diameter = teeth * module_size;
outer_diameter = pitch_diameter + 2 * module_size;
root_diameter = pitch_diameter - 2.5 * module_size;

// Generate gear
module gear() {
    difference() {
        // Simplified gear shape (use MCAD library for accurate gears)
        cylinder(h=thickness, d=outer_diameter, $fn=teeth*4);
        
        // Center hole
        if (hole_diameter > 0) {
            cylinder(h=thickness+1, d=hole_diameter, $fn=30);
        }
    }
}

gear();
`
        };
        
        return templates[template] || templates.basic;
    }
    
    async createExampleTemplates() {
        const templatesPath = path.join(this.expandPath(this.config.projectsPath), 'templates');
        
        const examples = {
            'basic_shape.scad': await this.getTemplateContent('basic'),
            'parametric_box.scad': await this.getTemplateContent('parametric_box'),
            'gear.scad': await this.getTemplateContent('gear')
        };
        
        for (const [filename, content] of Object.entries(examples)) {
            const filePath = path.join(templatesPath, filename);
            try {
                await fs.access(filePath);
                // File already exists
            } catch (error) {
                // Create file
                await fs.writeFile(filePath, content, 'utf8');
                this.log(`Created example template: ${filename}`);
            }
        }
    }
}

module.exports = OpenSCADPlugin;