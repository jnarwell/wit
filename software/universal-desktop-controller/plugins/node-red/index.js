/**
 * Node-RED Plugin for W.I.T. Universal Desktop Controller
 * Provides visual flow-based IoT automation and sensor integration
 */

const { WITPlugin } = require('../../src/plugins/base/WITPlugin');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const http = require('http');

class NodeREDPlugin extends WITPlugin {
    constructor(context) {
        super(context);
        
        this.nodeRedProcess = null;
        this.nodeRedPort = null;
        this.isStarting = false;
        this.adminAuthToken = null;
        this.witNodes = new Map(); // Track W.I.T. custom nodes
    }
    
    // Helper function to make HTTP requests without axios
    httpRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: options.headers || {},
                timeout: options.timeout || 5000
            };
            
            const req = http.request(requestOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const result = {
                            status: res.statusCode,
                            data: res.headers['content-type']?.includes('application/json') 
                                ? JSON.parse(data) 
                                : data
                        };
                        resolve(result);
                    } catch (error) {
                        resolve({ status: res.statusCode, data: data });
                    }
                });
            });
            
            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Request timeout')));
            
            if (options.data) {
                req.write(typeof options.data === 'string' ? options.data : JSON.stringify(options.data));
            }
            
            req.end();
        });
    }
    
    async initialize() {
        await super.initialize();
        
        // Initialize config with defaults from manifest
        const manifestConfig = require('./manifest.json').config;
        
        // Set default Node-RED path based on platform
        if (!this.config.nodeRedPath) {
            const pathConfig = manifestConfig.nodeRedPath;
            this.config.nodeRedPath = pathConfig.platform[process.platform] || pathConfig.default || '';
        }
        
        // Set default user directory
        if (!this.config.userDir) {
            this.config.userDir = manifestConfig.userDir.default.replace('~', os.homedir());
        }
        
        // Ensure user directory exists
        try {
            await fs.mkdir(this.config.userDir, { recursive: true });
            
            // Create W.I.T. specific directories
            await fs.mkdir(path.join(this.config.userDir, 'wit-flows'), { recursive: true });
            await fs.mkdir(path.join(this.config.userDir, 'wit-nodes'), { recursive: true });
        } catch (error) {
            this.log('Warning: Could not create user directory:', error.message);
        }
        
        // Check if Node-RED is installed
        await this.checkNodeREDInstallation();
        
        // Install W.I.T. custom nodes if needed
        await this.installWITNodes();
        
        // Auto-start if configured
        if (this.config.autoStart) {
            setTimeout(() => this.start(), 2000);
        }
        
        this.log('Node-RED plugin initialized');
    }
    
    async start() {
        try {
            await super.start();
            
            // Start Node-RED if configured
            if (this.config.autoStart) {
                await this.startNodeRED();
            }
            
            this.log('Node-RED plugin started successfully');
            
            // Emit status update to indicate plugin is active
            this.emit('plugin_status_update', {
                pluginId: this.id,
                status: 'active'
            });
        } catch (error) {
            this.error('Failed to start Node-RED plugin:', error);
            throw error;
        }
    }
    
    async stop() {
        try {
            // Stop Node-RED process
            if (this.nodeRedProcess) {
                await this.stopNodeRED();
            }
            
            await super.stop();
            this.log('Node-RED plugin stopped successfully');
        } catch (error) {
            this.error('Error stopping Node-RED plugin:', error);
            throw error;
        }
    }
    
    async onMessage(message) {
        const { action, payload } = message;
        
        switch (action) {
            case 'start':
                return await this.startNodeRED();
                
            case 'stop':
                return await this.stopNodeRED();
                
            case 'restart':
                return await this.restartNodeRED();
                
            case 'openEditor':
                return await this.openEditor();
                
            case 'getStatus':
                return await this.getNodeREDStatus();
                
            case 'getFlows':
                return await this.getFlows();
                
            case 'deployFlow':
                return await this.deployFlow(payload);
                
            case 'createFlow':
                return await this.createFlow(payload);
                
            case 'installNode':
                return await this.installNode(payload);
                
            case 'syncWithWIT':
                return await this.syncWithWIT();
                
            case 'createSensorFlow':
                return await this.createSensorFlow(payload);
                
            case 'createMachineFlow':
                return await this.createMachineFlow(payload);
                
            case 'createAutomationFlow':
                return await this.createAutomationFlow(payload);
                
            case 'updateConfig':
                return await this.updateConfig(payload);
                
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }
    
    async checkNodeREDInstallation() {
        try {
            // Check if Node-RED is installed globally
            const { stdout } = await this.executeCommand('npm list -g node-red');
            if (stdout.includes('node-red@')) {
                this.log('Node-RED found (global installation)');
                return true;
            }
        } catch (error) {
            this.log('Node-RED not found globally, checking local installation...');
        }
        
        // Check local installation
        try {
            await fs.access(path.join(__dirname, 'node_modules', 'node-red'));
            this.log('Node-RED found (local installation)');
            return true;
        } catch (error) {
            this.log('Node-RED not found locally');
            return false;
        }
    }
    
    async installWITNodes() {
        const nodesDir = path.join(this.config.userDir, 'wit-nodes');
        
        // Create W.I.T. sensor input node
        const sensorNodeContent = `
module.exports = function(RED) {
    function WITSensorNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        
        node.on('input', function(msg) {
            // Connect to W.I.T. sensor data
            msg.payload = {
                sensorId: config.sensorId,
                timestamp: Date.now(),
                data: msg.payload
            };
            node.send(msg);
        });
    }
    RED.nodes.registerType("wit-sensor", WITSensorNode);
}`;
        
        // Create W.I.T. machine control node
        const machineNodeContent = `
module.exports = function(RED) {
    function WITMachineNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        
        node.on('input', function(msg) {
            // Send commands to W.I.T. machines
            msg.payload = {
                machineId: config.machineId,
                command: msg.payload.command || config.defaultCommand,
                parameters: msg.payload.parameters || {}
            };
            node.send(msg);
        });
    }
    RED.nodes.registerType("wit-machine", WITMachineNode);
}`;
        
        try {
            await fs.writeFile(path.join(nodesDir, 'wit-sensor.js'), sensorNodeContent);
            await fs.writeFile(path.join(nodesDir, 'wit-machine.js'), machineNodeContent);
            
            // Create package.json for custom nodes
            const nodePackage = {
                name: "wit-custom-nodes",
                version: "1.0.0",
                description: "W.I.T. custom nodes for Node-RED",
                "node-red": {
                    nodes: {
                        "wit-sensor": "wit-sensor.js",
                        "wit-machine": "wit-machine.js"
                    }
                }
            };
            
            await fs.writeFile(
                path.join(nodesDir, 'package.json'), 
                JSON.stringify(nodePackage, null, 2)
            );
            
            this.log('W.I.T. custom nodes installed');
        } catch (error) {
            this.error('Failed to install W.I.T. nodes:', error);
        }
    }
    
    async startNodeRED() {
        if (this.nodeRedProcess) {
            return {
                success: true,
                message: 'Node-RED already running',
                port: this.nodeRedPort
            };
        }
        
        if (this.isStarting) {
            throw new Error('Node-RED is already starting');
        }
        
        this.isStarting = true;
        
        try {
            this.nodeRedPort = this.config.port || 1880;
            
            // Create settings file
            const settings = await this.createSettingsFile();
            
            // Start Node-RED
            const args = [
                '-p', this.nodeRedPort.toString(),
                '-u', this.config.userDir,
                '-s', settings
            ];
            
            this.log(`Starting Node-RED on port ${this.nodeRedPort}...`);
            
            // Determine the Node-RED executable path
            let nodeRedPath = 'node-red';
            
            // Check for local installation first
            const localNodeRed = path.join(__dirname, 'node_modules', '.bin', 'node-red');
            try {
                await fs.access(localNodeRed);
                nodeRedPath = localNodeRed;
                this.log('Using local Node-RED installation');
            } catch (error) {
                // Fall back to global installation
                this.log('Using global Node-RED installation');
            }
            
            this.nodeRedProcess = spawn(nodeRedPath, args, {
                cwd: this.config.userDir,
                env: { ...process.env }
            });
            
            // Handle Node-RED output
            this.nodeRedProcess.stdout.on('data', (data) => {
                const output = data.toString();
                this.log('Node-RED:', output);
                
                // Check if Node-RED is ready
                if (output.includes('Server now running at')) {
                    this.sendMessage({
                        type: 'node-red-started',
                        port: this.nodeRedPort,
                        url: `http://localhost:${this.nodeRedPort}`
                    });
                }
            });
            
            this.nodeRedProcess.stderr.on('data', (data) => {
                this.error('Node-RED Error:', data.toString());
            });
            
            this.nodeRedProcess.on('error', (error) => {
                this.error('Failed to start Node-RED:', error);
                this.nodeRedProcess = null;
                this.isStarting = false;
            });
            
            this.nodeRedProcess.on('close', (code) => {
                this.log('Node-RED process exited with code:', code);
                this.nodeRedProcess = null;
                this.nodeRedPort = null;
                
                this.sendMessage({
                    type: 'node-red-stopped',
                    code: code
                });
            });
            
            // Wait for Node-RED to be ready
            await this.waitForNodeRED();
            
            // Node-RED is ready for API calls
            this.log('Node-RED API ready');
            
            this.isStarting = false;
            
            // Sync with W.I.T. on startup
            if (this.config.witIntegration.autoDiscoverDevices) {
                setTimeout(() => this.syncWithWIT(), 2000);
            }
            
            return {
                success: true,
                port: this.nodeRedPort,
                url: `http://localhost:${this.nodeRedPort}`
            };
            
        } catch (error) {
            this.isStarting = false;
            this.error('Failed to start Node-RED:', error);
            throw error;
        }
    }
    
    async createSettingsFile() {
        const settingsPath = path.join(this.config.userDir, 'settings.js');
        
        const settings = `
module.exports = {
    uiPort: ${this.nodeRedPort},
    mqttReconnectTime: 15000,
    serialReconnectTime: 15000,
    debugMaxLength: 1000,
    flowFile: '${this.config.flowsFile}',
    userDir: '${this.config.userDir}',
    
    // Enable projects feature
    editorTheme: {
        projects: {
            enabled: ${this.config.enableProjects}
        }
    },
    
    // Function Globals
    functionGlobalContext: {
        // W.I.T. integration helpers
        wit: {
            apiUrl: 'http://localhost:8000',
            wsUrl: 'ws://localhost:8000/ws'
        }
    },
    
    // Logging
    logging: {
        console: {
            level: "info",
            metrics: false,
            audit: false
        }
    }
};`;
        
        await fs.writeFile(settingsPath, settings);
        return settingsPath;
    }
    
    async waitForNodeRED() {
        const maxAttempts = 30;
        const delay = 1000;
        const http = require('http');
        
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const isReady = await new Promise((resolve) => {
                    const req = http.get(`http://localhost:${this.nodeRedPort}/`, (res) => {
                        resolve(res.statusCode === 200);
                    });
                    
                    req.on('error', () => {
                        resolve(false);
                    });
                    
                    req.setTimeout(1000, () => {
                        req.destroy();
                        resolve(false);
                    });
                });
                
                if (isReady) {
                    this.log('Node-RED is ready');
                    return;
                }
            } catch (error) {
                // Node-RED not ready yet
            }
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        throw new Error('Node-RED failed to start within timeout');
    }
    
    async stopNodeRED() {
        if (!this.nodeRedProcess) {
            return { success: true, message: 'Node-RED not running' };
        }
        
        try {
            this.nodeRedProcess.kill('SIGTERM');
            
            // Wait for graceful shutdown
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Force kill if still running
            if (this.nodeRedProcess && !this.nodeRedProcess.killed) {
                this.nodeRedProcess.kill('SIGKILL');
            }
            
            this.nodeRedProcess = null;
            this.nodeRedPort = null;
            
            return { success: true };
        } catch (error) {
            this.error('Failed to stop Node-RED:', error);
            throw error;
        }
    }
    
    async restartNodeRED() {
        await this.stopNodeRED();
        await new Promise(resolve => setTimeout(resolve, 1000));
        return await this.startNodeRED();
    }
    
    async openEditor() {
        if (!this.nodeRedPort) {
            throw new Error('Node-RED not running');
        }
        
        const url = `http://localhost:${this.nodeRedPort}`;
        
        // Open in default browser
        const openCommand = process.platform === 'darwin' ? 'open' :
                           process.platform === 'win32' ? 'start' : 'xdg-open';
        
        spawn(openCommand, [url], { detached: true });
        
        return { success: true, url };
    }
    
    async getNodeREDStatus() {
        const status = {
            running: !!this.nodeRedProcess,
            port: this.nodeRedPort,
            url: this.nodeRedPort ? `http://localhost:${this.nodeRedPort}` : null,
            userDir: this.config.userDir,
            flowsFile: this.config.flowsFile,
            projectsEnabled: this.config.enableProjects
        };
        
        // Get flow statistics if running
        if (this.nodeRedProcess && this.apiClient) {
            try {
                const flows = await this.getFlows();
                status.flowCount = flows.length;
                status.nodeCount = flows.reduce((sum, flow) => sum + (flow.nodes || []).length, 0);
            } catch (error) {
                // Ignore errors
            }
        }
        
        return status;
    }
    
    async getFlows() {
        if (!this.nodeRedPort) {
            throw new Error('Node-RED not running');
        }
        
        try {
            const response = await this.httpRequest(`http://localhost:${this.nodeRedPort}/flows`);
            return response.data;
        } catch (error) {
            this.error('Failed to get flows:', error);
            throw error;
        }
    }
    
    async deployFlow(payload) {
        if (!this.nodeRedPort) {
            throw new Error('Node-RED not running');
        }
        
        const { flows } = payload;
        
        try {
            const response = await this.httpRequest(`http://localhost:${this.nodeRedPort}/flows`, {
                method: 'POST',
                headers: { 
                    'Node-RED-Deployment-Type': 'full',
                    'Content-Type': 'application/json'
                },
                data: flows
            });
            
            return {
                success: true,
                revision: response.data.rev
            };
        } catch (error) {
            this.error('Failed to deploy flow:', error);
            throw error;
        }
    }
    
    async createFlow(payload) {
        const { name, description, nodes } = payload;
        
        const flow = {
            id: this.generateId(),
            type: 'tab',
            label: name,
            info: description,
            disabled: false
        };
        
        // Add nodes to the flow
        const flowNodes = (nodes || []).map(node => ({
            ...node,
            z: flow.id,
            id: node.id || this.generateId()
        }));
        
        // Get current flows
        const currentFlows = await this.getFlows();
        
        // Add new flow and nodes
        const updatedFlows = [...currentFlows, flow, ...flowNodes];
        
        // Deploy
        return await this.deployFlow({ flows: updatedFlows });
    }
    
    async createSensorFlow(payload) {
        const { sensorId, sensorName, sensorType } = payload;
        
        // Create a flow for sensor data collection
        const nodes = [
            {
                type: 'wit-sensor',
                name: `${sensorName} Input`,
                sensorId: sensorId,
                x: 100,
                y: 100,
                wires: [['2']]
            },
            {
                id: '2',
                type: 'function',
                name: 'Process Sensor Data',
                func: `// Process ${sensorType} sensor data\nconst data = msg.payload;\n\n// Add processing logic here\ndata.processed = true;\ndata.timestamp = new Date().toISOString();\n\nmsg.payload = data;\nreturn msg;`,
                x: 300,
                y: 100,
                wires: [['3', '4']]
            },
            {
                id: '3',
                type: 'debug',
                name: 'Debug Output',
                active: true,
                x: 500,
                y: 80,
                wires: []
            },
            {
                id: '4',
                type: 'http request',
                name: 'Send to W.I.T.',
                method: 'POST',
                url: `http://localhost:8000/api/sensors/${sensorId}/data`,
                x: 500,
                y: 120,
                wires: [[]]
            }
        ];
        
        return await this.createFlow({
            name: `${sensorName} Flow`,
            description: `Automated data collection for ${sensorName} (${sensorType})`,
            nodes: nodes
        });
    }
    
    async createMachineFlow(payload) {
        const { machineId, machineName, machineType } = payload;
        
        // Create a flow for machine control
        const nodes = [
            {
                type: 'inject',
                name: 'Manual Trigger',
                payload: '{"command":"status"}',
                payloadType: 'json',
                repeat: '',
                crontab: '',
                once: false,
                x: 100,
                y: 100,
                wires: [['2']]
            },
            {
                id: '2',
                type: 'wit-machine',
                name: `${machineName} Control`,
                machineId: machineId,
                defaultCommand: 'status',
                x: 300,
                y: 100,
                wires: [['3']]
            },
            {
                id: '3',
                type: 'switch',
                name: 'Route by Status',
                property: 'payload.status',
                propertyType: 'msg',
                rules: [
                    { t: 'eq', v: 'error', vt: 'str' },
                    { t: 'eq', v: 'warning', vt: 'str' },
                    { t: 'else' }
                ],
                x: 500,
                y: 100,
                wires: [['4'], ['5'], ['6']]
            },
            {
                id: '4',
                type: 'function',
                name: 'Handle Error',
                func: 'msg.payload = {\n    alert: "error",\n    machine: msg.payload.machineId,\n    message: "Machine error detected"\n};\nreturn msg;',
                x: 700,
                y: 60,
                wires: [['7']]
            },
            {
                id: '5',
                type: 'function',
                name: 'Handle Warning',
                func: 'msg.payload = {\n    alert: "warning",\n    machine: msg.payload.machineId,\n    message: "Machine warning"\n};\nreturn msg;',
                x: 700,
                y: 100,
                wires: [['7']]
            },
            {
                id: '6',
                type: 'debug',
                name: 'Normal Status',
                x: 700,
                y: 140,
                wires: []
            },
            {
                id: '7',
                type: 'http request',
                name: 'Send Alert',
                method: 'POST',
                url: 'http://localhost:8000/api/alerts',
                x: 900,
                y: 80,
                wires: [[]]
            }
        ];
        
        return await this.createFlow({
            name: `${machineName} Control`,
            description: `Automated control and monitoring for ${machineName} (${machineType})`,
            nodes: nodes
        });
    }
    
    async createAutomationFlow(payload) {
        const { name, trigger, condition, action } = payload;
        
        // Create a general automation flow
        const nodes = [];
        let lastNodeId = null;
        let x = 100;
        
        // Add trigger node
        if (trigger.type === 'schedule') {
            nodes.push({
                id: '1',
                type: 'inject',
                name: 'Schedule Trigger',
                payload: '',
                payloadType: 'date',
                repeat: trigger.interval || '',
                crontab: trigger.cron || '',
                once: false,
                x: x,
                y: 100,
                wires: [['2']]
            });
            lastNodeId = '1';
            x += 200;
        }
        
        // Add condition node if specified
        if (condition) {
            nodes.push({
                id: '2',
                type: 'function',
                name: 'Check Condition',
                func: `// Check condition\nif (${condition}) {\n    return msg;\n}\nreturn null;`,
                x: x,
                y: 100,
                wires: [['3']]
            });
            lastNodeId = '2';
            x += 200;
        }
        
        // Add action node
        const actionNodeId = condition ? '3' : '2';
        if (action.type === 'http') {
            nodes.push({
                id: actionNodeId,
                type: 'http request',
                name: 'HTTP Action',
                method: action.method || 'POST',
                url: action.url,
                x: x,
                y: 100,
                wires: [['debug']]
            });
        } else if (action.type === 'function') {
            nodes.push({
                id: actionNodeId,
                type: 'function',
                name: 'Custom Action',
                func: action.code || '// Add your code here\nreturn msg;',
                x: x,
                y: 100,
                wires: [['debug']]
            });
        }
        
        // Add debug node
        nodes.push({
            id: 'debug',
            type: 'debug',
            name: 'Result',
            x: x + 200,
            y: 100,
            wires: []
        });
        
        return await this.createFlow({
            name: name,
            description: `Automation flow: ${name}`,
            nodes: nodes
        });
    }
    
    async syncWithWIT() {
        try {
            // Get sensors and machines from W.I.T. backend
            const [sensorsResponse, machinesResponse] = await Promise.all([
                this.httpRequest('http://localhost:8000/api/sensors'),
                this.httpRequest('http://localhost:8000/api/equipment')
            ]);
            
            const sensors = sensorsResponse.data;
            const machines = machinesResponse.data;
            
            // Create sensor monitoring flows
            for (const sensor of sensors) {
                await this.createSensorFlow({
                    sensorId: sensor.id,
                    sensorName: sensor.name,
                    sensorType: sensor.type
                });
            }
            
            // Create machine control flows
            for (const machine of machines) {
                await this.createMachineFlow({
                    machineId: machine.id,
                    machineName: machine.name,
                    machineType: machine.type
                });
            }
            
            return {
                success: true,
                sensorsImported: sensors.length,
                machinesImported: machines.length
            };
            
        } catch (error) {
            this.error('Failed to sync with W.I.T.:', error);
            throw error;
        }
    }
    
    async installNode(payload) {
        const { packageName } = payload;
        
        if (!packageName) {
            throw new Error('Package name is required');
        }
        
        try {
            // Install the node package
            await this.executeCommand(`npm install ${packageName}`, {
                cwd: this.config.userDir
            });
            
            // Restart Node-RED to load new nodes
            await this.restartNodeRED();
            
            return {
                success: true,
                message: `Installed ${packageName}`
            };
        } catch (error) {
            this.error('Failed to install node:', error);
            throw error;
        }
    }
    
    async updateConfig(newConfig) {
        // Update configuration
        this.config = { ...this.config, ...newConfig };
        
        // Save to persistent storage
        await this.saveData('config.json', this.config);
        
        // Restart Node-RED if port changed
        if (newConfig.port && this.nodeRedProcess) {
            await this.restartNodeRED();
        }
        
        return {
            success: true,
            config: this.config
        };
    }
    
    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }
    
    async executeCommand(command, options = {}) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, [], {
                shell: true,
                ...options
            });
            
            let stdout = '';
            let stderr = '';
            
            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            child.on('close', (code) => {
                if (code === 0) {
                    resolve({ stdout, stderr });
                } else {
                    reject(new Error(`Command failed with code ${code}: ${stderr}`));
                }
            });
            
            child.on('error', reject);
        });
    }
    
    getStatus() {
        return {
            ...super.getStatus(),
            nodeRedRunning: !!this.nodeRedProcess,
            nodeRedPort: this.nodeRedPort,
            nodeRedUrl: this.nodeRedPort ? `http://localhost:${this.nodeRedPort}` : null,
            userDir: this.config.userDir,
            projectsEnabled: this.config.enableProjects
        };
    }
}

module.exports = NodeREDPlugin;