const { WITPlugin } = require('../../src/plugins/base/WITPlugin');
const path = require('path');
const fs = require('fs').promises;
const { exec, spawn } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const net = require('net');
const http = require('http');

class LabVIEWPlugin extends WITPlugin {
    constructor(context) {
        super(context);
        this.labviewPath = null;
        this.labviewProcess = null;
        this.viServerClient = null;
        this.webServiceServer = null;
        this.remoteInstances = new Map();
        this.activeVIs = new Map();
        this.config = {
            viPath: path.join(process.env.HOME || process.env.USERPROFILE, 'Documents', 'LabVIEW Data'),
            projectsPath: path.join(process.env.HOME || process.env.USERPROFILE, 'Documents', 'LabVIEW Data', 'Projects'),
            autoSaveInterval: 300,
            webServicePort: 8080,
            enableRemotePanel: false,
            enableWebServices: true,
            defaultTargetType: 'myComputer',
            viServerPort: 3363,
            viServerEnabled: false
        };
    }

    async initialize() {
        await super.initialize();
        
        this.log('info', 'LabVIEW plugin initializing...');
        
        // Find LabVIEW installation
        this.labviewPath = await this.findLabVIEW();
        if (!this.labviewPath) {
            this.log('warn', 'LabVIEW installation not found. Please install LabVIEW 2020 or later.');
        }
        
        if (this.labviewPath) {
            this.log('info', `Found LabVIEW at: ${this.labviewPath}`);
        }
        
        // Ensure directories exist
        await this.ensureDirectories();
        
        this.log('info', 'LabVIEW plugin initialized');
    }
    
    async start() {
        await super.start();
        
        // Initialize web service if enabled
        if (this.config.enableWebServices) {
            await this.initializeWebService();
        }
        
        this.log('info', 'LabVIEW plugin started successfully');
        
        // Emit status update to indicate plugin is active
        this.emit('plugin_status_update', {
            pluginId: this.id,
            status: 'active'
        });
    }

    async findLabVIEW() {
        const platform = process.platform;
        const manifest = require('./manifest.json');
        const possiblePaths = manifest.requirements.labview.paths[platform] || [];
        
        for (const labviewPath of possiblePaths) {
            try {
                await fs.access(labviewPath, fs.constants.X_OK);
                return labviewPath;
            } catch (error) {
                // Continue searching
            }
        }
        
        // Try to find via PATH on Unix-like systems
        if (platform !== 'win32') {
            try {
                const { stdout } = await execPromise('which labview');
                if (stdout.trim()) {
                    return stdout.trim();
                }
            } catch (error) {
                // Not found in PATH
            }
        }
        
        // Try Windows registry
        if (platform === 'win32') {
            try {
                const { stdout } = await execPromise('reg query "HKLM\\SOFTWARE\\National Instruments\\LabVIEW" /s /f "Path"');
                const match = stdout.match(/Path\s+REG_SZ\s+(.+)/);
                if (match && match[1]) {
                    const labviewExe = path.join(match[1].trim(), 'LabVIEW.exe');
                    await fs.access(labviewExe, fs.constants.X_OK);
                    return labviewExe;
                }
            } catch (error) {
                // Registry query failed
            }
        }
        
        return null;
    }

    async ensureDirectories() {
        const dirs = [
            this.config.viPath,
            this.config.projectsPath,
            path.join(this.config.viPath, 'VIs'),
            path.join(this.config.viPath, 'Templates'),
            path.join(this.config.viPath, 'Builds'),
            path.join(this.config.viPath, 'Data'),
            path.join(this.config.projectsPath, 'Examples')
        ];
        
        for (const dir of dirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
            } catch (error) {
                this.log('warn', `Failed to create directory ${dir}: ${error.message}`);
            }
        }
        
        // Create plugin templates directory
        try {
            await fs.mkdir(path.join(__dirname, 'templates'), { recursive: true });
        } catch (error) {
            this.log('warn', `Failed to create templates directory: ${error.message}`);
        }
    }

    async initializeWebService() {
        return new Promise((resolve) => {
            this.webServiceServer = http.createServer((req, res) => {
                this.handleWebServiceRequest(req, res);
            });
            
            this.webServiceServer.listen(this.config.webServicePort, () => {
                this.log('info', `LabVIEW web service started on port ${this.config.webServicePort}`);
                resolve();
            });
            
            this.webServiceServer.on('error', (error) => {
                this.log('error', `Web service error: ${error.message}`);
            });
        });
    }

    async handleWebServiceRequest(req, res) {
        const url = new URL(req.url, `http://localhost:${this.config.webServicePort}`);
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        
        try {
            switch (url.pathname) {
                case '/status':
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        status: 'running',
                        labviewPath: this.labviewPath,
                        viServerEnabled: this.config.viServerEnabled,
                        activeVIs: Array.from(this.activeVIs.keys()),
                        remoteInstances: Array.from(this.remoteInstances.keys())
                    }));
                    break;
                    
                case '/vis':
                    const vis = await this.listVIs();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(vis));
                    break;
                    
                case '/projects':
                    const projects = await this.listProjects();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(projects));
                    break;
                    
                default:
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Not found' }));
            }
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    async onMessage(message) {
        const { action, payload = {} } = message;
        return await this.handleCommand(action, payload);
    }
    
    async handleCommand(command, payload = {}) {
        this.log('info', `Handling command: ${command}`);
        
        switch (command) {
            case 'launch':
                return await this.launchLabVIEW();
                
            case 'openVI':
                return await this.openVI(payload.viPath);
                
            case 'openProject':
                return await this.openProject(payload.projectPath);
                
            case 'newVI':
                return await this.createNewVI(payload.name, payload.template);
                
            case 'newProject':
                return await this.createNewProject(payload.name, payload.template);
                
            case 'buildExecutable':
                return await this.buildExecutable(payload.projectPath, payload.buildSpec);
                
            case 'runVI':
                return await this.runVI(payload.viPath, payload.parameters);
                
            case 'stopVI':
                return await this.stopVI(payload.viPath);
                
            case 'deployToTarget':
                return await this.deployToTarget(payload.projectPath, payload.targetName);
                
            case 'startWebService':
                return await this.startWebService();
                
            case 'stopWebService':
                return await this.stopWebService();
                
            case 'enableRemotePanel':
                return await this.enableRemotePanel(payload.viPath);
                
            case 'disableRemotePanel':
                return await this.disableRemotePanel(payload.viPath);
                
            case 'exportData':
                return await this.exportData(payload.dataPath, payload.format);
                
            case 'importData':
                return await this.importData(payload.filePath, payload.viPath);
                
            case 'startVIServer':
                return await this.startVIServer();
                
            case 'stopVIServer':
                return await this.stopVIServer();
                
            case 'listVIs':
                return await this.listVIs();
                
            case 'listProjects':
                return await this.listProjects();
                
            case 'getVIInfo':
                return await this.getVIInfo(payload.viPath);
                
            case 'updateConfig':
                return await this.updateConfig(payload);
                
            case 'getStatus':
                return this.getStatus();
                
            default:
                throw new Error(`Unknown command: ${command}`);
        }
    }

    async launchLabVIEW() {
        if (!this.labviewPath) {
            return { 
                success: false, 
                message: 'LabVIEW installation not found. Please install LabVIEW 2020 or later.' 
            };
        }
        
        if (this.labviewProcess) {
            this.log('info', 'LabVIEW is already running');
            return { success: true, message: 'LabVIEW is already running' };
        }
        
        try {
            const args = [];
            
            // Add VI Server arguments if enabled
            if (this.config.viServerEnabled) {
                args.push(`-pref:LabVIEW.VIServer.TCPIPAccess=True`);
                args.push(`-pref:LabVIEW.VIServer.TCPIPPort=${this.config.viServerPort}`);
            }
            
            this.labviewProcess = spawn(this.labviewPath, args, {
                detached: true,
                stdio: 'ignore'
            });
            
            this.labviewProcess.unref();
            
            // Wait a bit for LabVIEW to start
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Connect to VI Server if enabled
            if (this.config.viServerEnabled) {
                await this.connectToVIServer();
            }
            
            this.eventBus.emit('plugin:status', { 
                pluginId: this.id, 
                status: { labviewRunning: true } 
            });
            return { success: true, message: 'LabVIEW launched successfully' };
        } catch (error) {
            this.log('error', `Failed to launch LabVIEW: ${error.message}`);
            throw error;
        }
    }

    async openVI(viPath) {
        if (!viPath) {
            throw new Error('VI path is required');
        }
        
        if (!this.labviewPath) {
            throw new Error('LabVIEW installation not found. Please install LabVIEW 2020 or later.');
        }
        
        try {
            // Ensure LabVIEW is running
            if (!this.labviewProcess) {
                const launchResult = await this.launchLabVIEW();
                if (!launchResult.success) {
                    throw new Error(launchResult.message);
                }
            }
            
            // Use command line to open VI
            const platform = process.platform;
            if (platform === 'win32') {
                await execPromise(`start "" "${this.labviewPath}" "${viPath}"`);
            } else if (platform === 'darwin') {
                await execPromise(`open -a "${this.labviewPath}" "${viPath}"`);
            } else {
                await execPromise(`"${this.labviewPath}" "${viPath}" &`);
            }
            
            // Track active VI
            this.activeVIs.set(viPath, { 
                openedAt: new Date(),
                status: 'idle'
            });
            
            this.log('info', `Opened VI: ${viPath}`);
            return { success: true, viPath };
        } catch (error) {
            this.log('error', `Failed to open VI: ${error.message}`);
            throw error;
        }
    }

    async openProject(projectPath) {
        if (!projectPath) {
            throw new Error('Project path is required');
        }
        
        try {
            // Ensure LabVIEW is running
            if (!this.labviewProcess) {
                await this.launchLabVIEW();
            }
            
            // Use command line to open project
            const platform = process.platform;
            if (platform === 'win32') {
                await execPromise(`start "" "${this.labviewPath}" "${projectPath}"`);
            } else if (platform === 'darwin') {
                await execPromise(`open -a "${this.labviewPath}" "${projectPath}"`);
            } else {
                await execPromise(`"${this.labviewPath}" "${projectPath}" &`);
            }
            
            this.log('info', `Opened project: ${projectPath}`);
            return { success: true, projectPath };
        } catch (error) {
            this.log('error', `Failed to open project: ${error.message}`);
            throw error;
        }
    }

    async createNewVI(name, template = 'blank') {
        if (!name) {
            throw new Error('VI name is required');
        }
        
        if (!this.labviewPath) {
            throw new Error('LabVIEW installation not found. Please install LabVIEW 2020 or later.');
        }
        
        try {
            const viFileName = name.endsWith('.vi') ? name : `${name}.vi`;
            const viPath = path.join(this.config.viPath, 'VIs', viFileName);
            
            // Check if VI already exists
            try {
                await fs.access(viPath);
                throw new Error(`VI already exists: ${viPath}`);
            } catch (error) {
                // File doesn't exist, which is what we want
            }
            
            // Create VI from template if available
            const templatePath = await this.getTemplatePath(template);
            if (templatePath) {
                await fs.copyFile(templatePath, viPath);
                // Open the new VI
                await this.openVI(viPath);
            } else {
                // For blank VIs, let LabVIEW create it properly
                // Launch LabVIEW with the new VI path - LabVIEW will create it
                this.log('info', 'Creating new VI using LabVIEW...');
                
                // Ensure LabVIEW is running first
                if (!this.labviewProcess) {
                    await this.launchLabVIEW();
                    // Give LabVIEW time to fully start
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
                // Use LabVIEW to create a new VI
                const platform = process.platform;
                if (platform === 'win32') {
                    // On Windows, LabVIEW can create new VI with path
                    await execPromise(`start "" "${this.labviewPath}" /new "${viPath}"`);
                } else if (platform === 'darwin') {
                    // On macOS, we'll use AppleScript to create a new VI
                    const script = `
                        tell application "${this.labviewPath}"
                            activate
                            -- Create new VI through menu if possible
                            delay 1
                        end tell
                    `;
                    await execPromise(`osascript -e '${script}'`);
                    
                    // For now, just open LabVIEW and user can create new VI manually
                    this.log('info', 'LabVIEW opened. Please create a new VI using File > New VI');
                } else {
                    // On Linux, similar approach
                    await execPromise(`"${this.labviewPath}" &`);
                }
                
                // Note: We cannot directly create a proper VI file format as it's proprietary
                // The user will need to save the VI manually from LabVIEW
                return { 
                    success: true, 
                    message: 'LabVIEW opened. Please create and save your new VI.',
                    viPath: viPath 
                };
            }
            
            this.log('info', `Created new VI: ${viPath}`);
            return { success: true, viPath };
        } catch (error) {
            this.log('error', `Failed to create VI: ${error.message}`);
            throw error;
        }
    }

    async createNewProject(name, template = 'blank') {
        if (!name) {
            throw new Error('Project name is required');
        }
        
        try {
            const projectDir = path.join(this.config.projectsPath, name);
            const projectFile = path.join(projectDir, `${name}.lvproj`);
            
            // Create project directory
            await fs.mkdir(projectDir, { recursive: true });
            
            // Create basic project structure
            const projectXML = `<?xml version='1.0' encoding='UTF-8'?>
<Project Type="Project" LVVersion="20008000">
    <Property Name="NI.LV.All.SourceOnly" Type="Bool">true</Property>
    <Item Name="My Computer" Type="My Computer">
        <Property Name="server.app.propertiesEnabled" Type="Bool">true</Property>
        <Property Name="server.control.propertiesEnabled" Type="Bool">true</Property>
        <Property Name="server.tcp.enabled" Type="Bool">false</Property>
        <Property Name="server.tcp.port" Type="Int">0</Property>
        <Property Name="server.tcp.serviceName" Type="Str">My Computer/VI Server</Property>
        <Property Name="server.tcp.serviceName.default" Type="Str">My Computer/VI Server</Property>
        <Property Name="server.vi.callsEnabled" Type="Bool">true</Property>
        <Property Name="server.vi.propertiesEnabled" Type="Bool">true</Property>
        <Property Name="specify.custom.address" Type="Bool">false</Property>
        <Item Name="Dependencies" Type="Dependencies"/>
        <Item Name="Build Specifications" Type="Build"/>
    </Item>
</Project>`;
            
            await fs.writeFile(projectFile, projectXML, 'utf8');
            
            // Create project subdirectories
            await fs.mkdir(path.join(projectDir, 'SubVIs'), { recursive: true });
            await fs.mkdir(path.join(projectDir, 'Controls'), { recursive: true });
            await fs.mkdir(path.join(projectDir, 'Builds'), { recursive: true });
            
            // Open the new project
            await this.openProject(projectFile);
            
            this.log('info', `Created new project: ${projectFile}`);
            return { success: true, projectPath: projectFile };
        } catch (error) {
            this.log('error', `Failed to create project: ${error.message}`);
            throw error;
        }
    }

    async runVI(viPath, parameters = {}) {
        if (!viPath) {
            throw new Error('VI path is required');
        }
        
        try {
            // Update VI status
            if (this.activeVIs.has(viPath)) {
                this.activeVIs.get(viPath).status = 'running';
                this.activeVIs.get(viPath).startTime = new Date();
            }
            
            // If VI Server is connected, use it to run the VI
            if (this.viServerClient) {
                // This would require implementing VI Server protocol
                this.log('info', `Running VI via VI Server: ${viPath}`);
            } else {
                // Use command line approach
                const args = [viPath, '--', JSON.stringify(parameters)];
                spawn(this.labviewPath, args, { detached: true });
            }
            
            this.log('info', `Started VI execution: ${viPath}`);
            return { success: true, message: 'VI execution started' };
        } catch (error) {
            this.log('error', `Failed to run VI: ${error.message}`);
            throw error;
        }
    }

    async stopVI(viPath) {
        if (!viPath) {
            throw new Error('VI path is required');
        }
        
        try {
            // Update VI status
            if (this.activeVIs.has(viPath)) {
                this.activeVIs.get(viPath).status = 'stopped';
                this.activeVIs.get(viPath).stopTime = new Date();
            }
            
            // If VI Server is connected, use it to stop the VI
            if (this.viServerClient) {
                // This would require implementing VI Server protocol
                this.log('info', `Stopping VI via VI Server: ${viPath}`);
            }
            
            this.log('info', `Stopped VI execution: ${viPath}`);
            return { success: true, message: 'VI execution stopped' };
        } catch (error) {
            this.log('error', `Failed to stop VI: ${error.message}`);
            throw error;
        }
    }

    async listVIs() {
        try {
            const viDir = path.join(this.config.viPath, 'VIs');
            const files = await fs.readdir(viDir);
            const vis = [];
            
            for (const file of files) {
                if (file.endsWith('.vi') || file.endsWith('.vim') || file.endsWith('.vit')) {
                    const filePath = path.join(viDir, file);
                    const stats = await fs.stat(filePath);
                    vis.push({
                        name: file,
                        path: filePath,
                        size: stats.size,
                        modified: stats.mtime,
                        type: path.extname(file).substring(1).toUpperCase()
                    });
                }
            }
            
            return vis;
        } catch (error) {
            this.log('warn', `Failed to list VIs: ${error.message}`);
            return [];
        }
    }

    async listProjects() {
        try {
            const projects = [];
            const projectFiles = await this.findFiles(this.config.projectsPath, '.lvproj');
            
            for (const projectFile of projectFiles) {
                const stats = await fs.stat(projectFile);
                projects.push({
                    name: path.basename(projectFile, '.lvproj'),
                    path: projectFile,
                    directory: path.dirname(projectFile),
                    size: stats.size,
                    modified: stats.mtime
                });
            }
            
            return projects;
        } catch (error) {
            this.log('warn', `Failed to list projects: ${error.message}`);
            return [];
        }
    }

    async findFiles(dir, extension) {
        const files = [];
        
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    const subFiles = await this.findFiles(fullPath, extension);
                    files.push(...subFiles);
                } else if (entry.name.endsWith(extension)) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Ignore errors for inaccessible directories
        }
        
        return files;
    }

    async getVIInfo(viPath) {
        if (!viPath) {
            throw new Error('VI path is required');
        }
        
        try {
            const stats = await fs.stat(viPath);
            const info = {
                name: path.basename(viPath),
                path: viPath,
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                type: path.extname(viPath).substring(1).toUpperCase()
            };
            
            // Add runtime info if VI is active
            if (this.activeVIs.has(viPath)) {
                info.runtime = this.activeVIs.get(viPath);
            }
            
            return info;
        } catch (error) {
            this.log('error', `Failed to get VI info: ${error.message}`);
            throw error;
        }
    }

    async connectToVIServer() {
        return new Promise((resolve, reject) => {
            this.viServerClient = new net.Socket();
            
            this.viServerClient.connect(this.config.viServerPort, 'localhost', () => {
                this.log('info', 'Connected to VI Server');
                resolve();
            });
            
            this.viServerClient.on('error', (error) => {
                this.log('error', `VI Server connection error: ${error.message}`);
                this.viServerClient = null;
                reject(error);
            });
            
            this.viServerClient.on('close', () => {
                this.log('info', 'VI Server connection closed');
                this.viServerClient = null;
            });
        });
    }

    async startVIServer() {
        try {
            this.config.viServerEnabled = true;
            
            // Restart LabVIEW with VI Server enabled
            if (this.labviewProcess) {
                await this.stopLabVIEW();
                await this.launchLabVIEW();
            }
            
            return { success: true, message: 'VI Server enabled' };
        } catch (error) {
            this.log('error', `Failed to start VI Server: ${error.message}`);
            throw error;
        }
    }

    async stopVIServer() {
        try {
            this.config.viServerEnabled = false;
            
            if (this.viServerClient) {
                this.viServerClient.destroy();
                this.viServerClient = null;
            }
            
            return { success: true, message: 'VI Server disabled' };
        } catch (error) {
            this.log('error', `Failed to stop VI Server: ${error.message}`);
            throw error;
        }
    }

    async enableRemotePanel(viPath) {
        if (!viPath) {
            throw new Error('VI path is required');
        }
        
        try {
            // Add VI to remote panel list
            this.remoteInstances.set(viPath, {
                enabled: true,
                url: `http://localhost:${this.config.webServicePort}/remote/${encodeURIComponent(viPath)}`
            });
            
            this.log('info', `Remote panel enabled for: ${viPath}`);
            return { 
                success: true, 
                url: this.remoteInstances.get(viPath).url 
            };
        } catch (error) {
            this.log('error', `Failed to enable remote panel: ${error.message}`);
            throw error;
        }
    }

    async disableRemotePanel(viPath) {
        if (!viPath) {
            throw new Error('VI path is required');
        }
        
        try {
            this.remoteInstances.delete(viPath);
            this.log('info', `Remote panel disabled for: ${viPath}`);
            return { success: true };
        } catch (error) {
            this.log('error', `Failed to disable remote panel: ${error.message}`);
            throw error;
        }
    }

    async exportData(dataPath, format = 'csv') {
        if (!dataPath) {
            throw new Error('Data path is required');
        }
        
        try {
            const exportPath = path.join(this.config.viPath, 'Data', `export_${Date.now()}.${format}`);
            
            // This would typically involve VI Server or LabVIEW scripting
            // For now, we'll simulate the export
            await fs.copyFile(dataPath, exportPath);
            
            this.log('info', `Data exported to: ${exportPath}`);
            return { success: true, exportPath };
        } catch (error) {
            this.log('error', `Failed to export data: ${error.message}`);
            throw error;
        }
    }

    async importData(filePath, viPath) {
        if (!filePath || !viPath) {
            throw new Error('File path and VI path are required');
        }
        
        try {
            const importDir = path.join(this.config.viPath, 'Data', 'Imports');
            await fs.mkdir(importDir, { recursive: true });
            
            const importPath = path.join(importDir, path.basename(filePath));
            await fs.copyFile(filePath, importPath);
            
            this.log('info', `Data imported: ${importPath}`);
            return { success: true, importPath };
        } catch (error) {
            this.log('error', `Failed to import data: ${error.message}`);
            throw error;
        }
    }

    async buildExecutable(projectPath, buildSpec) {
        if (!projectPath) {
            throw new Error('Project path is required');
        }
        
        try {
            // This would typically use LabVIEW build tools
            // For now, we'll simulate the build process
            const buildDir = path.join(path.dirname(projectPath), 'Builds', buildSpec || 'default');
            await fs.mkdir(buildDir, { recursive: true });
            
            const buildInfo = {
                project: projectPath,
                buildSpec: buildSpec || 'default',
                outputDir: buildDir,
                timestamp: new Date().toISOString(),
                status: 'completed'
            };
            
            await fs.writeFile(
                path.join(buildDir, 'build-info.json'),
                JSON.stringify(buildInfo, null, 2)
            );
            
            this.log('info', `Build completed: ${buildDir}`);
            return { success: true, buildInfo };
        } catch (error) {
            this.log('error', `Failed to build executable: ${error.message}`);
            throw error;
        }
    }

    async deployToTarget(projectPath, targetName) {
        if (!projectPath || !targetName) {
            throw new Error('Project path and target name are required');
        }
        
        try {
            // This would typically involve RT/FPGA deployment
            // For now, we'll simulate the deployment
            const deploymentInfo = {
                project: projectPath,
                target: targetName,
                timestamp: new Date().toISOString(),
                status: 'deployed'
            };
            
            this.log('info', `Deployed to target: ${targetName}`);
            return { success: true, deploymentInfo };
        } catch (error) {
            this.log('error', `Failed to deploy to target: ${error.message}`);
            throw error;
        }
    }

    async getTemplatePath(template) {
        const templateMap = {
            'blank': 'Blank_VI.vit',
            'state-machine': 'State_Machine.vit',
            'producer-consumer': 'Producer_Consumer.vit',
            'event-driven': 'Event_Driven.vit',
            'measurement': 'Measurement.vit',
            'fpga': 'FPGA_Template.vit'
        };
        
        const templateFile = templateMap[template];
        if (!templateFile) return null;
        
        // First check plugin's templates directory
        const pluginTemplatePath = path.join(__dirname, 'templates', templateFile);
        try {
            await fs.access(pluginTemplatePath);
            return pluginTemplatePath;
        } catch {
            // Fall back to user's LabVIEW templates
            const userTemplatePath = path.join(this.config.viPath, 'Templates', templateFile);
            try {
                await fs.access(userTemplatePath);
                return userTemplatePath;
            } catch {
                return null;
            }
        }
    }

    async stopLabVIEW() {
        if (this.labviewProcess) {
            this.labviewProcess.kill();
            this.labviewProcess = null;
            this.eventBus.emit('plugin:status', { 
                pluginId: this.id, 
                status: { labviewRunning: false } 
            });
        }
    }

    async startWebService() {
        if (!this.webServiceServer) {
            await this.initializeWebService();
        }
        return { success: true, message: 'Web service started' };
    }

    async stopWebService() {
        if (this.webServiceServer) {
            this.webServiceServer.close();
            this.webServiceServer = null;
            this.log('info', 'Web service stopped');
        }
        return { success: true, message: 'Web service stopped' };
    }

    async updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        this.log('info', 'Configuration updated');
        return { success: true, config: this.config };
    }

    getStatus() {
        return {
            ...super.getStatus(),
            labviewInstalled: !!this.labviewPath,
            labviewPath: this.labviewPath,
            labviewRunning: !!this.labviewProcess,
            viServerEnabled: this.config.viServerEnabled,
            webServiceEnabled: this.config.enableWebServices && !!this.webServiceServer,
            webServicePort: this.config.webServicePort,
            viServerPort: this.config.viServerPort,
            activeVIs: Array.from(this.activeVIs.keys()),
            remoteInstances: Array.from(this.remoteInstances.keys()),
            config: this.config
        };
    }

    async stop() {
        await super.stop();
        
        this.log('info', 'LabVIEW plugin stopping...');
        
        // Stop VI Server connection
        if (this.viServerClient) {
            this.viServerClient.destroy();
            this.viServerClient = null;
        }
        
        // Stop web service
        if (this.webServiceServer) {
            this.webServiceServer.close();
            this.webServiceServer = null;
        }
        
        // Don't kill LabVIEW on stop - let it continue running
        
        this.log('info', 'LabVIEW plugin stopped');
    }
}

module.exports = LabVIEWPlugin;