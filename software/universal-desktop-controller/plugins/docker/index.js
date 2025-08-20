const { WITPlugin } = require('../../src/plugins/base/WITPlugin');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const util = require('util');
const execPromise = util.promisify(exec);

class DockerPlugin extends WITPlugin {
    constructor(context) {
        super(context);
        this.dockerPath = null;
        this.dockerDesktopPath = null;
        this.dockerDaemon = null;
        this.containers = new Map();
        this.images = new Map();
        this.networks = new Map();
        this.volumes = new Map();
        this.config = {
            autoStartDaemon: false,
            enableBuildkit: true,
            defaultRegistry: 'docker.io',
            composeProfiles: [],
            resourceLimits: {
                cpus: 4,
                memory: '8GB',
                swap: '1GB'
            },
            networkSettings: {
                enableIPv6: false,
                dnsServers: []
            }
        };
    }

    async initialize() {
        await super.initialize();
        
        this.log('info', 'Docker plugin initializing...');
        
        // Find Docker installations
        this.dockerPath = await this.findDockerCLI();
        this.dockerDesktopPath = await this.findDockerDesktop();
        
        if (!this.dockerPath) {
            this.log('warn', 'Docker CLI not found. Please install Docker.');
        } else {
            this.log('info', `Found Docker CLI at: ${this.dockerPath}`);
        }
        
        if (!this.dockerDesktopPath) {
            this.log('warn', 'Docker Desktop not found. CLI-only operations available.');
        } else {
            this.log('info', `Found Docker Desktop at: ${this.dockerDesktopPath}`);
        }
        
        // Load saved configuration
        const savedConfig = await this.loadData('config.json');
        if (savedConfig) {
            this.config = { ...this.config, ...savedConfig };
        }
        
        this.log('info', 'Docker plugin initialized');
    }
    
    async start() {
        await super.start();
        
        if (this.dockerPath || this.dockerDesktopPath) {
            // Test Docker daemon connection
            await this.testDockerConnection();
            
            this.log('info', 'Docker plugin started successfully');
            
            // Emit status update to indicate plugin is active
            this.emit('plugin_status_update', {
                pluginId: this.id,
                status: 'active'
            });
        } else {
            this.log('info', 'Docker plugin started but Docker not installed');
            
            // Emit status update to indicate plugin is inactive
            this.emit('plugin_status_update', {
                pluginId: this.id,
                status: 'inactive'
            });
        }
    }

    async findDockerCLI() {
        // Try to find docker CLI
        try {
            const { stdout } = await execPromise('which docker');
            if (stdout.trim()) {
                return stdout.trim();
            }
        } catch (error) {
            // Continue searching
        }
        
        // Try Windows where command
        if (process.platform === 'win32') {
            try {
                const { stdout } = await execPromise('where docker');
                if (stdout.trim()) {
                    return stdout.trim().split('\n')[0];
                }
            } catch (error) {
                // Continue searching
            }
        }
        
        return null;
    }

    async findDockerDesktop() {
        const platform = process.platform;
        const manifest = require('./manifest.json');
        const possiblePaths = manifest.requirements.docker.paths[platform] || [];
        
        // Expand environment variables in paths
        const expandedPaths = possiblePaths.map(p => {
            return p.replace(/%([^%]+)%/g, (match, varName) => process.env[varName] || match)
                    .replace(/\$HOME/g, os.homedir())
                    .replace(/\$\{HOME\}/g, os.homedir())
                    .replace(/~\//, os.homedir() + '/');
        });
        
        for (const dockerPath of expandedPaths) {
            try {
                await fs.access(dockerPath, fs.constants.X_OK);
                return dockerPath;
            } catch (error) {
                // Continue searching
            }
        }
        
        return null;
    }

    async testDockerConnection() {
        if (!this.dockerPath) return false;
        
        try {
            await execPromise(`"${this.dockerPath}" version --format json`);
            return true;
        } catch (error) {
            this.log('warn', 'Docker daemon not accessible:', error.message);
            return false;
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
                return await this.launchDockerDesktop();
                
            case 'getStatus':
                return this.getStatus();
                
            case 'listContainers':
                return await this.listContainers(payload);
                
            case 'listImages':
                return await this.listImages(payload);
                
            case 'createContainer':
                return await this.createContainer(payload);
                
            case 'startContainer':
                return await this.startContainer(payload);
                
            case 'stopContainer':
                return await this.stopContainer(payload);
                
            case 'restartContainer':
                return await this.restartContainer(payload);
                
            case 'removeContainer':
                return await this.removeContainer(payload);
                
            case 'buildImage':
                return await this.buildImage(payload);
                
            case 'pullImage':
                return await this.pullImage(payload);
                
            case 'pushImage':
                return await this.pushImage(payload);
                
            case 'removeImage':
                return await this.removeImage(payload);
                
            case 'getContainerLogs':
                return await this.getContainerLogs(payload);
                
            case 'execCommand':
                return await this.execCommand(payload);
                
            case 'inspectContainer':
                return await this.inspectContainer(payload);
                
            case 'inspectImage':
                return await this.inspectImage(payload);
                
            case 'getSystemInfo':
                return await this.getSystemInfo();
                
            case 'pruneSystem':
                return await this.pruneSystem(payload);
                
            case 'createNetwork':
                return await this.createNetwork(payload);
                
            case 'listNetworks':
                return await this.listNetworks();
                
            case 'removeNetwork':
                return await this.removeNetwork(payload);
                
            case 'createVolume':
                return await this.createVolume(payload);
                
            case 'listVolumes':
                return await this.listVolumes();
                
            case 'removeVolume':
                return await this.removeVolume(payload);
                
            case 'composeUp':
                return await this.composeUp(payload);
                
            case 'composeDown':
                return await this.composeDown(payload);
                
            case 'composePs':
                return await this.composePs(payload);
                
            case 'composeLogs':
                return await this.composeLogs(payload);
                
            default:
                throw new Error(`Unknown command: ${command}`);
        }
    }

    async launchDockerDesktop() {
        if (!this.dockerDesktopPath) {
            return { 
                success: false, 
                message: 'Docker Desktop not found. Please install Docker Desktop.' 
            };
        }
        
        try {
            this.log('info', 'Launching Docker Desktop...');
            
            const dockerProcess = spawn(this.dockerDesktopPath, [], {
                detached: true,
                stdio: 'ignore'
            });
            
            dockerProcess.unref();
            
            return {
                success: true,
                pid: dockerProcess.pid,
                message: 'Docker Desktop launched successfully'
            };
        } catch (error) {
            this.log('error', `Failed to launch Docker Desktop: ${error.message}`);
            throw error;
        }
    }

    async listContainers(payload = {}) {
        if (!this.dockerPath) {
            throw new Error('Docker CLI not available');
        }
        
        const { all = false } = payload;
        const flags = all ? '-a' : '';
        
        try {
            const { stdout } = await execPromise(
                `"${this.dockerPath}" ps ${flags} --format "table {{.ID}}\\t{{.Image}}\\t{{.Command}}\\t{{.CreatedAt}}\\t{{.Status}}\\t{{.Ports}}\\t{{.Names}}"`
            );
            
            const lines = stdout.trim().split('\n');
            if (lines.length <= 1) {
                return { success: true, containers: [] };
            }
            
            const containers = lines.slice(1).map(line => {
                const parts = line.split('\t');
                return {
                    id: parts[0],
                    image: parts[1],
                    command: parts[2],
                    created: parts[3],
                    status: parts[4],
                    ports: parts[5],
                    names: parts[6]
                };
            });
            
            return { success: true, containers };
        } catch (error) {
            this.log('error', `Failed to list containers: ${error.message}`);
            throw error;
        }
    }

    async listImages(payload = {}) {
        if (!this.dockerPath) {
            throw new Error('Docker CLI not available');
        }
        
        try {
            const { stdout } = await execPromise(
                `"${this.dockerPath}" images --format "table {{.Repository}}\\t{{.Tag}}\\t{{.ID}}\\t{{.CreatedAt}}\\t{{.Size}}"`
            );
            
            const lines = stdout.trim().split('\n');
            if (lines.length <= 1) {
                return { success: true, images: [] };
            }
            
            const images = lines.slice(1).map(line => {
                const parts = line.split('\t');
                return {
                    repository: parts[0],
                    tag: parts[1],
                    id: parts[2],
                    created: parts[3],
                    size: parts[4]
                };
            });
            
            return { success: true, images };
        } catch (error) {
            this.log('error', `Failed to list images: ${error.message}`);
            throw error;
        }
    }

    async createContainer(payload) {
        const { image, name, ports = [], volumes = [], environment = [], command = '' } = payload;
        
        if (!image) {
            throw new Error('Image name is required');
        }
        
        if (!this.dockerPath) {
            throw new Error('Docker CLI not available');
        }
        
        try {
            let dockerCmd = `"${this.dockerPath}" create`;
            
            if (name) {
                dockerCmd += ` --name "${name}"`;
            }
            
            // Add port mappings
            for (const port of ports) {
                dockerCmd += ` -p ${port}`;
            }
            
            // Add volume mounts
            for (const volume of volumes) {
                dockerCmd += ` -v "${volume}"`;
            }
            
            // Add environment variables
            for (const env of environment) {
                dockerCmd += ` -e "${env}"`;
            }
            
            dockerCmd += ` "${image}"`;
            
            if (command) {
                dockerCmd += ` ${command}`;
            }
            
            const { stdout } = await execPromise(dockerCmd);
            const containerId = stdout.trim();
            
            return {
                success: true,
                containerId,
                message: `Container created successfully: ${containerId}`
            };
        } catch (error) {
            this.log('error', `Failed to create container: ${error.message}`);
            throw error;
        }
    }

    async startContainer(payload) {
        const { containerId } = payload;
        
        if (!containerId) {
            throw new Error('Container ID is required');
        }
        
        if (!this.dockerPath) {
            throw new Error('Docker CLI not available');
        }
        
        try {
            await execPromise(`"${this.dockerPath}" start "${containerId}"`);
            
            return {
                success: true,
                containerId,
                message: `Container started successfully: ${containerId}`
            };
        } catch (error) {
            this.log('error', `Failed to start container: ${error.message}`);
            throw error;
        }
    }

    async stopContainer(payload) {
        const { containerId, timeout = 10 } = payload;
        
        if (!containerId) {
            throw new Error('Container ID is required');
        }
        
        if (!this.dockerPath) {
            throw new Error('Docker CLI not available');
        }
        
        try {
            await execPromise(`"${this.dockerPath}" stop -t ${timeout} "${containerId}"`);
            
            return {
                success: true,
                containerId,
                message: `Container stopped successfully: ${containerId}`
            };
        } catch (error) {
            this.log('error', `Failed to stop container: ${error.message}`);
            throw error;
        }
    }

    async restartContainer(payload) {
        const { containerId, timeout = 10 } = payload;
        
        if (!containerId) {
            throw new Error('Container ID is required');
        }
        
        if (!this.dockerPath) {
            throw new Error('Docker CLI not available');
        }
        
        try {
            await execPromise(`"${this.dockerPath}" restart -t ${timeout} "${containerId}"`);
            
            return {
                success: true,
                containerId,
                message: `Container restarted successfully: ${containerId}`
            };
        } catch (error) {
            this.log('error', `Failed to restart container: ${error.message}`);
            throw error;
        }
    }

    async removeContainer(payload) {
        const { containerId, force = false } = payload;
        
        if (!containerId) {
            throw new Error('Container ID is required');
        }
        
        if (!this.dockerPath) {
            throw new Error('Docker CLI not available');
        }
        
        try {
            const flags = force ? '-f' : '';
            await execPromise(`"${this.dockerPath}" rm ${flags} "${containerId}"`);
            
            return {
                success: true,
                containerId,
                message: `Container removed successfully: ${containerId}`
            };
        } catch (error) {
            this.log('error', `Failed to remove container: ${error.message}`);
            throw error;
        }
    }

    async buildImage(payload) {
        const { dockerfilePath, imageName, buildContext = '.', buildArgs = [] } = payload;
        
        if (!imageName) {
            throw new Error('Image name is required');
        }
        
        if (!this.dockerPath) {
            throw new Error('Docker CLI not available');
        }
        
        try {
            let dockerCmd = `"${this.dockerPath}" build`;
            
            if (dockerfilePath) {
                dockerCmd += ` -f "${dockerfilePath}"`;
            }
            
            // Add build arguments
            for (const arg of buildArgs) {
                dockerCmd += ` --build-arg "${arg}"`;
            }
            
            dockerCmd += ` -t "${imageName}" "${buildContext}"`;
            
            // This is a long-running command, so we might want to handle it differently
            const { stdout, stderr } = await execPromise(dockerCmd);
            
            return {
                success: true,
                imageName,
                output: stdout,
                error: stderr,
                message: `Image built successfully: ${imageName}`
            };
        } catch (error) {
            this.log('error', `Failed to build image: ${error.message}`);
            throw error;
        }
    }

    async pullImage(payload) {
        const { imageName } = payload;
        
        if (!imageName) {
            throw new Error('Image name is required');
        }
        
        if (!this.dockerPath) {
            throw new Error('Docker CLI not available');
        }
        
        try {
            const { stdout } = await execPromise(`"${this.dockerPath}" pull "${imageName}"`);
            
            return {
                success: true,
                imageName,
                output: stdout,
                message: `Image pulled successfully: ${imageName}`
            };
        } catch (error) {
            this.log('error', `Failed to pull image: ${error.message}`);
            throw error;
        }
    }

    async getContainerLogs(payload) {
        const { containerId, tail = 100, follow = false } = payload;
        
        if (!containerId) {
            throw new Error('Container ID is required');
        }
        
        if (!this.dockerPath) {
            throw new Error('Docker CLI not available');
        }
        
        try {
            let dockerCmd = `"${this.dockerPath}" logs`;
            
            if (tail) {
                dockerCmd += ` --tail ${tail}`;
            }
            
            if (follow) {
                dockerCmd += ` --follow`;
            }
            
            dockerCmd += ` "${containerId}"`;
            
            const { stdout } = await execPromise(dockerCmd);
            
            return {
                success: true,
                containerId,
                logs: stdout,
                message: `Logs retrieved for container: ${containerId}`
            };
        } catch (error) {
            this.log('error', `Failed to get container logs: ${error.message}`);
            throw error;
        }
    }

    async getSystemInfo() {
        if (!this.dockerPath) {
            throw new Error('Docker CLI not available');
        }
        
        try {
            const { stdout } = await execPromise(`"${this.dockerPath}" system info --format json`);
            const systemInfo = JSON.parse(stdout);
            
            return {
                success: true,
                systemInfo,
                message: 'Docker system information retrieved'
            };
        } catch (error) {
            this.log('error', `Failed to get system info: ${error.message}`);
            throw error;
        }
    }

    async listNetworks() {
        if (!this.dockerPath) {
            throw new Error('Docker CLI not available');
        }
        
        try {
            const { stdout } = await execPromise(
                `"${this.dockerPath}" network ls --format "table {{.ID}}\\t{{.Name}}\\t{{.Driver}}\\t{{.Scope}}"`
            );
            
            const lines = stdout.trim().split('\n');
            if (lines.length <= 1) {
                return { success: true, networks: [] };
            }
            
            const networks = lines.slice(1).map(line => {
                const parts = line.split('\t');
                return {
                    id: parts[0],
                    name: parts[1],
                    driver: parts[2],
                    scope: parts[3]
                };
            });
            
            return { success: true, networks };
        } catch (error) {
            this.log('error', `Failed to list networks: ${error.message}`);
            throw error;
        }
    }

    async listVolumes() {
        if (!this.dockerPath) {
            throw new Error('Docker CLI not available');
        }
        
        try {
            const { stdout } = await execPromise(
                `"${this.dockerPath}" volume ls --format "table {{.Driver}}\\t{{.Name}}"`
            );
            
            const lines = stdout.trim().split('\n');
            if (lines.length <= 1) {
                return { success: true, volumes: [] };
            }
            
            const volumes = lines.slice(1).map(line => {
                const parts = line.split('\t');
                return {
                    driver: parts[0],
                    name: parts[1]
                };
            });
            
            return { success: true, volumes };
        } catch (error) {
            this.log('error', `Failed to list volumes: ${error.message}`);
            throw error;
        }
    }

    getStatus() {
        return {
            ...super.getStatus(),
            dockerInstalled: !!this.dockerPath,
            dockerDesktopInstalled: !!this.dockerDesktopPath,
            dockerPath: this.dockerPath,
            dockerDesktopPath: this.dockerDesktopPath,
            config: this.config
        };
    }

    async stop() {
        await super.stop();
        
        // Clear any cached data
        this.containers.clear();
        this.images.clear();
        this.networks.clear();
        this.volumes.clear();
        
        this.log('info', 'Docker plugin stopped');
    }
}

module.exports = DockerPlugin;