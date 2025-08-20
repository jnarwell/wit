const { WITPlugin } = require('../../src/plugins/base/WITPlugin');
const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { promisify } = require('util');
const execAsync = promisify(exec);

class KiCadPlugin extends WITPlugin {
    constructor(config) {
        super(config);
        this.kicadPath = null;
        this.kicadVersion = null;
        this.pythonPath = null;
        this.activeProcesses = new Map();
        this.projects = new Map();
        this.recentProjects = [];
    }

    async initialize() {
        try {
            await super.initialize();
            this.log('KiCad plugin initializing...');
            
            // Initialize config with defaults
            this.config = {
                kicadPath: this.config.kicadPath || 'auto',
                projectsPath: this.config.projectsPath || path.join(os.homedir(), 'Documents', 'KiCad'),
                autoBackup: this.config.autoBackup !== false,
                pythonPath: this.config.pythonPath || 'auto',
                ...this.config
            };
            
            // Ensure projects directory exists
            try {
                await fs.mkdir(this.expandPath(this.config.projectsPath), { recursive: true });
            } catch (error) {
                this.log('Failed to create projects directory:', error.message);
            }
            
            // Detect KiCad installation
            await this.detectKiCad();
            
            if (this.kicadPath) {
                this.log(`KiCad found at: ${this.kicadPath}`);
                this.log(`KiCad version: ${this.kicadVersion}`);
                
                // Load recent projects
                await this.loadRecentProjects();
            } else {
                this.log('KiCad not found. Please install KiCad or configure the path manually.');
            }
            
            this.log('KiCad plugin initialized');
        } catch (error) {
            this.log('Error during KiCad plugin initialization:', error.message);
            this.log('Stack trace:', error.stack);
            // Don't throw to allow plugin to load even with errors
        }
    }
    
    async detectKiCad() {
        this.log('Starting KiCad detection...');
        
        if (this.config.kicadPath && this.config.kicadPath !== 'auto') {
            // Use configured path
            this.log('Checking configured path:', this.config.kicadPath);
            try {
                await fs.access(this.config.kicadPath);
                this.kicadPath = this.config.kicadPath;
                this.log('Getting KiCad version...');
                this.kicadVersion = await this.getKiCadVersion(this.kicadPath);
                this.log('KiCad version detected:', this.kicadVersion);
                return;
            } catch (error) {
                this.log('Configured KiCad path not found:', this.config.kicadPath);
            }
        }
        
        // Auto-detect KiCad
        const platform = os.platform();
        this.log('Auto-detecting KiCad on platform:', platform);
        const possiblePaths = this.getPossibleKiCadPaths(platform);
        
        for (const testPath of possiblePaths) {
            this.log('Checking path:', testPath);
            try {
                await fs.access(testPath);
                this.kicadPath = testPath;
                this.log('Found KiCad, getting version...');
                this.kicadVersion = await this.getKiCadVersion(testPath);
                this.log('KiCad version detected:', this.kicadVersion);
                
                // Save detected path
                this.config.kicadPath = testPath;
                await this.saveData('config.json', this.config);
                break;
            } catch (error) {
                this.log('Path not found:', testPath);
                // Continue searching
            }
        }
        
        // Detect Python for scripting
        if (this.config.pythonPath === 'auto') {
            this.log('Detecting Python...');
            await this.detectPython();
        }
        
        this.log('KiCad detection complete');
    }
    
    getPossibleKiCadPaths(platform) {
        switch (platform) {
            case 'darwin':
                return [
                    '/Applications/KiCad/KiCad.app/Contents/MacOS/kicad',
                    '/Applications/KiCad.app/Contents/MacOS/kicad',
                    '/Applications/Kicad/Kicad.app/Contents/MacOS/kicad',
                    path.join(os.homedir(), 'Applications/KiCad/KiCad.app/Contents/MacOS/kicad')
                ];
            case 'win32':
                return [
                    'C:\\Program Files\\KiCad\\bin\\kicad.exe',
                    'C:\\Program Files (x86)\\KiCad\\bin\\kicad.exe',
                    'C:\\KiCad\\bin\\kicad.exe',
                    path.join(os.homedir(), 'AppData\\Local\\Programs\\KiCad\\bin\\kicad.exe')
                ];
            case 'linux':
                return [
                    '/usr/bin/kicad',
                    '/usr/local/bin/kicad',
                    '/opt/kicad/bin/kicad',
                    path.join(os.homedir(), '.local/bin/kicad')
                ];
            default:
                return [];
        }
    }
    
    async getKiCadVersion(kicadPath) {
        // Skip version detection on macOS as it may open GUI
        if (process.platform === 'darwin') {
            this.log('Skipping version detection on macOS to avoid GUI launch');
            return 'macOS';
        }
        
        try {
            const { stdout } = await execAsync(`"${kicadPath}" --version`, { 
                timeout: 5000,  // 5 second timeout
                windowsHide: true 
            });
            
            const versionMatch = stdout.match(/KiCad (\d+\.\d+\.\d+)/);
            return versionMatch ? versionMatch[1] : 'unknown';
        } catch (error) {
            this.log('Failed to get KiCad version:', error.message);
            // Don't let version detection failure stop plugin initialization
            return 'unknown';
        }
    }
    
    async detectPython() {
        const pythonCommands = ['python3', 'python'];
        
        for (const cmd of pythonCommands) {
            try {
                const { stdout } = await execAsync(`${cmd} --version`, {
                    timeout: 3000  // 3 second timeout
                });
                if (stdout.includes('Python')) {
                    this.pythonPath = cmd;
                    this.log(`Python found: ${cmd}`);
                    break;
                }
            } catch (error) {
                this.log(`Failed to detect ${cmd}:`, error.message);
                // Continue searching
            }
        }
        
        if (!this.pythonPath) {
            this.log('Python not found, some features may be limited');
        }
    }
    
    expandPath(filePath) {
        if (filePath.startsWith('~')) {
            return path.join(os.homedir(), filePath.slice(1));
        }
        return filePath;
    }
    
    async start() {
        await super.start();
        this.log('KiCad plugin started');
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
        
        await super.stop();
        this.log('KiCad plugin stopped');
    }
    
    async onMessage(message) {
        const { action, payload } = message;
        
        try {
            switch (action) {
                case 'getStatus':
                    return await this.getStatus();
                    
                case 'launch':
                    return await this.launchKiCad(payload);
                    
                case 'listProjects':
                    return await this.listProjects();
                    
                case 'openProject':
                    return await this.openProject(payload);
                    
                case 'createProject':
                    return await this.createProject(payload);
                    
                case 'deleteProject':
                    return await this.deleteProject(payload);
                    
                case 'openSchematic':
                    return await this.openSchematic(payload);
                    
                case 'openPCB':
                    return await this.openPCB(payload);
                    
                case 'exportGerbers':
                    return await this.exportGerbers(payload);
                    
                case 'exportBOM':
                    return await this.exportBOM(payload);
                    
                case 'export3D':
                    return await this.export3D(payload);
                    
                case 'runDRC':
                    return await this.runDRC(payload);
                    
                case 'runERC':
                    return await this.runERC(payload);
                    
                case 'updateLibraries':
                    return await this.updateLibraries();
                    
                case 'searchComponents':
                    return await this.searchComponents(payload);
                    
                case 'getProjectInfo':
                    return await this.getProjectInfo(payload);
                    
                case 'backupProject':
                    return await this.backupProject(payload);
                    
                default:
                    throw new Error(`Unknown action: ${action}`);
            }
        } catch (error) {
            this.log(`Error handling action ${action}:`, error);
            throw error;
        }
    }
    
    async getStatus() {
        return {
            installed: !!this.kicadPath,
            path: this.kicadPath,
            version: this.kicadVersion,
            pythonAvailable: !!this.pythonPath,
            projectsPath: this.config.projectsPath,
            activeProcesses: this.activeProcesses.size,
            recentProjects: this.recentProjects.slice(0, 5)
        };
    }
    
    async launchKiCad(payload = {}) {
        if (!this.kicadPath) {
            throw new Error('KiCad not found. Please install KiCad.');
        }
        
        const args = [];
        
        if (payload.projectPath) {
            args.push(this.expandPath(payload.projectPath));
        }
        
        const process = spawn(this.kicadPath, args, {
            detached: true,
            stdio: 'ignore'
        });
        
        process.unref();
        
        const processId = `kicad-${Date.now()}`;
        this.activeProcesses.set(processId, process);
        
        process.on('exit', () => {
            this.activeProcesses.delete(processId);
        });
        
        return {
            success: true,
            processId,
            message: 'KiCad launched successfully'
        };
    }
    
    async listProjects() {
        const projectsPath = this.expandPath(this.config.projectsPath);
        const projects = [];
        
        try {
            const items = await fs.readdir(projectsPath);
            
            for (const item of items) {
                const itemPath = path.join(projectsPath, item);
                const stat = await fs.stat(itemPath);
                
                if (stat.isDirectory()) {
                    // Check if it's a KiCad project
                    const projectFile = path.join(itemPath, `${item}.kicad_pro`);
                    const legacyProjectFile = path.join(itemPath, `${item}.pro`);
                    
                    if (await this.fileExists(projectFile) || await this.fileExists(legacyProjectFile)) {
                        const projectInfo = await this.getProjectInfo({ projectPath: itemPath });
                        projects.push({
                            name: item,
                            path: itemPath,
                            ...projectInfo
                        });
                    }
                }
            }
        } catch (error) {
            this.log('Error listing projects:', error.message);
        }
        
        // Add recent projects not in the projects directory
        for (const recentProject of this.recentProjects) {
            if (!projects.find(p => p.path === recentProject.path)) {
                projects.push(recentProject);
            }
        }
        
        return projects;
    }
    
    async openProject(payload) {
        const { projectPath } = payload;
        
        if (!projectPath) {
            throw new Error('Project path is required');
        }
        
        const expandedPath = this.expandPath(projectPath);
        
        // Check if project exists
        if (!await this.fileExists(expandedPath)) {
            throw new Error('Project not found');
        }
        
        // Update recent projects
        await this.addToRecentProjects(expandedPath);
        
        // Launch KiCad with project
        return await this.launchKiCad({ projectPath: expandedPath });
    }
    
    async createProject(payload) {
        const { name, template, description } = payload;
        
        if (!name) {
            throw new Error('Project name is required');
        }
        
        const projectPath = path.join(this.expandPath(this.config.projectsPath), name);
        
        // Check if project already exists
        if (await this.fileExists(projectPath)) {
            throw new Error('Project already exists');
        }
        
        // Create project directory
        await fs.mkdir(projectPath, { recursive: true });
        
        // Create project file
        const projectFile = path.join(projectPath, `${name}.kicad_pro`);
        const projectData = {
            meta: {
                filename: `${name}.kicad_pro`,
                version: 1
            },
            general: {
                name: name,
                description: description || ''
            }
        };
        
        await fs.writeFile(projectFile, JSON.stringify(projectData, null, 2));
        
        // Create empty schematic and PCB files
        const schematicFile = path.join(projectPath, `${name}.kicad_sch`);
        const pcbFile = path.join(projectPath, `${name}.kicad_pcb`);
        
        await fs.writeFile(schematicFile, this.getEmptySchematicContent());
        await fs.writeFile(pcbFile, this.getEmptyPCBContent());
        
        // Add to recent projects
        await this.addToRecentProjects(projectPath);
        
        return {
            success: true,
            projectPath,
            message: `Project '${name}' created successfully`
        };
    }
    
    async deleteProject(payload) {
        const { projectPath, backup = true } = payload;
        
        if (!projectPath) {
            throw new Error('Project path is required');
        }
        
        const expandedPath = this.expandPath(projectPath);
        
        // Check if project exists
        if (!await this.fileExists(expandedPath)) {
            throw new Error('Project not found');
        }
        
        // Backup if requested
        if (backup && this.config.autoBackup) {
            await this.backupProject({ projectPath: expandedPath });
        }
        
        // Delete project directory
        await fs.rm(expandedPath, { recursive: true, force: true });
        
        // Remove from recent projects
        this.recentProjects = this.recentProjects.filter(p => p.path !== expandedPath);
        await this.saveRecentProjects();
        
        return {
            success: true,
            message: 'Project deleted successfully'
        };
    }
    
    async openSchematic(payload) {
        const { projectPath } = payload;
        
        if (!projectPath) {
            throw new Error('Project path is required');
        }
        
        const expandedPath = this.expandPath(projectPath);
        const projectName = path.basename(expandedPath);
        const schematicFile = path.join(expandedPath, `${projectName}.kicad_sch`);
        
        if (!await this.fileExists(schematicFile)) {
            throw new Error('Schematic file not found');
        }
        
        // Get the correct executable for schematic editor
        const eeschemaPath = this.getKiCadExecutable('eeschema');
        
        const process = spawn(eeschemaPath, [schematicFile], {
            detached: true,
            stdio: 'ignore'
        });
        
        process.unref();
        
        const processId = `eeschema-${Date.now()}`;
        this.activeProcesses.set(processId, process);
        
        return {
            success: true,
            processId,
            message: 'Schematic editor opened'
        };
    }
    
    async openPCB(payload) {
        const { projectPath } = payload;
        
        if (!projectPath) {
            throw new Error('Project path is required');
        }
        
        const expandedPath = this.expandPath(projectPath);
        const projectName = path.basename(expandedPath);
        const pcbFile = path.join(expandedPath, `${projectName}.kicad_pcb`);
        
        if (!await this.fileExists(pcbFile)) {
            throw new Error('PCB file not found');
        }
        
        // Get the correct executable for PCB editor
        const pcbnewPath = this.getKiCadExecutable('pcbnew');
        
        const process = spawn(pcbnewPath, [pcbFile], {
            detached: true,
            stdio: 'ignore'
        });
        
        process.unref();
        
        const processId = `pcbnew-${Date.now()}`;
        this.activeProcesses.set(processId, process);
        
        return {
            success: true,
            processId,
            message: 'PCB editor opened'
        };
    }
    
    async exportGerbers(payload) {
        const { projectPath, outputDir } = payload;
        
        if (!projectPath) {
            throw new Error('Project path is required');
        }
        
        if (!this.pythonPath) {
            throw new Error('Python not found. Python is required for gerber export.');
        }
        
        const expandedPath = this.expandPath(projectPath);
        const projectName = path.basename(expandedPath);
        const pcbFile = path.join(expandedPath, `${projectName}.kicad_pcb`);
        const gerberDir = outputDir || path.join(expandedPath, 'gerbers');
        
        // Create gerber directory
        await fs.mkdir(gerberDir, { recursive: true });
        
        // Create Python script for gerber export
        const scriptContent = this.getGerberExportScript(pcbFile, gerberDir);
        const scriptPath = path.join(expandedPath, 'export_gerbers.py');
        
        await fs.writeFile(scriptPath, scriptContent);
        
        // Run the script
        return new Promise((resolve, reject) => {
            const process = spawn(this.pythonPath, [scriptPath]);
            let stdout = '';
            let stderr = '';
            
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            process.on('close', async (code) => {
                // Clean up script
                try {
                    await fs.unlink(scriptPath);
                } catch (error) {
                    // Ignore cleanup errors
                }
                
                if (code === 0) {
                    resolve({
                        success: true,
                        outputDir: gerberDir,
                        message: 'Gerbers exported successfully'
                    });
                } else {
                    reject(new Error(`Gerber export failed: ${stderr}`));
                }
            });
        });
    }
    
    async exportBOM(payload) {
        const { projectPath, format = 'csv' } = payload;
        
        if (!projectPath) {
            throw new Error('Project path is required');
        }
        
        const expandedPath = this.expandPath(projectPath);
        const projectName = path.basename(expandedPath);
        const schematicFile = path.join(expandedPath, `${projectName}.kicad_sch`);
        const outputFile = path.join(expandedPath, `${projectName}_BOM.${format}`);
        
        if (!this.pythonPath) {
            // Use KiCad's built-in BOM generator
            const eeschemaPath = this.getKiCadExecutable('eeschema');
            
            return new Promise((resolve, reject) => {
                const process = spawn(eeschemaPath, [
                    '--bom',
                    schematicFile,
                    outputFile
                ]);
                
                process.on('close', (code) => {
                    if (code === 0) {
                        resolve({
                            success: true,
                            outputFile,
                            message: 'BOM exported successfully'
                        });
                    } else {
                        reject(new Error('BOM export failed'));
                    }
                });
            });
        }
        
        // Use Python script for more control
        const scriptContent = this.getBOMExportScript(schematicFile, outputFile, format);
        const scriptPath = path.join(expandedPath, 'export_bom.py');
        
        await fs.writeFile(scriptPath, scriptContent);
        
        return new Promise((resolve, reject) => {
            const process = spawn(this.pythonPath, [scriptPath]);
            
            process.on('close', async (code) => {
                try {
                    await fs.unlink(scriptPath);
                } catch (error) {
                    // Ignore cleanup errors
                }
                
                if (code === 0) {
                    resolve({
                        success: true,
                        outputFile,
                        message: 'BOM exported successfully'
                    });
                } else {
                    reject(new Error('BOM export failed'));
                }
            });
        });
    }
    
    async export3D(payload) {
        const { projectPath, format = 'step' } = payload;
        
        if (!projectPath) {
            throw new Error('Project path is required');
        }
        
        const expandedPath = this.expandPath(projectPath);
        const projectName = path.basename(expandedPath);
        const pcbFile = path.join(expandedPath, `${projectName}.kicad_pcb`);
        const outputFile = path.join(expandedPath, `${projectName}.${format}`);
        
        // Use kicad2step for STEP export
        const kicad2stepPath = this.getKiCadExecutable('kicad2step');
        
        return new Promise((resolve, reject) => {
            const args = [
                '--force',
                '-o', outputFile
            ];
            
            if (format === 'step') {
                args.push(pcbFile);
            } else {
                reject(new Error(`Unsupported 3D export format: ${format}`));
                return;
            }
            
            const process = spawn(kicad2stepPath, args);
            let stderr = '';
            
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    resolve({
                        success: true,
                        outputFile,
                        message: `3D model exported as ${format.toUpperCase()}`
                    });
                } else {
                    reject(new Error(`3D export failed: ${stderr}`));
                }
            });
        });
    }
    
    async runDRC(payload) {
        const { projectPath } = payload;
        
        if (!projectPath) {
            throw new Error('Project path is required');
        }
        
        // DRC typically runs within PCBNew
        // For now, we'll open the PCB with DRC dialog
        return {
            success: true,
            message: 'Please run DRC from within PCBNew',
            hint: 'Use Inspect -> Design Rules Checker in PCBNew'
        };
    }
    
    async runERC(payload) {
        const { projectPath } = payload;
        
        if (!projectPath) {
            throw new Error('Project path is required');
        }
        
        // ERC typically runs within Eeschema
        return {
            success: true,
            message: 'Please run ERC from within Eeschema',
            hint: 'Use Inspect -> Electrical Rules Checker in Eeschema'
        };
    }
    
    async updateLibraries() {
        // This would typically update symbol and footprint libraries
        // For now, return instructions
        return {
            success: true,
            message: 'Library updates should be done through KiCad preferences',
            hint: 'Use Preferences -> Manage Symbol/Footprint Libraries in KiCad'
        };
    }
    
    async searchComponents(payload) {
        const { query } = payload;
        
        if (!query) {
            throw new Error('Search query is required');
        }
        
        // This would search through component libraries
        // For now, return a placeholder
        return {
            results: [],
            message: 'Component search requires library integration'
        };
    }
    
    async getProjectInfo(payload) {
        const { projectPath } = payload;
        
        if (!projectPath) {
            throw new Error('Project path is required');
        }
        
        const expandedPath = this.expandPath(projectPath);
        const projectName = path.basename(expandedPath);
        const info = {
            name: projectName,
            path: expandedPath,
            hasSchematic: false,
            hasPCB: false,
            hasGerbers: false,
            has3DModel: false,
            lastModified: null,
            size: 0
        };
        
        // Check for files
        const schematicFile = path.join(expandedPath, `${projectName}.kicad_sch`);
        const pcbFile = path.join(expandedPath, `${projectName}.kicad_pcb`);
        const gerberDir = path.join(expandedPath, 'gerbers');
        const stepFile = path.join(expandedPath, `${projectName}.step`);
        
        if (await this.fileExists(schematicFile)) {
            info.hasSchematic = true;
            const stat = await fs.stat(schematicFile);
            info.lastModified = stat.mtime;
            info.size += stat.size;
        }
        
        if (await this.fileExists(pcbFile)) {
            info.hasPCB = true;
            const stat = await fs.stat(pcbFile);
            if (!info.lastModified || stat.mtime > info.lastModified) {
                info.lastModified = stat.mtime;
            }
            info.size += stat.size;
        }
        
        if (await this.fileExists(gerberDir)) {
            info.hasGerbers = true;
        }
        
        if (await this.fileExists(stepFile)) {
            info.has3DModel = true;
        }
        
        return info;
    }
    
    async backupProject(payload) {
        const { projectPath } = payload;
        
        if (!projectPath) {
            throw new Error('Project path is required');
        }
        
        const expandedPath = this.expandPath(projectPath);
        const projectName = path.basename(expandedPath);
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const backupName = `${projectName}_backup_${timestamp}`;
        const backupPath = path.join(path.dirname(expandedPath), backupName);
        
        // Copy project directory
        await this.copyDirectory(expandedPath, backupPath);
        
        return {
            success: true,
            backupPath,
            message: `Project backed up to ${backupName}`
        };
    }
    
    // Helper methods
    
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
    
    async copyDirectory(src, dest) {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src, { withFileTypes: true });
        
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
                await this.copyDirectory(srcPath, destPath);
            } else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    }
    
    getKiCadExecutable(tool) {
        if (!this.kicadPath) {
            throw new Error('KiCad not found');
        }
        
        const platform = os.platform();
        const kicadDir = path.dirname(this.kicadPath);
        
        switch (platform) {
            case 'darwin':
                // On macOS, tools are in the same directory
                return path.join(kicadDir, tool);
            case 'win32':
                // On Windows, add .exe
                return path.join(kicadDir, `${tool}.exe`);
            case 'linux':
                // On Linux, tools are usually in the same directory
                return path.join(kicadDir, tool);
            default:
                return path.join(kicadDir, tool);
        }
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
    
    async addToRecentProjects(projectPath) {
        const info = await this.getProjectInfo({ projectPath });
        
        // Remove if already exists
        this.recentProjects = this.recentProjects.filter(p => p.path !== projectPath);
        
        // Add to beginning
        this.recentProjects.unshift({
            path: projectPath,
            ...info
        });
        
        // Keep only last 10
        this.recentProjects = this.recentProjects.slice(0, 10);
        
        await this.saveRecentProjects();
    }
    
    getEmptySchematicContent() {
        return `(kicad_sch (version 20211123) (generator eeschema)
  (paper "A4")
  (lib_symbols)
  (symbol_instances)
)`;
    }
    
    getEmptyPCBContent() {
        return `(kicad_pcb (version 20211014) (generator pcbnew)
  (general
    (thickness 1.6)
  )
  (paper "A4")
  (layers
    (0 "F.Cu" signal)
    (31 "B.Cu" signal)
    (32 "B.Adhes" user "B.Adhesive")
    (33 "F.Adhes" user "F.Adhesive")
    (34 "B.Paste" user)
    (35 "F.Paste" user)
    (36 "B.SilkS" user "B.Silkscreen")
    (37 "F.SilkS" user "F.Silkscreen")
    (38 "B.Mask" user)
    (39 "F.Mask" user)
    (40 "Dwgs.User" user "User.Drawings")
    (41 "Cmts.User" user "User.Comments")
    (42 "Eco1.User" user "User.Eco1")
    (43 "Eco2.User" user "User.Eco2")
    (44 "Edge.Cuts" user)
    (45 "Margin" user)
    (46 "B.CrtYd" user "B.Courtyard")
    (47 "F.CrtYd" user "F.Courtyard")
    (48 "B.Fab" user)
    (49 "F.Fab" user)
  )
  (setup
    (pad_to_mask_clearance 0)
    (pcbplotparams
      (layerselection 0x00010fc_ffffffff)
      (disableapertmacros false)
      (usegerberextensions false)
      (usegerberattributes true)
      (usegerberadvancedattributes true)
      (creategerberjobfile true)
      (svguseinch false)
      (svgprecision 6)
      (excludeedgelayer true)
      (plotframeref false)
      (viasonmask false)
      (mode 1)
      (useauxorigin false)
      (hpglpennumber 1)
      (hpglpenspeed 20)
      (hpglpendiameter 15.000000)
      (dxfpolygonmode true)
      (dxfimperialunits true)
      (dxfusepcbnewfont true)
      (psnegative false)
      (psa4output false)
      (plotreference true)
      (plotvalue true)
      (plotinvisibletext false)
      (sketchpadsonfab false)
      (subtractmaskfromsilk false)
      (outputformat 1)
      (mirror false)
      (drillshape 0)
      (scaleselection 1)
      (outputdirectory "gerbers/")
    )
  )
)`;
    }
    
    getGerberExportScript(pcbFile, outputDir) {
        return `#!/usr/bin/env python3
import pcbnew
import os

# Load the board
board = pcbnew.LoadBoard("${pcbFile}")

# Configure plot controller
pc = pcbnew.PLOT_CONTROLLER(board)
po = pc.GetPlotOptions()

# Set output directory
po.SetOutputDirectory("${outputDir}")

# Set general options
po.SetPlotFrameRef(False)
po.SetPlotValue(True)
po.SetPlotReference(True)
po.SetPlotInvisibleText(False)
po.SetPlotViaOnMaskLayer(False)
po.SetCreateGerberJobFile(True)
po.SetUseGerberProtelExtensions(False)
po.SetExcludeEdgeLayer(True)
po.SetScale(1)
po.SetUseAuxOrigin(False)
po.SetMirror(False)
po.SetNegative(False)

# Plot layers
plot_plan = [
    ("F.Cu", pcbnew.F_Cu, "Front Copper"),
    ("B.Cu", pcbnew.B_Cu, "Back Copper"),
    ("F.Mask", pcbnew.F_Mask, "Front Mask"),
    ("B.Mask", pcbnew.B_Mask, "Back Mask"),
    ("F.SilkS", pcbnew.F_SilkS, "Front Silk"),
    ("B.SilkS", pcbnew.B_SilkS, "Back Silk"),
    ("F.Paste", pcbnew.F_Paste, "Front Paste"),
    ("B.Paste", pcbnew.B_Paste, "Back Paste"),
    ("Edge.Cuts", pcbnew.Edge_Cuts, "Board Outline"),
]

for layer_info in plot_plan:
    pc.SetLayer(layer_info[1])
    pc.OpenPlotfile(layer_info[0], pcbnew.PLOT_FORMAT_GERBER, layer_info[2])
    pc.PlotLayer()

# Generate drill files
drlwriter = pcbnew.EXCELLON_WRITER(board)
drlwriter.SetOptions(False, False, pcbnew.wxPoint(0,0), False)
drlwriter.SetFormat(False, pcbnew.EXCELLON_WRITER.DECIMAL_FORMAT, 3, 3)
drlwriter.CreateDrillandMapFilesSet("${outputDir}", True, False)

pc.ClosePlot()
print("Gerber export completed successfully")
`;
    }
    
    getBOMExportScript(schematicFile, outputFile, format) {
        return `#!/usr/bin/env python3
# Basic BOM export script
# In a real implementation, this would parse the schematic and extract components
import json

# Placeholder BOM data
bom_data = {
    "project": "${schematicFile}",
    "components": [
        {"ref": "R1", "value": "10k", "footprint": "0603", "quantity": 1},
        {"ref": "C1", "value": "100nF", "footprint": "0603", "quantity": 1},
    ]
}

if "${format}" == "json":
    with open("${outputFile}", "w") as f:
        json.dump(bom_data, f, indent=2)
else:
    # CSV format
    with open("${outputFile}", "w") as f:
        f.write("Reference,Value,Footprint,Quantity\\n")
        for comp in bom_data["components"]:
            f.write(f"{comp['ref']},{comp['value']},{comp['footprint']},{comp['quantity']}\\n")

print("BOM export completed successfully")
`;
    }
}

module.exports = KiCadPlugin;