/**
 * Unified 3D Slicer Plugin for W.I.T. Universal Desktop Controller
 * Provides integration with all major 3D slicing software
 */

const { WITPlugin } = require('../../src/plugins/base/WITPlugin');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

class UnifiedSlicerPlugin extends WITPlugin {
    constructor(context) {
        super(context);
        
        this.slicerProcesses = new Map(); // Track running slicer processes
        this.activeJobs = new Map(); // Track slicing jobs
        this.supportedSlicers = ['prusaslicer', 'orcaslicer', 'bambustudio', 'superslicer', 'cura'];
        this.installedSlicers = new Map();
        this.slicingProfiles = new Map();
    }
    
    async initialize() {
        await super.initialize();
        
        // Initialize config from manifest defaults if needed
        const manifestConfig = require('./manifest.json').config;
        
        // Set default slicer paths based on platform
        if (!this.config.slicerPaths) {
            const pathConfig = manifestConfig.slicerPaths;
            this.config.slicerPaths = pathConfig.platform[process.platform] || {};
        }
        
        // Ensure slicerPaths is an object
        if (typeof this.config.slicerPaths !== 'object' || !this.config.slicerPaths) {
            this.config.slicerPaths = {};
        }
        
        // Set other defaults
        this.log('Current config:', JSON.stringify(this.config));
        if (!this.config.defaultOutputDir) {
            const defaultPath = manifestConfig.defaultOutputDir.default;
            this.config.defaultOutputDir = defaultPath.replace('~', os.homedir());
        }
        
        // Ensure defaultOutputDir is a string (not an object)
        if (typeof this.config.defaultOutputDir !== 'string') {
            this.log('Warning: defaultOutputDir was not a string, using default. Current value:', JSON.stringify(this.config.defaultOutputDir));
            this.config.defaultOutputDir = path.join(os.homedir(), 'Documents', '3D Printing', 'Sliced');
        }
        
        if (!this.config.defaultSlicer) {
            this.config.defaultSlicer = manifestConfig.defaultSlicer.default;
        }
        
        if (!this.config.enabledSlicers) {
            this.config.enabledSlicers = manifestConfig.enabledSlicers.default;
        }
        
        // Ensure enabledSlicers is an object with all slicers
        if (typeof this.config.enabledSlicers !== 'object') {
            this.config.enabledSlicers = {
                prusaslicer: true,
                orcaslicer: true,
                bambustudio: true,
                superslicer: true,
                cura: true
            };
        }
        
        if (!this.config.defaultProfile) {
            this.config.defaultProfile = manifestConfig.defaultProfile.default;
        }
        
        // Create output directory if it doesn't exist
        try {
            await fs.mkdir(this.config.defaultOutputDir, { recursive: true });
        } catch (error) {
            this.log('Warning: Could not create output directory:', error.message);
        }
        
        // Detect installed slicers
        await this.detectInstalledSlicers();
        
        // Load default profiles
        await this.loadSlicingProfiles();
        
        this.log('Unified Slicer plugin initialized');
        this.log('Installed slicers:', Array.from(this.installedSlicers.keys()));
    }
    
    async start() {
        await super.start();
        this.log('Unified Slicer plugin started');
    }
    
    async stop() {
        // Stop any running slicer processes
        for (const [jobId, process] of this.slicerProcesses) {
            try {
                process.kill();
                this.log(`Stopped slicer process for job: ${jobId}`);
            } catch (error) {
                this.error('Error stopping slicer process:', error);
            }
        }
        
        this.slicerProcesses.clear();
        this.activeJobs.clear();
        
        await super.stop();
    }
    
    async onMessage(message) {
        const { action, payload } = message;
        
        switch (action) {
            case 'getAvailableSlicers':
                return this.getAvailableSlicers();
                
            case 'slice':
                return await this.sliceFile(payload);
                
            case 'batchSlice':
                return await this.batchSlice(payload);
                
            case 'launchSlicer':
                return await this.launchSlicer(payload);
                
            case 'getSlicingProfiles':
                return this.getSlicingProfiles(payload);
                
            case 'saveSlicingProfile':
                return await this.saveSlicingProfile(payload);
                
            case 'getJobStatus':
                return this.getJobStatus(payload);
                
            case 'cancelJob':
                return await this.cancelSlicingJob(payload);
                
            case 'analyzeGCode':
                return await this.analyzeGCode(payload);
                
            case 'getSlicedFiles':
                return await this.getSlicedFiles();
                
            case 'deleteSlicedFile':
                return await this.deleteSlicedFile(payload);
                
            case 'sendToPrinter':
                return await this.sendToPrinter(payload);
                
            case 'updateConfig':
                return await this.updateConfig(payload);
                
            case 'getStatus':
                return this.getStatus();
                
            case 'browse3DFiles':
                return await this.browse3DFiles(payload);
                
            case 'searchFiles':
                return await this.searchFilesByName(payload);
                
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }
    
    async detectInstalledSlicers() {
        this.installedSlicers.clear();
        this.log('Starting slicer detection...');
        this.log('Enabled slicers:', JSON.stringify(this.config.enabledSlicers));
        
        for (const slicerId of this.supportedSlicers) {
            this.log(`Checking ${slicerId}...`);
            if (!this.config.enabledSlicers[slicerId]) {
                this.log(`${slicerId} is disabled, skipping`);
                continue;
            }
            
            const slicerPath = this.config.slicerPaths[slicerId];
            
            // Always try auto-detection first if no path is set
            if (!slicerPath) {
                const autoDetected = await this.autoDetectSlicer(slicerId);
                if (autoDetected) {
                    this.config.slicerPaths[slicerId] = autoDetected;
                    await this.saveData('config.json', this.config);
                }
                continue;
            }
            
            try {
                await fs.access(slicerPath);
                
                // Get version info
                const version = await this.getSlicerVersion(slicerId, slicerPath);
                
                this.installedSlicers.set(slicerId, {
                    path: slicerPath,
                    version: version,
                    name: this.getSlicerDisplayName(slicerId),
                    cliSupport: this.getSlicerCLISupport(slicerId)
                });
                
                this.log(`Found ${slicerId} at: ${slicerPath} (v${version})`);
            } catch (error) {
                this.log(`${slicerId} not found at: ${slicerPath}`);
                
                // Try to auto-detect
                const autoDetected = await this.autoDetectSlicer(slicerId);
                if (autoDetected) {
                    this.config.slicerPaths[slicerId] = autoDetected;
                    await this.saveData('config.json', this.config);
                    
                    // Retry detection
                    try {
                        const version = await this.getSlicerVersion(slicerId, autoDetected);
                        this.installedSlicers.set(slicerId, {
                            path: autoDetected,
                            version: version,
                            name: this.getSlicerDisplayName(slicerId),
                            cliSupport: this.getSlicerCLISupport(slicerId)
                        });
                        this.log(`Auto-detected ${slicerId} at: ${autoDetected}`);
                    } catch (autoError) {
                        this.log(`Auto-detection failed for ${slicerId}`);
                    }
                }
            }
        }
    }
    
    async autoDetectSlicer(slicerId) {
        const commonPaths = {
            darwin: {
                prusaslicer: [
                    '/Applications/PrusaSlicer.app/Contents/MacOS/PrusaSlicer',
                    '/Applications/Original Prusa Drivers/PrusaSlicer.app/Contents/MacOS/PrusaSlicer',
                    '/Applications/Prusa3D/PrusaSlicer.app/Contents/MacOS/PrusaSlicer'
                ],
                orcaslicer: [
                    '/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer'
                ],
                bambustudio: [
                    '/Applications/BambuStudio.app/Contents/MacOS/BambuStudio',
                    '/Applications/Bambu Studio.app/Contents/MacOS/BambuStudio'
                ],
                superslicer: [
                    '/Applications/SuperSlicer.app/Contents/MacOS/SuperSlicer'
                ],
                cura: [
                    '/Applications/UltiMaker Cura.app/Contents/MacOS/UltiMaker Cura',
                    '/Applications/Ultimaker Cura.app/Contents/MacOS/Cura'
                ]
            },
            win32: {
                prusaslicer: [
                    'C:\\Program Files\\Prusa3D\\PrusaSlicer\\prusa-slicer.exe',
                    'C:\\Program Files (x86)\\Prusa3D\\PrusaSlicer\\prusa-slicer.exe'
                ],
                orcaslicer: [
                    'C:\\Program Files\\OrcaSlicer\\OrcaSlicer.exe'
                ],
                bambustudio: [
                    'C:\\Program Files\\Bambu Studio\\BambuStudio.exe'
                ],
                superslicer: [
                    'C:\\Program Files\\SuperSlicer\\superslicer.exe'
                ],
                cura: [
                    'C:\\Program Files\\Ultimaker Cura\\Ultimaker Cura.exe'
                ]
            },
            linux: {
                prusaslicer: [
                    '/usr/bin/prusa-slicer',
                    '/usr/local/bin/prusa-slicer',
                    '/snap/bin/prusa-slicer'
                ],
                orcaslicer: [
                    '/usr/bin/orcaslicer',
                    '/usr/local/bin/orcaslicer'
                ],
                bambustudio: [
                    '/usr/bin/bambustudio',
                    '/usr/local/bin/bambustudio'
                ],
                superslicer: [
                    '/usr/bin/superslicer',
                    '/usr/local/bin/superslicer'
                ],
                cura: [
                    '/usr/bin/cura',
                    '/usr/local/bin/cura'
                ]
            }
        };
        
        const paths = commonPaths[process.platform]?.[slicerId] || [];
        
        for (const testPath of paths) {
            try {
                await fs.access(testPath);
                return testPath;
            } catch (error) {
                // Continue searching
            }
        }
        
        return null;
    }
    
    async getSlicerVersion(slicerId, slicerPath) {
        return new Promise((resolve) => {
            const versionArgs = this.getVersionArgs(slicerId);
            const process = spawn(slicerPath, versionArgs, { stdio: 'pipe' });
            
            let output = '';
            process.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                output += data.toString();
            });
            
            process.on('close', () => {
                const version = this.parseVersion(output);
                resolve(version || 'unknown');
            });
            
            // Timeout after 5 seconds
            setTimeout(() => {
                process.kill();
                resolve('unknown');
            }, 5000);
        });
    }
    
    getVersionArgs(slicerId) {
        const versionArgs = {
            prusaslicer: ['--version'],
            orcaslicer: ['--version'],
            bambustudio: ['--version'],
            superslicer: ['--version'],
            cura: ['--version']
        };
        
        return versionArgs[slicerId] || ['--version'];
    }
    
    parseVersion(output) {
        // Extract version number from output
        const versionMatch = output.match(/(\d+\.\d+(?:\.\d+)?)/);
        return versionMatch ? versionMatch[1] : null;
    }
    
    getSlicerDisplayName(slicerId) {
        const names = {
            prusaslicer: 'PrusaSlicer',
            orcaslicer: 'OrcaSlicer',
            bambustudio: 'Bambu Studio',
            superslicer: 'SuperSlicer',
            cura: 'Ultimaker Cura'
        };
        
        return names[slicerId] || slicerId;
    }
    
    getSlicerCLISupport(slicerId) {
        const support = {
            prusaslicer: 'excellent',
            orcaslicer: 'excellent',
            bambustudio: 'good',
            superslicer: 'excellent',
            cura: 'good'
        };
        
        return support[slicerId] || 'unknown';
    }
    
    getAvailableSlicers() {
        const slicers = Array.from(this.installedSlicers.entries()).map(([id, info]) => ({
            id,
            ...info,
            isDefault: id === this.config.defaultSlicer
        }));
        
        return {
            slicers,
            defaultSlicer: this.config.defaultSlicer,
            totalInstalled: slicers.length
        };
    }
    
    async sliceFile(payload) {
        const {
            inputFile,
            outputFile,
            slicer = this.config.defaultSlicer,
            profile = this.config.defaultProfile,
            printerProfile,
            customSettings = {}
        } = payload;
        
        if (!inputFile) {
            throw new Error('Input file is required');
        }
        
        if (!this.installedSlicers.has(slicer)) {
            throw new Error(`Slicer '${slicer}' is not installed or not available`);
        }
        
        // Generate job ID
        const jobId = `slice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Determine output file
        const finalOutputFile = outputFile || this.generateOutputFileName(inputFile, slicer);
        
        // Build slicer command
        const slicerInfo = this.installedSlicers.get(slicer);
        const args = this.buildSlicerArgs(slicer, inputFile, finalOutputFile, profile, printerProfile, customSettings);
        
        this.log(`Starting slicing job ${jobId} with ${slicer}`);
        this.log(`Input: ${inputFile}`);
        this.log(`Output: ${finalOutputFile}`);
        this.log(`Args: ${args.join(' ')}`);
        
        // Start slicing process
        const slicingProcess = spawn(slicerInfo.path, args, {
            stdio: ['ignore', 'pipe', 'pipe']
        });
        
        // Track the job
        this.slicerProcesses.set(jobId, slicingProcess);
        this.activeJobs.set(jobId, {
            id: jobId,
            slicer,
            inputFile,
            outputFile: finalOutputFile,
            status: 'running',
            startTime: Date.now(),
            progress: 0
        });
        
        // Handle process events
        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';
            
            slicingProcess.stdout.on('data', (data) => {
                stdout += data.toString();
                
                // Parse progress if available
                const progress = this.parseSlicingProgress(slicer, data.toString());
                if (progress !== null) {
                    const job = this.activeJobs.get(jobId);
                    if (job) {
                        job.progress = progress;
                        this.sendMessage({
                            type: 'slicing_progress',
                            jobId,
                            progress
                        });
                    }
                }
            });
            
            slicingProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                this.log(`Slicer stderr: ${data.toString()}`);
                // Some slicers output progress to stderr, not just errors
                if (!data.toString().includes('=>')) {
                    this.sendMessage({
                        type: 'slicing_log',
                        jobId,
                        level: 'error',
                        message: data.toString()
                    });
                }
            });
            
            slicingProcess.on('close', async (code) => {
                this.slicerProcesses.delete(jobId);
                const job = this.activeJobs.get(jobId);
                
                if (code === 0) {
                    // Success
                    if (job) {
                        job.status = 'completed';
                        job.endTime = Date.now();
                        job.progress = 100;
                    }
                    
                    // Analyze the generated G-code
                    const analysis = await this.analyzeGCode({ filePath: finalOutputFile });
                    
                    resolve({
                        success: true,
                        jobId,
                        outputFile: finalOutputFile,
                        analysis,
                        duration: job ? job.endTime - job.startTime : 0
                    });
                } else {
                    // Error
                    if (job) {
                        job.status = 'failed';
                        job.endTime = Date.now();
                        job.error = stderr;
                    }
                    
                    reject(new Error(`Slicing failed with code ${code}: ${stderr}`));
                }
                
                this.sendMessage({
                    type: 'slicing_complete',
                    jobId,
                    success: code === 0,
                    error: code !== 0 ? stderr : null
                });
            });
            
            slicingProcess.on('error', (error) => {
                this.slicerProcesses.delete(jobId);
                const job = this.activeJobs.get(jobId);
                if (job) {
                    job.status = 'failed';
                    job.endTime = Date.now();
                    job.error = error.message;
                }
                
                reject(error);
            });
        });
    }
    
    generateOutputFileName(inputFile, slicer) {
        const baseName = path.basename(inputFile, path.extname(inputFile));
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        // Add milliseconds to ensure unique filenames even for rapid requests
        const ms = Date.now().toString().slice(-4);
        const extension = slicer === 'bambustudio' ? '.3mf' : '.gcode';
        
        return path.join(this.config.defaultOutputDir, `${baseName}_${slicer}_${timestamp}_${ms}${extension}`);
    }
    
    buildSlicerArgs(slicer, inputFile, outputFile, profile, printerProfile, customSettings) {
        const baseArgs = {
            prusaslicer: [
                '--export-gcode',
                '--output', outputFile,
                '--center', '100,100',   // Center the object on a 200x200 bed
                '--ensure-on-bed',       // Ensure the model is positioned on the bed
                inputFile
            ],
            orcaslicer: [
                '--slice',
                inputFile,
                '--output', outputFile
            ],
            bambustudio: [
                '--slice', '2',
                '--outputdir', path.dirname(outputFile),
                '--export-3mf', path.basename(outputFile, '.gcode') + '.3mf',
                inputFile
            ],
            superslicer: [
                '--slice',
                inputFile,
                '--output', outputFile
            ],
            cura: [
                inputFile,
                '--output', outputFile
            ]
        };
        
        let args = baseArgs[slicer] || [];
        
        // Add basic settings for PrusaSlicer to prevent errors
        if (slicer === 'prusaslicer') {
            // Use minimal, well-supported settings only
            args.push('--layer-height', '0.2');
            args.push('--fill-density', '0.15');  // 15% infill as decimal
            
            // Handle custom profile settings
            if (profile && typeof profile === 'object') {
                if (profile.layerHeight) {
                    // Replace the default layer height
                    const layerHeightIndex = args.indexOf('--layer-height');
                    if (layerHeightIndex !== -1) {
                        args[layerHeightIndex + 1] = profile.layerHeight;
                    }
                }
                
                if (profile.infillDensity) {
                    const densityStr = profile.infillDensity.replace('%', '');
                    const densityPercent = parseFloat(densityStr);
                    const densityDecimal = (densityPercent / 100).toFixed(2);
                    
                    const fillDensityIndex = args.indexOf('--fill-density');
                    if (fillDensityIndex !== -1) {
                        args[fillDensityIndex + 1] = densityDecimal;
                    }
                }
            }
        }
        
        // Add profile settings for other slicers
        if (profile && slicer !== 'prusaslicer') {
            args = args.concat(this.buildProfileArgs(slicer, profile));
        }
        
        // Add printer profile
        if (printerProfile && slicer !== 'prusaslicer') {
            args.push('--printer', printerProfile);
        }
        
        // Add custom settings for non-PrusaSlicer
        if (slicer !== 'prusaslicer') {
            for (const [key, value] of Object.entries(customSettings)) {
                const settingArg = this.buildSettingArg(slicer, key, value);
                if (settingArg) {
                    args = args.concat(settingArg);
                }
            }
        }
        
        return args;
    }
    
    buildProfileArgs(slicer, profile) {
        const args = [];
        
        if (slicer === 'prusaslicer') {
            // PrusaSlicer specific arguments
            if (profile.layerHeight) {
                args.push('--layer-height', profile.layerHeight);
            }
            
            // Infill density (PrusaSlicer expects a decimal between 0 and 1)
            if (profile.infillDensity) {
                const densityStr = profile.infillDensity.replace('%', '');
                const densityPercent = parseFloat(densityStr);
                const densityDecimal = (densityPercent / 100).toFixed(2);
                args.push('--fill-density', densityDecimal);
            }
            
            // Print speed
            if (profile.printSpeed) {
                args.push('--perimeter-speed', profile.printSpeed);
            }
            
            // Support material
            if (profile.supportMaterial !== undefined) {
                args.push('--support-material', profile.supportMaterial ? '1' : '0');
            }
        } else if (slicer === 'bambustudio') {
            // Bambu Studio - skip individual parameter overrides for now
            // The slicer will use default settings or settings from loaded config files
            // Individual parameter setting via command line may not be supported
            this.log('Using Bambu Studio with default settings - individual parameter override not yet supported');
        } else {
            // Generic arguments for other slicers
            if (profile.layerHeight) {
                args.push('--layer-height', profile.layerHeight);
            }
            
            if (profile.infillDensity) {
                const densityStr = profile.infillDensity.replace('%', '');
                args.push('--fill-density', densityStr);
            }
            
            if (profile.printSpeed) {
                args.push('--perimeter-speed', profile.printSpeed);
            }
            
            if (profile.supportMaterial !== undefined) {
                args.push('--support-material', profile.supportMaterial ? '1' : '0');
            }
        }
        
        return args;
    }
    
    buildSettingArg(slicer, key, value) {
        // Convert setting key/value to slicer-specific argument
        const settingMap = {
            prusaslicer: {
                temperature: ['--temperature', value],
                bedTemperature: ['--bed-temperature', value],
                infillPattern: ['--fill-pattern', value]
            },
            orcaslicer: {
                temperature: ['--temperature', value],
                bedTemperature: ['--bed-temperature', value],
                infillPattern: ['--fill-pattern', value]
            },
            // Add other slicers as needed
        };
        
        return settingMap[slicer]?.[key] || null;
    }
    
    parseSlicingProgress(slicer, output) {
        // Parse progress from slicer output
        const progressRegex = /(\d+)%/;
        const match = output.match(progressRegex);
        return match ? parseInt(match[1]) : null;
    }
    
    async batchSlice(payload) {
        const { files, slicer, profile, printerProfile, customSettings } = payload;
        
        if (!files || !Array.isArray(files) || files.length === 0) {
            throw new Error('Files array is required');
        }
        
        const results = [];
        const batchId = `batch-${Date.now()}`;
        
        this.log(`Starting batch slicing: ${files.length} files`);
        
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
                
                const result = await this.sliceFile({
                    inputFile: file,
                    slicer,
                    profile,
                    printerProfile,
                    customSettings
                });
                
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
        
        this.sendMessage({
            type: 'batch_complete',
            batchId,
            results
        });
        
        return {
            batchId,
            totalFiles: files.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results
        };
    }
    
    async launchSlicer(payload) {
        const { slicer = this.config.defaultSlicer, files = [] } = payload;
        
        if (!this.installedSlicers.has(slicer)) {
            throw new Error(`Slicer '${slicer}' is not installed`);
        }
        
        const slicerInfo = this.installedSlicers.get(slicer);
        const args = files.length > 0 ? files : [];
        
        this.log(`Launching ${slicer} with files:`, files);
        
        const process = spawn(slicerInfo.path, args, {
            detached: true,
            stdio: 'ignore'
        });
        
        process.unref();
        
        return {
            success: true,
            slicer,
            pid: process.pid,
            files
        };
    }
    
    async loadSlicingProfiles() {
        // Load default profiles and any custom profiles
        this.slicingProfiles.set('default', this.config.defaultProfile);
        
        // Add common profiles
        this.slicingProfiles.set('draft', {
            layerHeight: '0.3',
            infillDensity: '10%',
            printSpeed: '80',
            supportMaterial: false,
            filamentType: 'PLA'
        });
        
        this.slicingProfiles.set('quality', {
            layerHeight: '0.15',
            infillDensity: '20%',
            printSpeed: '40',
            supportMaterial: true,
            filamentType: 'PLA'
        });
        
        this.slicingProfiles.set('high-detail', {
            layerHeight: '0.1',
            infillDensity: '25%',
            printSpeed: '30',
            supportMaterial: true,
            filamentType: 'PLA'
        });
    }
    
    getSlicingProfiles(payload) {
        const { slicer } = payload || {};
        
        const profiles = Array.from(this.slicingProfiles.entries()).map(([name, settings]) => ({
            name,
            settings,
            isDefault: name === 'default'
        }));
        
        return {
            profiles,
            supportedSlicers: Array.from(this.installedSlicers.keys()),
            currentSlicer: slicer || this.config.defaultSlicer
        };
    }
    
    async saveSlicingProfile(payload) {
        const { name, settings } = payload;
        
        if (!name || !settings) {
            throw new Error('Profile name and settings are required');
        }
        
        this.slicingProfiles.set(name, settings);
        
        // Save to persistent storage
        const profilesData = Object.fromEntries(this.slicingProfiles);
        await this.saveData('profiles.json', profilesData);
        
        return {
            success: true,
            profileName: name,
            totalProfiles: this.slicingProfiles.size
        };
    }
    
    getJobStatus(payload) {
        const { jobId } = payload;
        
        if (jobId) {
            return this.activeJobs.get(jobId) || null;
        }
        
        // Return all active jobs
        return Array.from(this.activeJobs.values());
    }
    
    async cancelSlicingJob(payload) {
        const { jobId } = payload;
        
        const process = this.slicerProcesses.get(jobId);
        const job = this.activeJobs.get(jobId);
        
        if (!process || !job) {
            throw new Error(`Job ${jobId} not found`);
        }
        
        try {
            process.kill();
            
            job.status = 'cancelled';
            job.endTime = Date.now();
            
            this.slicerProcesses.delete(jobId);
            
            return {
                success: true,
                jobId,
                status: 'cancelled'
            };
        } catch (error) {
            throw new Error(`Failed to cancel job ${jobId}: ${error.message}`);
        }
    }
    
    async analyzeGCode(payload) {
        const { filePath } = payload;
        
        if (!filePath) {
            throw new Error('File path is required');
        }
        
        try {
            const fileExt = path.extname(filePath).toLowerCase();
            
            if (fileExt === '.3mf') {
                // Handle 3MF files (Bambu Studio output)
                return this.analyze3MFFile(filePath);
            } else {
                // Handle G-code files (PrusaSlicer, etc.)
                const content = await fs.readFile(filePath, 'utf8');
                const lines = content.split('\n');
                
                const analysis = {
                    filePath,
                    fileSize: content.length,
                    lineCount: lines.length,
                    estimatedPrintTime: this.parseGCodeTime(content),
                    filamentUsed: this.parseGCodeFilament(content),
                    layerCount: this.parseGCodeLayers(content),
                    temperature: this.parseGCodeTemperature(content),
                    bedTemperature: this.parseGCodeBedTemperature(content),
                    generatedBy: this.parseGCodeGenerator(content)
                };
                
                return analysis;
            }
        } catch (error) {
            throw new Error(`Failed to analyze file: ${error.message}`);
        }
    }
    
    async analyze3MFFile(filePath) {
        try {
            const stats = await fs.stat(filePath);
            
            // Basic analysis for 3MF files - limited compared to G-code
            const analysis = {
                filePath,
                fileSize: stats.size,
                lineCount: 'N/A (3MF format)',
                estimatedPrintTime: 'See Bambu Studio',
                filamentUsed: 'See Bambu Studio',
                layerCount: 'See Bambu Studio',
                temperature: 'See Bambu Studio',
                bedTemperature: 'See Bambu Studio',
                generatedBy: 'Bambu Studio'
            };
            
            this.log(`Analyzed 3MF file: ${filePath} (${stats.size} bytes)`);
            return analysis;
        } catch (error) {
            throw new Error(`Failed to analyze 3MF file: ${error.message}`);
        }
    }
    
    parseGCodeTime(content) {
        const timeMatch = content.match(/; estimated printing time.*?(\d+h\s*\d+m|\d+m\s*\d+s|\d+:\d+:\d+)/i);
        return timeMatch ? timeMatch[1] : 'unknown';
    }
    
    parseGCodeFilament(content) {
        const filamentMatch = content.match(/; filament used.*?(\d+\.?\d*(?:m|mm|g))/i);
        return filamentMatch ? filamentMatch[1] : 'unknown';
    }
    
    parseGCodeLayers(content) {
        const layerMatches = content.match(/; LAYER:\d+/g);
        return layerMatches ? layerMatches.length : 0;
    }
    
    parseGCodeTemperature(content) {
        const tempMatch = content.match(/M104 S(\d+)/);
        return tempMatch ? `${tempMatch[1]}°C` : 'unknown';
    }
    
    parseGCodeBedTemperature(content) {
        const bedTempMatch = content.match(/M140 S(\d+)/);
        return bedTempMatch ? `${bedTempMatch[1]}°C` : 'unknown';
    }
    
    parseGCodeGenerator(content) {
        const generatorMatch = content.match(/; generated by (.+)/i);
        return generatorMatch ? generatorMatch[1].trim() : 'unknown';
    }
    
    async getSlicedFiles() {
        try {
            const files = await fs.readdir(this.config.defaultOutputDir);
            const slicedFiles = [];
            
            for (const file of files) {
                if (file.endsWith('.gcode') || file.endsWith('.3mf')) {
                    const filePath = path.join(this.config.defaultOutputDir, file);
                    const stats = await fs.stat(filePath);
                    
                    slicedFiles.push({
                        name: file,
                        path: filePath,
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime
                    });
                }
            }
            
            // Sort by creation date (newest first)
            slicedFiles.sort((a, b) => b.created - a.created);
            
            return slicedFiles;
        } catch (error) {
            this.error('Failed to list sliced files:', error);
            return [];
        }
    }
    
    async deleteSlicedFile(payload) {
        const { filePath } = payload;
        
        if (!filePath) {
            throw new Error('File path is required');
        }
        
        // Security check: ensure file is in the output directory
        const resolvedPath = path.resolve(filePath);
        const outputDir = path.resolve(this.config.defaultOutputDir);
        
        if (!resolvedPath.startsWith(outputDir)) {
            throw new Error('Access denied: file is outside output directory');
        }
        
        try {
            await fs.unlink(resolvedPath);
            return {
                success: true,
                deletedFile: filePath
            };
        } catch (error) {
            throw new Error(`Failed to delete file: ${error.message}`);
        }
    }
    
    async sendToPrinter(payload) {
        const { filePath, printerId } = payload;
        
        if (!filePath) {
            throw new Error('File path is required');
        }
        
        // This would integrate with the existing printer management system
        // For now, we'll emit an event that the main system can handle
        this.sendMessage({
            type: 'send_to_printer',
            filePath,
            printerId,
            timestamp: Date.now()
        });
        
        return {
            success: true,
            message: 'File queued for printing',
            filePath,
            printerId
        };
    }
    
    async updateConfig(newConfig) {
        // Update configuration
        this.config = { ...this.config, ...newConfig };
        
        // Save to persistent storage
        await this.saveData('config.json', this.config);
        
        // Re-detect slicers if paths changed
        if (newConfig.slicerPaths) {
            await this.detectInstalledSlicers();
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
            installedSlicers: Array.from(this.installedSlicers.keys()),
            activeJobs: this.activeJobs.size,
            supportedSlicers: this.supportedSlicers,
            defaultSlicer: this.config.defaultSlicer,
            outputDirectory: this.config.defaultOutputDir,
            availableProfiles: Array.from(this.slicingProfiles.keys()),
            config: this.config
        };
    }
    
    async browse3DFiles(payload = {}) {
        const { 
            directory = path.join(os.homedir(), 'Documents'), 
            extensions = ['.stl', '.3mf', '.obj', '.amf', '.ply'],
            maxDepth = 3 
        } = payload;
        
        this.log(`Browsing for 3D files in: ${directory}`);
        
        try {
            const files = await this.findFilesRecursive(directory, extensions, maxDepth);
            
            // Sort by modification time (newest first)
            files.sort((a, b) => b.modified - a.modified);
            
            // Limit to 100 most recent files
            const limitedFiles = files.slice(0, 100);
            
            return {
                directory,
                files: limitedFiles,
                totalFound: files.length,
                extensions
            };
        } catch (error) {
            this.error('Failed to browse files:', error);
            throw new Error(`Failed to browse files: ${error.message}`);
        }
    }
    
    async findFilesRecursive(dir, extensions, maxDepth, currentDepth = 0) {
        const files = [];
        
        if (currentDepth > maxDepth) {
            return files;
        }
        
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    // Skip hidden directories and common non-3D directories
                    if (entry.name.startsWith('.') || 
                        entry.name === 'node_modules' || 
                        entry.name === 'Library' ||
                        entry.name === 'Applications') {
                        continue;
                    }
                    
                    // Recursively search subdirectories
                    const subFiles = await this.findFilesRecursive(
                        fullPath, 
                        extensions, 
                        maxDepth, 
                        currentDepth + 1
                    );
                    files.push(...subFiles);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (extensions.includes(ext)) {
                        try {
                            const stats = await fs.stat(fullPath);
                            files.push({
                                name: entry.name,
                                path: fullPath,
                                size: stats.size,
                                modified: stats.mtime,
                                extension: ext
                            });
                        } catch (statError) {
                            // Skip files we can't stat
                        }
                    }
                }
            }
        } catch (error) {
            // Skip directories we can't read
            this.log(`Skipping directory ${dir}: ${error.message}`);
        }
        
        return files;
    }
    
    async searchFilesByName(payload) {
        const { filename, searchPaths } = payload;
        
        if (!filename) {
            throw new Error('Filename is required for search');
        }
        
        const defaultSearchPaths = [
            path.join(os.homedir(), 'Downloads'),
            path.join(os.homedir(), 'Documents'),
            path.join(os.homedir(), 'Desktop'),
            path.join(os.homedir(), 'Documents', '3D Printing'),
            path.join(os.homedir(), 'Documents', '3D Models'),
            '/tmp'
        ];
        
        const paths = searchPaths || defaultSearchPaths;
        const results = [];
        
        this.log(`Searching for file: ${filename} in paths:`, paths);
        
        for (const searchPath of paths) {
            try {
                const files = await this.findFilesRecursive(
                    searchPath, 
                    ['.stl', '.3mf', '.obj', '.amf', '.ply'], 
                    2
                );
                
                const matches = files.filter(file => 
                    file.name.toLowerCase().includes(filename.toLowerCase())
                );
                
                results.push(...matches);
            } catch (error) {
                this.log(`Error searching in ${searchPath}:`, error.message);
            }
        }
        
        // Remove duplicates and sort by relevance
        const uniqueResults = Array.from(
            new Map(results.map(file => [file.path, file])).values()
        );
        
        // Sort by exact match first, then by modification time
        uniqueResults.sort((a, b) => {
            const aExact = a.name.toLowerCase() === filename.toLowerCase();
            const bExact = b.name.toLowerCase() === filename.toLowerCase();
            
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;
            
            return b.modified - a.modified;
        });
        
        return {
            query: filename,
            results: uniqueResults.slice(0, 20), // Limit to 20 results
            searchPaths: paths
        };
    }
}

module.exports = UnifiedSlicerPlugin;