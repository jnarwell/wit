/**
 * Fusion 360 Plugin for W.I.T. Universal Desktop Controller
 * Provides comprehensive integration with Autodesk Fusion 360 for professional CAD/CAM operations
 */

const { WITPlugin } = require('../../src/plugins/base/WITPlugin');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { glob } = require('glob');
const axios = require('axios');
const chokidar = require('chokidar');

class Fusion360Plugin extends WITPlugin {
    constructor(context) {
        super(context);
        
        this.fusion360Process = null;
        this.bridgeServer = null;
        this.fileWatcher = null;
        this.activeCommands = new Map();
        this.isLaunching = false;
        this.isQuitting = false;
        
        // Platform-specific Fusion 360 search patterns
        this.platformPaths = {
            darwin: [
                // Hidden library installation (most common)
                path.join(os.homedir(), 'Library/Application Support/Autodesk/webdeploy/production/*/Autodesk Fusion 360.app'),
                // Direct Applications folder (rare)
                '/Applications/Autodesk Fusion 360.app'
            ],
            win32: [
                // User-specific installations (most common)
                path.join(os.homedir(), 'AppData/Local/Autodesk/webdeploy/production/*/FusionLauncher.exe'),
                // Global installations
                'C:\\Program Files\\Autodesk\\webdeploy\\*\\FusionLauncher.exe',
                // Alternative path structure
                'C:\\Users\\*\\AppData\\Local\\Autodesk\\webdeploy\\production\\*\\FusionLauncher.exe'
            ],
            linux: [
                // Wine-based installations
                path.join(os.homedir(), '.wine/drive_c/users/*/AppData/Local/Autodesk/webdeploy/production/*/FusionLauncher.exe'),
                // Custom wrapper scripts
                path.join(os.homedir(), '.fusion360/bin/launcher.sh'),
                '/opt/fusion360/launcher.sh'
            ]
        };
    }
    
    async initialize() {
        await super.initialize();
        
        // Initialize config from manifest defaults if needed
        const manifestConfig = require('./manifest.json').config;
        
        // Set default Fusion 360 path based on platform  
        if (!this.config.fusion360Path) {
            const pathConfig = manifestConfig.fusion360Path;
            this.config.fusion360Path = pathConfig.platform[process.platform] || pathConfig.default || '';
        }
        
        // Set default workspace path
        if (!this.config.workspacePath) {
            this.config.workspacePath = manifestConfig.workspacePath.default.replace('~', os.homedir());
        }
        
        // Set other defaults
        this.setConfigDefaults(manifestConfig);
        
        // Expand home directory in workspace path
        if (this.config.workspacePath && this.config.workspacePath.startsWith('~')) {
            this.config.workspacePath = this.config.workspacePath.replace('~', os.homedir());
        }
        
        // Create workspace directory if it doesn't exist
        try {
            await fs.mkdir(this.config.workspacePath, { recursive: true });
        } catch (error) {
            this.log('Warning: Could not create workspace directory:', error.message);
        }
        
        // Check if Fusion 360 is installed
        await this.checkFusion360Installation();
        
        // Set up file watcher if enabled
        if (this.config.enableFileWatcher) {
            this.setupFileWatcher();
        }
        
        // Auto-launch Fusion 360 if configured
        if (this.config.autoLaunchFusion && !this.isQuitting) {
            this.launchFusionDelayed();
        }
        
        this.log('Fusion 360 plugin initialized');
    }
    
    setConfigDefaults(manifestConfig) {
        const defaults = {
            communicationPort: manifestConfig.communicationPort.default,
            enableAddInBridge: manifestConfig.enableAddInBridge.default,
            autoLaunchFusion: manifestConfig.autoLaunchFusion.default,
            enableCAM: manifestConfig.enableCAM.default,
            enableSimulation: manifestConfig.enableSimulation.default,
            enableGenerativeDesign: manifestConfig.enableGenerativeDesign.default,
            defaultTimeout: manifestConfig.defaultTimeout.default,
            enableFileWatcher: manifestConfig.enableFileWatcher.default,
            cloudSync: manifestConfig.cloudSync.default,
            enableTeamCollaboration: manifestConfig.enableTeamCollaboration.default
        };
        
        for (const [key, value] of Object.entries(defaults)) {
            if (this.config[key] === undefined) {
                this.config[key] = value;
            }
        }
    }
    
    async start() {
        try {
            await super.start();
            this.log('Fusion 360 plugin started successfully');
        } catch (error) {
            this.error('Failed to start Fusion 360 plugin:', error);
            throw error;
        }
    }
    
    async stop() {
        try {
            this.isQuitting = true;
            
            // Stop Fusion 360 process
            if (this.fusion360Process) {
                this.fusion360Process.kill();
                this.fusion360Process = null;
            }
            
            // Stop file watcher
            if (this.fileWatcher) {
                await this.fileWatcher.close();
                this.fileWatcher = null;
            }
            
            // Cancel active commands
            for (const [commandId, command] of this.activeCommands) {
                if (command.timeout) {
                    clearTimeout(command.timeout);
                }
            }
            this.activeCommands.clear();
            
            await super.stop();
            this.log('Fusion 360 plugin stopped successfully');
        } catch (error) {
            this.error('Error stopping Fusion 360 plugin:', error);
            throw error;
        }
    }
    
    async onMessage(message) {
        const { action, payload } = message;
        
        switch (action) {
            case 'launch':
                return await this.launchFusion360(payload);
                
            case 'getProjects':
                return await this.getProjects();
                
            case 'openProject':
                return await this.openProject(payload);
                
            case 'createProject':
                return await this.createProject(payload);
                
            case 'saveProject':
                return await this.saveProject(payload);
                
            case 'executeScript':
                return await this.executeScript(payload);
                
            case 'createModel':
                return await this.createModel(payload);
                
            case 'modifyModel':
                return await this.modifyModel(payload);
                
            case 'generateToolpaths':
                return await this.generateToolpaths(payload);
                
            case 'runSimulation':
                return await this.runSimulation(payload);
                
            case 'exportModel':
                return await this.exportModel(payload);
                
            case 'importModel':
                return await this.importModel(payload);
                
            case 'setParameters':
                return await this.setParameters(payload);
                
            case 'getParameters':
                return await this.getParameters();
                
            case 'renderModel':
                return await this.renderModel(payload);
                
            case 'optimizeDesign':
                return await this.optimizeDesign(payload);
                
            case 'generateDesign':
                return await this.generateDesign(payload);
                
            case 'setupCAM':
                return await this.setupCAM(payload);
                
            case 'postProcessCAM':
                return await this.postProcessCAM(payload);
                
            case 'validateDesign':
                return await this.validateDesign(payload);
                
            case 'collaborateProject':
                return await this.collaborateProject(payload);
                
            case 'syncToCloud':
                return await this.syncToCloud(payload);
                
            case 'getWorkspace':
                return await this.getWorkspace();
                
            case 'updateConfig':
                return await this.updateConfig(payload);
                
            case 'getStatus':
                return this.getStatus();
                
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }
    
    async checkFusion360Installation() {
        try {
            // If path is configured and exists, use it
            if (this.config.fusion360Path && !this.config.fusion360Path.includes('*')) {
                await fs.access(this.config.fusion360Path);
                this.log(`Fusion 360 found at: ${this.config.fusion360Path}`);
                return true;
            }
        } catch (error) {
            this.log('Configured Fusion 360 path not found, searching...');
        }
        
        // Try to find Fusion 360
        const found = await this.findFusion360();
        if (found) {
            this.config.fusion360Path = found;
            await this.saveData('config.json', this.config);
            this.log(`Fusion 360 found at: ${found}`);
            return true;
        }
        
        this.error('Fusion 360 not found. Please ensure Fusion 360 is installed.');
        return false;
    }
    
    async findFusion360() {
        const searchPaths = this.platformPaths[process.platform] || [];
        
        for (const searchPattern of searchPaths) {
            try {
                this.log(`Searching for Fusion 360 at: ${searchPattern}`);
                
                // Handle glob patterns for random hash folders
                if (searchPattern.includes('*')) {
                    const matches = await glob(searchPattern);
                    if (matches.length > 0) {
                        // Sort and return the most recent (lexicographically last) match
                        const sorted = matches.sort();
                        const candidate = sorted[sorted.length - 1];
                        
                        // Verify the file exists and is executable
                        await fs.access(candidate);
                        this.log(`Found Fusion 360 via glob: ${candidate}`);
                        return candidate;
                    }
                } else {
                    // Direct path check
                    await fs.access(searchPattern);
                    this.log(`Found Fusion 360 at direct path: ${searchPattern}`);
                    return searchPattern;
                }
            } catch (error) {
                this.log(`Search path failed: ${searchPattern} - ${error.message}`);
                continue;
            }
        }
        
        return null;
    }
    
    async launchFusion360(options = {}) {
        this.log('launchFusion360 called with options:', JSON.stringify(options));
        
        if (this.isLaunching) {
            throw new Error('Fusion 360 is already launching');
        }
        
        if (!await this.checkFusion360Installation()) {
            throw new Error('Fusion 360 not found. Please configure the Fusion 360 installation path.');
        }
        
        this.isLaunching = true;
        
        try {
            const args = [];
            
            // Add any startup options if supported
            if (options.startupOptions) {
                args.push(...options.startupOptions);
            }
            
            // Set workspace if specified
            if (options.workspace || this.config.workspacePath) {
                const workspace = options.workspace || this.config.workspacePath;
                // Note: Fusion 360 doesn't have command-line workspace options like MATLAB
                // This would need to be handled through the add-in bridge
            }
            
            this.log(`Launching Fusion 360 from: ${this.config.fusion360Path}`);
            this.log(`Launch args: ${JSON.stringify(args)}`);
            
            this.fusion360Process = spawn(this.config.fusion360Path, args, {
                detached: true,
                stdio: 'ignore'
            });
            
            this.fusion360Process.unref();
            
            // Set up process event handlers
            this.setupProcessHandlers();
            
            // Wait for Fusion 360 to start and the add-in bridge to be available
            if (this.config.enableAddInBridge) {
                await this.waitForAddInBridge();
            }
            
            this.log('Fusion 360 launched successfully');
            
            return {
                success: true,
                pid: this.fusion360Process.pid,
                bridgePort: this.config.enableAddInBridge ? this.config.communicationPort : null
            };
        } catch (error) {
            this.error('Failed to launch Fusion 360:', error);
            throw error;
        } finally {
            this.isLaunching = false;
        }
    }
    
    setupProcessHandlers() {
        if (!this.fusion360Process) return;
        
        this.fusion360Process.on('error', (error) => {
            this.error('Fusion 360 process error:', error);
            this.sendMessage({
                type: 'fusion360_error',
                data: `Fusion 360 process error: ${error.message}`,
                timestamp: Date.now()
            });
        });
        
        this.fusion360Process.on('close', (code) => {
            this.log('Fusion 360 process closed with code:', code);
            this.fusion360Process = null;
            
            this.sendMessage({
                type: 'fusion360_closed',
                code: code,
                timestamp: Date.now()
            });
        });
        
        this.fusion360Process.on('spawn', () => {
            this.log('Fusion 360 process spawned successfully');
            this.sendMessage({
                type: 'fusion360_launched',
                pid: this.fusion360Process.pid,
                timestamp: Date.now()
            });
        });
    }
    
    async waitForAddInBridge(timeout = 30000) {
        const startTime = Date.now();
        const bridgeUrl = `http://localhost:${this.config.communicationPort}`;
        
        this.log(`Waiting for add-in bridge at ${bridgeUrl}...`);
        
        while (Date.now() - startTime < timeout) {
            try {
                const response = await axios.get(`${bridgeUrl}/health`, { timeout: 2000 });
                if (response.status === 200) {
                    this.log('Add-in bridge is ready');
                    return true;
                }
            } catch (error) {
                // Bridge not ready yet, continue waiting
            }
            
            // Wait 1 second before trying again
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        this.log('Warning: Add-in bridge not responding within timeout');
        return false;
    }
    
    async sendBridgeCommand(command, parameters = {}, timeout = null) {
        if (!this.config.enableAddInBridge) {
            throw new Error('Add-in bridge is not enabled');
        }
        
        const bridgeUrl = `http://localhost:${this.config.communicationPort}`;
        const commandTimeout = timeout || this.config.defaultTimeout;
        
        try {
            this.log(`Sending bridge command: ${command}`, parameters);
            
            const response = await axios.post(`${bridgeUrl}/api/command`, {
                command,
                parameters,
                timeout: commandTimeout
            }, {
                timeout: commandTimeout
            });
            
            if (response.data.success) {
                return response.data.result;
            } else {
                throw new Error(response.data.error || 'Bridge command failed');
            }
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Fusion 360 add-in bridge not running. Please ensure the UDC Bridge add-in is installed and active.');
            }
            throw error;
        }
    }
    
    setupFileWatcher() {
        if (!this.config.workspacePath) {
            this.log('Workspace path not configured, skipping file watcher setup');
            return;
        }
        
        try {
            this.fileWatcher = chokidar.watch(this.config.workspacePath, {
                ignored: /[\/\\]\./,  // Ignore hidden files
                persistent: true,
                ignoreInitial: true
            });
            
            this.fileWatcher
                .on('add', path => {
                    this.log(`File added: ${path}`);
                    this.sendMessage({
                        type: 'file_added',
                        path: path,
                        timestamp: Date.now()
                    });
                })
                .on('change', path => {
                    this.log(`File changed: ${path}`);
                    this.sendMessage({
                        type: 'file_changed',
                        path: path,
                        timestamp: Date.now()
                    });
                })
                .on('unlink', path => {
                    this.log(`File removed: ${path}`);
                    this.sendMessage({
                        type: 'file_removed',
                        path: path,
                        timestamp: Date.now()
                    });
                })
                .on('error', error => {
                    this.error('File watcher error:', error);
                });
                
            this.log(`File watcher set up for: ${this.config.workspacePath}`);
        } catch (error) {
            this.error('Failed to set up file watcher:', error);
        }
    }
    
    launchFusionDelayed() {
        // Launch Fusion 360 after a delay to allow plugin to fully initialize
        setTimeout(async () => {
            try {
                if (this.started && !this.isQuitting) {
                    await this.launchFusion360();
                }
            } catch (error) {
                this.error('Failed to auto-launch Fusion 360:', error);
                // Don't re-throw to prevent plugin from stopping
            }
        }, 5000);
    }
    
    // Placeholder methods for future implementation
    async getProjects() {
        if (!this.config.enableAddInBridge) {
            return await this.getLocalProjects();
        }
        
        return await this.sendBridgeCommand('getProjects');
    }
    
    async getLocalProjects() {
        // Scan workspace for Fusion 360 project files
        try {
            const files = await fs.readdir(this.config.workspacePath);
            const projects = files
                .filter(file => file.endsWith('.f3d') || file.endsWith('.f3z'))
                .map(file => ({
                    name: path.parse(file).name,
                    file: file,
                    path: path.join(this.config.workspacePath, file),
                    type: path.extname(file).substring(1)
                }));
                
            return { projects, workspace: this.config.workspacePath };
        } catch (error) {
            throw new Error(`Failed to scan workspace: ${error.message}`);
        }
    }
    
    async openProject(payload) {
        const { projectPath } = payload;
        return await this.sendBridgeCommand('openProject', { projectPath });
    }
    
    async createProject(payload) {
        const { projectName, templateType } = payload;
        return await this.sendBridgeCommand('createProject', { projectName, templateType });
    }
    
    async executeScript(payload) {
        const { scriptCode, scriptType = 'python' } = payload;
        return await this.sendBridgeCommand('executeScript', { scriptCode, scriptType });
    }
    
    async createModel(payload) {
        const { modelType, parameters } = payload;
        return await this.sendBridgeCommand('createModel', { modelType, parameters });
    }
    
    async generateToolpaths(payload) {
        const { setupName, operations } = payload;
        return await this.sendBridgeCommand('generateToolpaths', { setupName, operations });
    }
    
    async runSimulation(payload) {
        const { simulationType, parameters } = payload;
        return await this.sendBridgeCommand('runSimulation', { simulationType, parameters });
    }
    
    async exportModel(payload) {
        const { format, filePath, options } = payload;
        return await this.sendBridgeCommand('exportModel', { format, filePath, options });
    }
    
    async updateConfig(newConfig) {
        // Update configuration
        this.config = { ...this.config, ...newConfig };
        
        // Save to persistent storage
        await this.saveData('config.json', this.config);
        
        // Handle path changes
        if (newConfig.fusion360Path) {
            await this.checkFusion360Installation();
        }
        
        if (newConfig.workspacePath) {
            try {
                await fs.mkdir(this.config.workspacePath, { recursive: true });
                
                // Restart file watcher if enabled
                if (this.config.enableFileWatcher) {
                    if (this.fileWatcher) {
                        await this.fileWatcher.close();
                    }
                    this.setupFileWatcher();
                }
            } catch (error) {
                this.log('Warning: Could not create new workspace directory:', error.message);
            }
        }
        
        this.log('Configuration updated:', this.config);
        
        // Emit config update event
        this.sendMessage({
            type: 'config_updated',
            config: this.config
        });
        
        return {
            success: true,
            config: this.config
        };
    }
    
    getStatus() {
        return {
            ...super.getStatus(),
            fusion360Installed: !!this.config.fusion360Path,
            fusion360Running: !!this.fusion360Process,
            fusion360Path: this.config.fusion360Path,
            bridgeEnabled: this.config.enableAddInBridge,
            bridgePort: this.config.communicationPort,
            workspace: this.config.workspacePath,
            fileWatcherActive: !!this.fileWatcher,
            activeCommands: this.activeCommands.size,
            enabledFeatures: {
                cam: this.config.enableCAM,
                simulation: this.config.enableSimulation,
                generativeDesign: this.config.enableGenerativeDesign,
                cloudSync: this.config.cloudSync,
                teamCollaboration: this.config.enableTeamCollaboration
            },
            config: this.config
        };
    }
    
    // Placeholder methods for future bridge implementation
    async saveProject(payload) { return await this.sendBridgeCommand('saveProject', payload); }
    async modifyModel(payload) { return await this.sendBridgeCommand('modifyModel', payload); }
    async importModel(payload) { return await this.sendBridgeCommand('importModel', payload); }
    async setParameters(payload) { return await this.sendBridgeCommand('setParameters', payload); }
    async getParameters() { return await this.sendBridgeCommand('getParameters'); }
    async renderModel(payload) { return await this.sendBridgeCommand('renderModel', payload); }
    async optimizeDesign(payload) { return await this.sendBridgeCommand('optimizeDesign', payload); }
    async generateDesign(payload) { return await this.sendBridgeCommand('generateDesign', payload); }
    async setupCAM(payload) { return await this.sendBridgeCommand('setupCAM', payload); }
    async postProcessCAM(payload) { return await this.sendBridgeCommand('postProcessCAM', payload); }
    async validateDesign(payload) { return await this.sendBridgeCommand('validateDesign', payload); }
    async collaborateProject(payload) { return await this.sendBridgeCommand('collaborateProject', payload); }
    async syncToCloud(payload) { return await this.sendBridgeCommand('syncToCloud', payload); }
    async getWorkspace() { return await this.sendBridgeCommand('getWorkspace'); }
}

module.exports = Fusion360Plugin;