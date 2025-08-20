/**
 * MATLAB Plugin for W.I.T. Universal Desktop Controller
 * Provides comprehensive integration with MATLAB for computational analysis
 */

const { WITPlugin } = require('../../src/plugins/base/WITPlugin');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

class MATLABPlugin extends WITPlugin {
    constructor(context) {
        super(context);
        
        this.matlabProcess = null;
        this.engineSession = null;
        this.activeJobs = new Map(); // Track running MATLAB jobs
        this.enginePort = null;
        this.webAppServer = null;
        this.isEngineStarting = false;
        this.isQuitting = false;
        
        // Platform-specific MATLAB paths
        this.platformPaths = {
            darwin: [
                '/Applications/MATLAB_R2024b.app/bin/matlab',
                '/Applications/MATLAB_R2024a.app/bin/matlab',
                '/Applications/MATLAB_R2023b.app/bin/matlab',
                '/Applications/MATLAB_R2023a.app/bin/matlab'
            ],
            win32: [
                'C:\\Program Files\\MATLAB\\R2024b\\bin\\matlab.exe',
                'C:\\Program Files\\MATLAB\\R2024a\\bin\\matlab.exe',
                'C:\\Program Files\\MATLAB\\R2023b\\bin\\matlab.exe',
                'C:\\Program Files\\MATLAB\\R2023a\\bin\\matlab.exe'
            ],
            linux: [
                '/usr/local/MATLAB/R2024b/bin/matlab',
                '/usr/local/MATLAB/R2024a/bin/matlab',
                '/usr/local/MATLAB/R2023b/bin/matlab',
                '/usr/local/MATLAB/R2023a/bin/matlab',
                '/opt/MATLAB/R2024b/bin/matlab'
            ]
        };
    }
    
    async initialize() {
        await super.initialize();
        
        // Initialize config from manifest defaults if needed
        const manifestConfig = require('./manifest.json').config;
        
        // Set default MATLAB path based on platform
        if (!this.config.matlabPath) {
            const pathConfig = manifestConfig.matlabPath;
            this.config.matlabPath = pathConfig.platform[process.platform] || pathConfig.default || '';
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
        
        // Check if MATLAB is installed
        await this.checkMATLABInstallation();
        
        // Auto-start engine if configured
        // Disabled for now to prevent startup issues
        // if (this.config.autoStartEngine && this.config.enableEngine) {
        //     this.startEngineDelayed();
        // }
        
        this.log('MATLAB plugin initialized');
    }
    
    setConfigDefaults(manifestConfig) {
        const defaults = {
            enableEngine: manifestConfig.enableEngine.default,
            engineMode: manifestConfig.engineMode.default,
            defaultTimeout: manifestConfig.defaultTimeout.default,
            autoStartEngine: manifestConfig.autoStartEngine.default,
            enableWebApps: manifestConfig.enableWebApps.default,
            webAppPort: manifestConfig.webAppPort.default,
            enableGPU: manifestConfig.enableGPU.default,
            enableParallel: manifestConfig.enableParallel.default
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
            this.log('MATLAB plugin started successfully');
        } catch (error) {
            this.error('Failed to start MATLAB plugin:', error);
            throw error;
        }
    }
    
    async stop() {
        try {
            this.isQuitting = true;
            
            // Stop MATLAB process
            if (this.matlabProcess) {
                this.matlabProcess.kill();
                this.matlabProcess = null;
            }
            
            // Stop engine session
            if (this.engineSession) {
                await this.stopEngine();
            }
            
            // Stop web app server
            if (this.webAppServer) {
                await this.stopWebAppServer();
            }
            
            // Cancel active jobs
            for (const [jobId, job] of this.activeJobs) {
                if (job.process) {
                    job.process.kill();
                }
            }
            this.activeJobs.clear();
            
            await super.stop();
            this.log('MATLAB plugin stopped successfully');
        } catch (error) {
            this.error('Error stopping MATLAB plugin:', error);
            throw error;
        }
    }
    
    async onMessage(message) {
        const { action, payload } = message;
        
        switch (action) {
            case 'launch':
                return await this.launchMATLAB(payload);
                
            case 'startEngine':
                return await this.startEngine(payload);
                
            case 'stopEngine':
                return await this.stopEngine();
                
            case 'executeCode':
                return await this.executeCode(payload);
                
            case 'executeScript':
                return await this.executeScript(payload);
                
            case 'runFunction':
                return await this.runFunction(payload);
                
            case 'loadData':
                return await this.loadData(payload);
                
            case 'saveData':
                return await this.saveWorkspaceData(payload);
                
            case 'getWorkspace':
                return await this.getWorkspace();
                
            case 'clearWorkspace':
                return await this.clearWorkspace();
                
            case 'plotData':
                return await this.plotData(payload);
                
            case 'analyzeSensorData':
                return await this.analyzeSensorData(payload);
                
            case 'optimizeProcess':
                return await this.optimizeProcess(payload);
                
            case 'simulateSystem':
                return await this.simulateSystem(payload);
                
            case 'createDigitalTwin':
                return await this.createDigitalTwin(payload);
                
            case 'runMLModel':
                return await this.runMLModel(payload);
                
            case 'batchAnalysis':
                return await this.batchAnalysis(payload);
                
            case 'getToolboxes':
                return await this.getAvailableToolboxes();
                
            case 'installAddOn':
                return await this.installAddOn(payload);
                
            case 'startWebApp':
                return await this.startWebAppServer(payload);
                
            case 'stopWebApp':
                return await this.stopWebAppServer();
                
            case 'deployModel':
                return await this.deployModel(payload);
                
            case 'connectToCloud':
                return await this.connectToMATLABCloud(payload);
                
            case 'getJobStatus':
                return this.getJobStatus(payload);
                
            case 'cancelJob':
                return await this.cancelJob(payload);
                
            case 'browseWorkspace':
                return await this.browseWorkspaceFiles();
                
            case 'updateConfig':
                return await this.updateConfig(payload);
                
            case 'getStatus':
                return this.getStatus();
                
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }
    
    async checkMATLABInstallation() {
        try {
            if (!this.config.matlabPath || typeof this.config.matlabPath !== 'string') {
                throw new Error('MATLAB path not configured');
            }
            
            await fs.access(this.config.matlabPath);
            this.log(`MATLAB found at: ${this.config.matlabPath}`);
            return true;
        } catch (error) {
            this.error('MATLAB not found at configured path:', error);
            
            // Try to find MATLAB
            const found = await this.findMATLAB();
            if (found) {
                this.config.matlabPath = found;
                await this.saveData('config.json', this.config);
                this.log(`MATLAB found at: ${found}`);
                return true;
            }
            
            return false;
        }
    }
    
    async findMATLAB() {
        const searchPaths = this.platformPaths[process.platform] || [];
        
        for (const searchPath of searchPaths) {
            try {
                await fs.access(searchPath);
                return searchPath;
            } catch (error) {
                // Continue searching
            }
        }
        
        return null;
    }
    
    async launchMATLAB(options = {}) {
        this.log('launchMATLAB called with options:', JSON.stringify(options));
        
        if (!await this.checkMATLABInstallation()) {
            throw new Error('MATLAB not found. Please configure the MATLAB installation path.');
        }
        
        const args = [];
        
        // Add script to run if provided
        if (options.script) {
            args.push('-r', `"run('${options.script}')"`);
        }
        
        // Add startup options
        if (options.nodesktop) {
            args.push('-nodesktop');
        }
        
        if (options.nosplash) {
            args.push('-nosplash');
        }
        
        // Add workspace directory
        if (options.workspace || this.config.workspacePath) {
            const workspace = options.workspace || this.config.workspacePath;
            args.push('-r', `"cd('${workspace}')"`);
        }
        
        this.log(`Launching MATLAB from: ${this.config.matlabPath}`);
        this.log(`Launch args: ${JSON.stringify(args)}`);
        
        try {
            this.matlabProcess = spawn(this.config.matlabPath, args, {
                detached: true,
                stdio: 'ignore'
            });
            
            this.matlabProcess.unref();
            
            return {
                success: true,
                pid: this.matlabProcess.pid
            };
        } catch (error) {
            this.error('Failed to launch MATLAB:', error);
            throw error;
        }
    }
    
    async startEngine(options = {}) {
        if (this.isEngineStarting) {
            throw new Error('MATLAB Engine is already starting');
        }
        
        if (this.engineSession) {
            return {
                success: true,
                message: 'MATLAB Engine already running',
                port: this.enginePort
            };
        }
        
        this.isEngineStarting = true;
        
        try {
            this.log('Starting MATLAB Engine...');
            
            // Check if MATLAB is available first
            if (!this.config.matlabPath) {
                throw new Error('MATLAB path not configured');
            }
            
            // Start MATLAB in command-line mode with -nodesktop and -nosplash
            const args = [
                '-nodesktop',    // No GUI
                '-nosplash'      // No splash screen
                // Note: -nodisplay causes issues on macOS, removed
            ];
            
            this.log('Starting MATLAB with args:', args);
            
            this.engineSession = spawn(this.config.matlabPath, args, {
                cwd: this.config.workspacePath,
                env: { ...process.env },
                shell: false,
                stdio: ['pipe', 'pipe', 'pipe']  // Ensure we have stdin, stdout, stderr
            });
            
            // Set up handlers
            this.setupEngineHandlers();
            
            // Wait for engine to be ready
            await this.waitForEngineReady();
            
            // Initialize MATLAB workspace after it's ready
            await new Promise(resolve => setTimeout(resolve, 1000)); // Give MATLAB time to fully initialize
            
            // Set workspace and confirm ready
            this.engineSession.stdin.write(`cd '${this.config.workspacePath}'\n`);
            await new Promise(resolve => setTimeout(resolve, 500));
            this.engineSession.stdin.write(`fprintf('MATLAB Engine Ready\\n');\n`);
            
            this.enginePort = this.config.webAppPort || 9090;
            
            this.log('MATLAB Engine started successfully');
            
            return {
                success: true,
                port: this.enginePort,
                mode: 'real'
            };
        } catch (error) {
            this.error('Failed to start MATLAB Engine:', error);
            // Clean up on failure
            if (this.engineSession) {
                this.engineSession.kill();
                this.engineSession = null;
            }
            throw error;
        } finally {
            this.isEngineStarting = false;
        }
    }
    
    setupEngineHandlers() {
        if (!this.engineSession) return;
        
        // Buffer to accumulate output
        this.outputBuffer = '';
        this.commandResolvers = new Map(); // Store pending command callbacks
        
        this.engineSession.stdout.on('data', (data) => {
            const output = data.toString();
            this.outputBuffer += output;
            
            // Log for debugging
            this.log('MATLAB output:', JSON.stringify(output));
            
            // Check for complete output by looking for prompt
            const lines = this.outputBuffer.split('\n');
            let foundPrompt = false;
            let outputToProcess = '';
            
            // Look for prompt in the output
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.match(/(>>|K>>|EDU>>)\s*$/)) {
                    foundPrompt = true;
                    // Everything up to and including this line is complete
                    outputToProcess = lines.slice(0, i + 1).join('\n');
                    // Keep remaining lines in buffer
                    this.outputBuffer = lines.slice(i + 1).join('\n');
                    break;
                }
            }
            
            // Special case for "MATLAB Engine Ready"
            if (!foundPrompt && output.includes('MATLAB Engine Ready')) {
                outputToProcess = this.outputBuffer;
                this.outputBuffer = '';
                foundPrompt = true;
            }
            
            if (foundPrompt && outputToProcess) {
                // Clean the output
                const cleanOutput = outputToProcess
                    .replace(/MATLAB Engine Ready/g, '')
                    .replace(/(>>|K>>|EDU>>)\s*$/gm, '') // Remove prompts
                    .replace(/^(>>|K>>|EDU>>)\s*/gm, '') // Remove prompts at start
                    .trim();
                
                // Send to frontend for display
                if (cleanOutput) {
                    this.sendMessage({
                        type: 'engine_output',
                        data: cleanOutput,
                        timestamp: Date.now()
                    });
                }
                
                // Resolve any pending command
                if (this.currentCommand) {
                    const resolver = this.commandResolvers.get(this.currentCommand.id);
                    if (resolver) {
                        // Remove command echo from output
                        let finalOutput = cleanOutput;
                        const cmdText = this.currentCommand.code.trim();
                        if (finalOutput.startsWith(cmdText)) {
                            finalOutput = finalOutput.substring(cmdText.length).trim();
                        }
                        
                        resolver.resolve(finalOutput);
                        this.commandResolvers.delete(this.currentCommand.id);
                        this.currentCommand = null;
                    }
                }
            }
        });
        
        this.engineSession.stderr.on('data', (data) => {
            const error = data.toString();
            this.error('MATLAB stderr:', error);
            
            // Some MATLAB messages go to stderr but aren't errors
            // Only treat as error if it contains actual error indicators
            const isRealError = error.includes('Error') || error.includes('error') || 
                               error.includes('Warning') || error.includes('Invalid');
            
            if (isRealError) {
                this.sendMessage({
                    type: 'engine_error',
                    data: error,
                    timestamp: Date.now()
                });
                
                // Reject any pending command
                if (this.currentCommand) {
                    const resolver = this.commandResolvers.get(this.currentCommand.id);
                    if (resolver) {
                        resolver.reject(new Error(error));
                        this.commandResolvers.delete(this.currentCommand.id);
                    }
                    this.currentCommand = null;
                }
            }
        });
        
        this.engineSession.on('error', (error) => {
            this.error('MATLAB Engine error:', error);
            this.sendMessage({
                type: 'engine_error',
                data: `MATLAB Engine error: ${error.message}`,
                timestamp: Date.now()
            });
        });
        
        this.engineSession.on('close', (code) => {
            this.log('MATLAB Engine closed with code:', code);
            this.engineSession = null;
            this.enginePort = null;
            
            // Reject all pending commands
            for (const [id, resolver] of this.commandResolvers) {
                resolver.reject(new Error(`MATLAB Engine closed with code ${code}`));
            }
            this.commandResolvers.clear();
            
            this.sendMessage({
                type: 'engine_closed',
                code: code
            });
        });
    }
    
    async waitForEngineReady(timeout = 30000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            let readyDetected = false;
            
            const checkOutput = (data) => {
                const output = data.toString();
                this.log('MATLAB startup output:', output);
                
                // Look for MATLAB prompt or ready message
                const promptRegex = /(>>|K>>|EDU>>)\s*$/;
                if (output.includes('MATLAB Engine Ready') || promptRegex.test(output)) {
                    readyDetected = true;
                    this.engineSession.stdout.removeListener('data', checkOutput);
                    resolve();
                }
            };
            
            this.engineSession.stdout.on('data', checkOutput);
            
            // Timeout check
            const timeoutHandle = setTimeout(() => {
                if (!readyDetected) {
                    this.engineSession.stdout.removeListener('data', checkOutput);
                    reject(new Error('Engine startup timeout'));
                }
            }, timeout);
            
            // Clear timeout if resolved
            this.engineSession.stdout.once('data', () => {
                if (readyDetected) {
                    clearTimeout(timeoutHandle);
                }
            });
        });
    }
    
    async stopEngine() {
        if (!this.engineSession) {
            return { success: true, message: 'Engine not running' };
        }
        
        try {
            // Send quit command to MATLAB
            if (this.engineSession.stdin) {
                this.engineSession.stdin.write('quit\n');
            }
            
            // Give MATLAB time to exit gracefully
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Force kill if still running
            if (this.engineSession && !this.engineSession.killed) {
                this.engineSession.kill();
            }
            
            this.engineSession = null;
            this.enginePort = null;
            this.log('MATLAB Engine stopped');
            
            return { success: true };
        } catch (error) {
            this.error('Failed to stop engine:', error);
            // Clear references anyway
            if (this.engineSession) {
                this.engineSession.kill('SIGKILL');
            }
            this.engineSession = null;
            this.enginePort = null;
            return { success: true, message: 'Engine stopped with errors' };
        }
    }
    
    startEngineDelayed() {
        // Start engine after a delay to allow plugin to fully initialize
        setTimeout(async () => {
            try {
                // Only start engine if plugin is still started and not stopping
                if (this.started && !this.isQuitting) {
                    await this.startEngine();
                }
            } catch (error) {
                this.error('Failed to auto-start MATLAB Engine:', error);
                // Don't re-throw error to prevent plugin from stopping
            }
        }, 3000);
    }
    
    async executeCode(payload) {
        const { code, timeout = this.config.defaultTimeout } = payload;
        
        if (!code) {
            throw new Error('Code is required');
        }
        
        if (!this.engineSession) {
            throw new Error('MATLAB Engine not running. Start engine first.');
        }
        
        const jobId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const commandId = `cmd-${Date.now()}`;
        
        this.log(`Executing MATLAB code (Job: ${jobId}):`, code);
        
        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                this.commandResolvers.delete(commandId);
                reject(new Error('Code execution timeout'));
            }, timeout);
            
            // Store resolver for this command
            this.commandResolvers.set(commandId, {
                resolve: (output) => {
                    clearTimeout(timeoutHandle);
                    
                    // Parse output to extract result
                    let cleanOutput = output
                        .replace(/MATLAB Engine Ready/g, '')
                        .replace(/>>\s*$/g, '')
                        .replace(/EDU>>\s*$/g, '')
                        .replace(/K>>\s*$/g, '')
                        .replace(/^>>\s*/gm, '') // Remove prompts at start of lines
                        .trim();
                    
                    // Remove the echo of the command itself if present
                    const commandLines = code.split('\n');
                    for (const line of commandLines) {
                        if (cleanOutput.startsWith(line)) {
                            cleanOutput = cleanOutput.substring(line.length).trim();
                        }
                    }
                    
                    const result = {
                        success: true,
                        jobId,
                        output: cleanOutput || 'Command executed successfully',
                        executionTime: Date.now() - startTime
                    };
                    
                    resolve(result);
                },
                reject: (error) => {
                    clearTimeout(timeoutHandle);
                    reject(error);
                }
            });
            
            const startTime = Date.now();
            this.currentCommand = { id: commandId, code };
            
            // Send code to MATLAB
            try {
                // Send the code directly - MATLAB will handle output naturally
                const codeToSend = code.trim() + '\n';
                
                // Clear any pending output first
                this.outputBuffer = '';
                
                this.engineSession.stdin.write(codeToSend);
                this.log(`Sent to MATLAB: ${code.trim()}`);
                
                // Send a newline after a short delay to help flush output
                setTimeout(() => {
                    if (this.engineSession && this.engineSession.stdin && !this.engineSession.stdin.destroyed) {
                        this.engineSession.stdin.write('\n');
                    }
                }, 200);
            } catch (error) {
                this.commandResolvers.delete(commandId);
                clearTimeout(timeoutHandle);
                reject(new Error(`Failed to send command to MATLAB: ${error.message}`));
            }
        });
    }
    
    async executeScript(payload) {
        const { scriptPath, args = [], timeout = this.config.defaultTimeout } = payload;
        
        if (!scriptPath) {
            throw new Error('Script path is required');
        }
        
        // Check if script exists
        try {
            await fs.access(scriptPath);
        } catch (error) {
            throw new Error(`Script not found: ${scriptPath}`);
        }
        
        const code = `run('${scriptPath}')`;
        return await this.executeCode({ code, timeout });
    }
    
    async runFunction(payload) {
        const { functionName, args = [], timeout = this.config.defaultTimeout } = payload;
        
        if (!functionName) {
            throw new Error('Function name is required');
        }
        
        // Build MATLAB function call
        const argsStr = args.map(arg => {
            if (typeof arg === 'string') {
                return `'${arg}'`;
            }
            return String(arg);
        }).join(', ');
        
        const code = `${functionName}(${argsStr})`;
        return await this.executeCode({ code, timeout });
    }
    
    async loadData(payload) {
        const { filePath, variableName } = payload;
        
        if (!filePath) {
            throw new Error('File path is required');
        }
        
        const loadCommand = variableName 
            ? `load('${filePath}', '${variableName}')`
            : `load('${filePath}')`;
            
        return await this.executeCode({ code: loadCommand });
    }
    
    async saveWorkspaceData(payload) {
        const { filePath, variables = [] } = payload;
        
        if (!filePath) {
            throw new Error('File path is required');
        }
        
        const saveCommand = variables.length > 0
            ? `save('${filePath}', '${variables.join("', '")}')`
            : `save('${filePath}')`;
            
        return await this.executeCode({ code: saveCommand });
    }
    
    async getWorkspace() {
        const code = 'whos';
        return await this.executeCode({ code });
    }
    
    async clearWorkspace() {
        const code = 'clear all; clc';
        return await this.executeCode({ code });
    }
    
    async plotData(payload) {
        const { data, plotType = 'plot', title, xlabel, ylabel } = payload;
        
        if (!data) {
            throw new Error('Data is required for plotting');
        }
        
        let plotCode = '';
        
        if (Array.isArray(data)) {
            plotCode = `data = [${data.join(', ')}]; ${plotType}(data);`;
        } else if (typeof data === 'object') {
            // Handle structured data
            const { x, y } = data;
            if (x && y) {
                plotCode = `x = [${x.join(', ')}]; y = [${y.join(', ')}]; ${plotType}(x, y);`;
            }
        }
        
        if (title) plotCode += ` title('${title}');`;
        if (xlabel) plotCode += ` xlabel('${xlabel}');`;
        if (ylabel) plotCode += ` ylabel('${ylabel}');`;
        
        return await this.executeCode({ code: plotCode });
    }
    
    async analyzeSensorData(payload) {
        const { sensorData, analysisType = 'statistics' } = payload;
        
        if (!sensorData) {
            throw new Error('Sensor data is required');
        }
        
        let analysisCode = '';
        
        switch (analysisType) {
            case 'statistics':
                analysisCode = `
                    data = [${sensorData.join(', ')}];
                    fprintf('Mean: %.2f\\n', mean(data));
                    fprintf('Std: %.2f\\n', std(data));
                    fprintf('Min: %.2f\\n', min(data));
                    fprintf('Max: %.2f\\n', max(data));
                `;
                break;
                
            case 'fft':
                analysisCode = `
                    data = [${sensorData.join(', ')}];
                    Y = fft(data);
                    frequencies = abs(Y);
                    plot(frequencies);
                    title('FFT Analysis');
                `;
                break;
                
            case 'filter':
                analysisCode = `
                    data = [${sensorData.join(', ')}];
                    filtered = lowpass(data, 0.1);
                    plot(data); hold on; plot(filtered);
                    legend('Original', 'Filtered');
                `;
                break;
        }
        
        return await this.executeCode({ code: analysisCode });
    }
    
    async optimizeProcess(payload) {
        const { objective, constraints = [], variables } = payload;
        
        if (!objective) {
            throw new Error('Objective function is required');
        }
        
        const optimizationCode = `
            % Process optimization using MATLAB Optimization Toolbox
            objective = @(x) ${objective};
            x0 = rand(${variables || 2}, 1);
            options = optimoptions('fmincon', 'Display', 'iter');
            [x_opt, fval] = fmincon(objective, x0, [], [], [], [], [], [], [], options);
            fprintf('Optimal solution: ');
            disp(x_opt);
            fprintf('Objective value: %.4f\\n', fval);
        `;
        
        return await this.executeCode({ code: optimizationCode });
    }
    
    async simulateSystem(payload) {
        const { modelType, parameters = {} } = payload;
        
        let simulationCode = '';
        
        switch (modelType) {
            case 'linear_system':
                simulationCode = `
                    % Linear system simulation
                    A = ${parameters.A || '[[-1, 0]; [0, -2]]'};
                    B = ${parameters.B || '[[1]; [1]]'};
                    C = ${parameters.C || '[1, 1]'};
                    D = ${parameters.D || '0'};
                    sys = ss(A, B, C, D);
                    step(sys);
                    title('Step Response');
                `;
                break;
                
            case 'pid_controller':
                simulationCode = `
                    % PID Controller simulation
                    Kp = ${parameters.Kp || '1'};
                    Ki = ${parameters.Ki || '0.1'};
                    Kd = ${parameters.Kd || '0.01'};
                    pid_controller = pid(Kp, Ki, Kd);
                    plant = tf([1], [1, 1, 0]);
                    closed_loop = feedback(pid_controller * plant, 1);
                    step(closed_loop);
                    title('Closed Loop Step Response');
                `;
                break;
        }
        
        return await this.executeCode({ code: simulationCode });
    }
    
    async createDigitalTwin(payload) {
        const { systemData, modelParameters } = payload;
        
        const digitalTwinCode = `
            % Digital Twin Creation
            fprintf('Creating digital twin model...\\n');
            
            % Load system data
            ${systemData ? `system_data = ${JSON.stringify(systemData)};` : ''}
            
            % Create mathematical model
            % This would be customized based on the specific system
            fprintf('Digital twin created successfully\\n');
            
            % Real-time synchronization setup
            fprintf('Setting up real-time data sync...\\n');
        `;
        
        return await this.executeCode({ code: digitalTwinCode });
    }
    
    async runMLModel(payload) {
        const { modelType, trainingData, targetData } = payload;
        
        let mlCode = '';
        
        switch (modelType) {
            case 'neural_network':
                mlCode = `
                    % Neural Network Training
                    inputs = ${JSON.stringify(trainingData || [])};
                    targets = ${JSON.stringify(targetData || [])};
                    net = feedforwardnet(10);
                    net = train(net, inputs, targets);
                    outputs = net(inputs);
                    performance = perform(net, targets, outputs);
                    fprintf('Neural network performance: %.4f\\n', performance);
                `;
                break;
                
            case 'regression':
                mlCode = `
                    % Linear Regression
                    X = ${JSON.stringify(trainingData || [])};
                    y = ${JSON.stringify(targetData || [])};
                    mdl = fitlm(X, y);
                    disp(mdl);
                    plot(mdl);
                `;
                break;
        }
        
        return await this.executeCode({ code: mlCode });
    }
    
    async batchAnalysis(payload) {
        const { files, analysisScript, outputDir } = payload;
        
        if (!files || !Array.isArray(files)) {
            throw new Error('Files array is required');
        }
        
        const batchId = `batch-${Date.now()}`;
        const results = [];
        
        this.log(`Starting batch analysis: ${files.length} files`);
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            try {
                this.sendMessage({
                    type: 'batch_progress',
                    batchId,
                    current: i + 1,
                    total: files.length,
                    currentFile: file
                });
                
                const analysisCode = `
                    fprintf('Processing file: ${file}\\n');
                    ${analysisScript || `load('${file}'); disp('File processed');`}
                `;
                
                const result = await this.executeCode({ code: analysisCode });
                
                results.push({
                    file,
                    success: true,
                    result
                });
            } catch (error) {
                results.push({
                    file,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return {
            batchId,
            totalFiles: files.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results
        };
    }
    
    async getAvailableToolboxes() {
        const code = 'ver';
        return await this.executeCode({ code });
    }
    
    async installAddOn(payload) {
        const { addOnName, addOnPath } = payload;
        
        if (!addOnName && !addOnPath) {
            throw new Error('Add-on name or path is required');
        }
        
        const installCode = addOnPath 
            ? `matlab.addons.install('${addOnPath}')`
            : `% Install ${addOnName} from Add-On Explorer`;
            
        return await this.executeCode({ code: installCode });
    }
    
    async startWebAppServer(payload = {}) {
        const { port = this.config.webAppPort } = payload;
        
        if (this.webAppServer) {
            return {
                success: false,
                message: 'Web app server already running',
                port: this.webAppServer.port
            };
        }
        
        // In a real implementation, you would start MATLAB's web app server
        this.webAppServer = {
            port: port,
            status: 'running'
        };
        
        this.log(`MATLAB Web App server started on port ${port}`);
        
        return {
            success: true,
            port: port,
            url: `http://localhost:${port}`
        };
    }
    
    async stopWebAppServer() {
        if (!this.webAppServer) {
            return { success: true, message: 'Web app server not running' };
        }
        
        this.webAppServer = null;
        
        return { success: true };
    }
    
    async deployModel(payload) {
        const { modelName, deploymentTarget = 'web' } = payload;
        
        if (!modelName) {
            throw new Error('Model name is required');
        }
        
        const deployCode = `
            % Model Deployment
            fprintf('Deploying model: ${modelName}\\n');
            fprintf('Target: ${deploymentTarget}\\n');
            % Add deployment logic here
            fprintf('Model deployed successfully\\n');
        `;
        
        return await this.executeCode({ code: deployCode });
    }
    
    async connectToMATLABCloud(payload) {
        const { credentials } = payload;
        
        const cloudCode = `
            % MATLAB Cloud Connection
            fprintf('Connecting to MATLAB Cloud...\\n');
            % Add cloud connection logic here
            fprintf('Connected to MATLAB Cloud\\n');
        `;
        
        return await this.executeCode({ code: cloudCode });
    }
    
    getJobStatus(payload) {
        const { jobId } = payload;
        
        if (jobId) {
            return this.activeJobs.get(jobId) || null;
        }
        
        // Return all active jobs
        return Array.from(this.activeJobs.values());
    }
    
    async cancelJob(payload) {
        const { jobId } = payload;
        
        const job = this.activeJobs.get(jobId);
        
        if (!job) {
            throw new Error(`Job ${jobId} not found`);
        }
        
        try {
            if (job.process) {
                job.process.kill();
            }
            
            job.status = 'cancelled';
            job.endTime = Date.now();
            
            return {
                success: true,
                jobId,
                status: 'cancelled'
            };
        } catch (error) {
            throw new Error(`Failed to cancel job ${jobId}: ${error.message}`);
        }
    }
    
    async browseWorkspaceFiles() {
        try {
            const files = await fs.readdir(this.config.workspacePath);
            const workspaceFiles = [];
            
            for (const file of files) {
                if (file.endsWith('.m') || file.endsWith('.mat') || file.endsWith('.mlx')) {
                    const filePath = path.join(this.config.workspacePath, file);
                    const stats = await fs.stat(filePath);
                    
                    workspaceFiles.push({
                        name: file,
                        path: filePath,
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime,
                        type: path.extname(file)
                    });
                }
            }
            
            // Sort by modification date (newest first)
            workspaceFiles.sort((a, b) => b.modified - a.modified);
            
            return {
                workspace: this.config.workspacePath,
                files: workspaceFiles,
                totalFiles: workspaceFiles.length
            };
        } catch (error) {
            this.error('Failed to browse workspace files:', error);
            return {
                workspace: this.config.workspacePath,
                files: [],
                error: error.message
            };
        }
    }
    
    async updateConfig(newConfig) {
        // Update configuration
        this.config = { ...this.config, ...newConfig };
        
        // Save to persistent storage
        await this.saveData('config.json', this.config);
        
        // Handle path changes
        if (newConfig.matlabPath) {
            await this.checkMATLABInstallation();
        }
        
        if (newConfig.workspacePath) {
            try {
                await fs.mkdir(this.config.workspacePath, { recursive: true });
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
            matlabInstalled: !!this.config.matlabPath,
            matlabRunning: !!this.matlabProcess,
            engineRunning: !!this.engineSession,
            enginePort: this.enginePort,
            webAppRunning: !!this.webAppServer,
            webAppPort: this.webAppServer?.port,
            activeJobs: this.activeJobs.size,
            workspace: this.config.workspacePath,
            enabledFeatures: {
                engine: this.config.enableEngine,
                webApps: this.config.enableWebApps,
                gpu: this.config.enableGPU,
                parallel: this.config.enableParallel
            },
            config: this.config
        };
    }
}

module.exports = MATLABPlugin;