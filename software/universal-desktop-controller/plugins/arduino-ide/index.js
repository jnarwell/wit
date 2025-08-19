/**
 * Arduino IDE Plugin for W.I.T. Universal Desktop Controller
 * Provides integration with Arduino IDE for hardware development
 */

const { WITPlugin } = require('../../src/plugins/base/WITPlugin');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { SerialPort } = require('serialport');
const os = require('os');

class ArduinoIDEPlugin extends WITPlugin {
    constructor(context) {
        super(context);
        
        this.arduinoProcess = null;
        this.serialPort = null;
        this.boardList = [];
        this.portList = [];
        this.serialBuffer = '';
        
        // Platform-specific Arduino paths
        this.platformPaths = {
            darwin: '/Applications/Arduino.app/Contents/MacOS/Arduino',
            win32: 'C:\\Program Files\\Arduino\\arduino.exe',
            linux: '/usr/bin/arduino'
        };
    }
    
    async initialize() {
        await super.initialize();
        
        // Initialize config from manifest defaults if needed
        const manifestConfig = require('./manifest.json').config;
        
        // Set default Arduino path based on platform
        if (!this.config.arduinoPath) {
            const pathConfig = manifestConfig.arduinoPath;
            this.config.arduinoPath = pathConfig.platform[process.platform] || pathConfig.default || '';
        }
        
        // Set default sketches path
        if (!this.config.sketchesPath) {
            this.config.sketchesPath = manifestConfig.sketchesPath.default || '~/Documents/Arduino';
        }
        
        // Set other defaults
        if (this.config.defaultPort === undefined) {
            this.config.defaultPort = manifestConfig.defaultPort.default || '';
        }
        if (this.config.defaultBoard === undefined) {
            this.config.defaultBoard = manifestConfig.defaultBoard.default || 'arduino:avr:uno';
        }
        if (this.config.enableSerial === undefined) {
            this.config.enableSerial = manifestConfig.enableSerial.default || true;
        }
        
        // Expand home directory in sketches path
        if (this.config.sketchesPath && typeof this.config.sketchesPath === 'string' && this.config.sketchesPath.startsWith('~')) {
            this.config.sketchesPath = this.config.sketchesPath.replace('~', os.homedir());
        }
        
        // Check if Arduino IDE is installed
        await this.checkArduinoInstallation();
        
        // Start monitoring for Arduino boards
        // TODO: Enable after testing basic functionality
        // this.startBoardMonitoring();
        
        this.log('Arduino IDE plugin initialized');
    }
    
    async start() {
        await super.start();
        
        // Start serial port monitoring if enabled
        // TODO: Enable after testing basic functionality
        // if (this.config.enableSerial) {
        //     await this.startSerialMonitoring();
        // }
        
        this.log('Arduino IDE plugin started');
    }
    
    async stop() {
        // Stop any running Arduino process
        if (this.arduinoProcess) {
            this.arduinoProcess.kill();
            this.arduinoProcess = null;
        }
        
        // Close serial port
        if (this.serialPort && this.serialPort.isOpen) {
            await new Promise((resolve) => {
                this.serialPort.close(resolve);
            });
        }
        
        // Stop board monitoring
        this.stopBoardMonitoring();
        
        await super.stop();
    }
    
    async onMessage(message) {
        const { action, payload } = message;
        
        switch (action) {
            case 'launch':
                return await this.launchArduino(payload);
                
            case 'openSketch':
                return await this.openSketch(payload);
                
            case 'compile':
                return await this.compileSketch(payload);
                
            case 'upload':
                return await this.uploadSketch(payload);
                
            case 'listBoards':
                return await this.listBoards();
                
            case 'listPorts':
                return await this.listPorts();
                
            case 'selectBoard':
                return await this.selectBoard(payload);
                
            case 'selectPort':
                return await this.selectPort(payload);
                
            case 'startSerial':
                return await this.startSerialMonitor(payload);
                
            case 'stopSerial':
                return await this.stopSerialMonitor();
                
            case 'sendSerial':
                return await this.sendSerialData(payload);
                
            case 'getSketchList':
                return await this.getSketchList();
                
            case 'createSketch':
                return await this.createSketch(payload);
                
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }
    
    async checkArduinoInstallation() {
        try {
            // Make sure arduinoPath is a string
            if (!this.config.arduinoPath || typeof this.config.arduinoPath !== 'string') {
                throw new Error('Arduino path not configured');
            }
            
            await fs.access(this.config.arduinoPath);
            this.log(`Arduino IDE found at: ${this.config.arduinoPath}`);
            return true;
        } catch (error) {
            this.error('Arduino IDE not found at configured path:', error);
            
            // Try to find Arduino IDE
            const found = await this.findArduinoIDE();
            if (found) {
                this.config.arduinoPath = found;
                await this.saveData('config.json', this.config);
                this.log(`Arduino IDE found at: ${found}`);
                return true;
            }
            
            return false;
        }
    }
    
    async findArduinoIDE() {
        const searchPaths = [
            ...Object.values(this.platformPaths),
            // Additional common paths
            '/Applications/Arduino IDE.app/Contents/MacOS/Arduino IDE',
            'C:\\Program Files (x86)\\Arduino\\arduino.exe',
            '/usr/local/bin/arduino',
            '/snap/bin/arduino'
        ];
        
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
    
    async launchArduino(options = {}) {
        this.log('launchArduino called with options:', JSON.stringify(options));
        
        if (!await this.checkArduinoInstallation()) {
            throw new Error('Arduino IDE not found. Please configure the Arduino IDE path.');
        }
        
        const args = [];
        
        // Add sketch path if provided
        if (options.sketchPath) {
            args.push(options.sketchPath);
        }
        
        // Add board if specified
        const boardValue = options.board || (typeof this.config.defaultBoard === 'string' ? this.config.defaultBoard : null);
        if (boardValue) {
            args.push('--board', boardValue);
        }
        
        // Add port if specified
        const portValue = options.port || (typeof this.config.defaultPort === 'string' ? this.config.defaultPort : null);
        if (portValue) {
            args.push('--port', portValue);
        }
        
        this.log(`Launching Arduino IDE from: ${this.config.arduinoPath}`);
        this.log(`Launch args: ${JSON.stringify(args)}`);
        
        this.arduinoProcess = spawn(this.config.arduinoPath, args, {
            detached: true,
            stdio: 'ignore'
        });
        
        this.arduinoProcess.unref();
        
        return {
            success: true,
            pid: this.arduinoProcess.pid
        };
    }
    
    async openSketch(payload) {
        const { sketchName, projectPath } = payload;
        
        let sketchPath;
        if (projectPath) {
            // Open sketch from specific project path
            sketchPath = path.join(projectPath, sketchName);
        } else {
            // Open from default sketches directory
            sketchPath = path.join(this.config.sketchesPath, sketchName);
        }
        
        // Ensure sketch exists
        try {
            await fs.access(sketchPath);
        } catch (error) {
            throw new Error(`Sketch not found: ${sketchPath}`);
        }
        
        return await this.launchArduino({ sketchPath });
    }
    
    async compileSketch(payload) {
        const { sketchPath, board, outputPath } = payload;
        
        if (!sketchPath) {
            throw new Error('Sketch path is required');
        }
        
        const args = [
            '--verify',
            sketchPath
        ];
        
        if (board || this.config.defaultBoard) {
            args.push('--board', board || this.config.defaultBoard);
        }
        
        if (outputPath) {
            args.push('--pref', `build.path=${outputPath}`);
        }
        
        return await this.runArduinoCommand(args);
    }
    
    async uploadSketch(payload) {
        const { sketchPath, board, port } = payload;
        
        if (!sketchPath) {
            throw new Error('Sketch path is required');
        }
        
        const args = [
            '--upload',
            sketchPath
        ];
        
        if (board || this.config.defaultBoard) {
            args.push('--board', board || this.config.defaultBoard);
        }
        
        if (port || this.config.defaultPort) {
            args.push('--port', port || this.config.defaultPort);
        }
        
        return await this.runArduinoCommand(args);
    }
    
    async runArduinoCommand(args) {
        return new Promise((resolve, reject) => {
            const process = spawn(this.config.arduinoPath, args);
            
            let stdout = '';
            let stderr = '';
            
            process.stdout.on('data', (data) => {
                stdout += data.toString();
                this.sendMessage({
                    type: 'compile_output',
                    data: data.toString()
                });
            });
            
            process.stderr.on('data', (data) => {
                stderr += data.toString();
                this.sendMessage({
                    type: 'compile_error',
                    data: data.toString()
                });
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    resolve({
                        success: true,
                        output: stdout
                    });
                } else {
                    reject(new Error(`Arduino command failed: ${stderr}`));
                }
            });
            
            process.on('error', (error) => {
                reject(error);
            });
        });
    }
    
    async listBoards() {
        // List connected Arduino boards
        try {
            const ports = await SerialPort.list();
            
            this.boardList = ports.filter(port => {
                // Filter for Arduino boards based on manufacturer
                return port.manufacturer && (
                    port.manufacturer.includes('Arduino') ||
                    port.manufacturer.includes('arduino') ||
                    port.manufacturer.includes('FTDI') ||
                    port.manufacturer.includes('Silicon Labs')
                );
            }).map(port => ({
                path: port.path,
                manufacturer: port.manufacturer,
                serialNumber: port.serialNumber,
                pnpId: port.pnpId,
                vendorId: port.vendorId,
                productId: port.productId
            }));
            
            return this.boardList;
        } catch (error) {
            this.error('Failed to list boards:', error);
            return [];
        }
    }
    
    async listPorts() {
        // List all serial ports
        try {
            const ports = await SerialPort.list();
            
            this.portList = ports.map(port => ({
                path: port.path,
                manufacturer: port.manufacturer || 'Unknown',
                isArduino: port.manufacturer && (
                    port.manufacturer.includes('Arduino') ||
                    port.manufacturer.includes('arduino')
                )
            }));
            
            return this.portList;
        } catch (error) {
            this.error('Failed to list ports:', error);
            return [];
        }
    }
    
    async selectBoard(payload) {
        const { board } = payload;
        this.config.defaultBoard = board;
        await this.saveData('config.json', this.config);
        
        return { success: true, board };
    }
    
    async selectPort(payload) {
        const { port } = payload;
        this.config.defaultPort = port;
        await this.saveData('config.json', this.config);
        
        return { success: true, port };
    }
    
    async startSerialMonitor(payload) {
        const { port, baudRate = 9600 } = payload;
        
        // Close existing serial port if open
        if (this.serialPort && this.serialPort.isOpen) {
            await this.stopSerialMonitor();
        }
        
        const portPath = port || this.config.defaultPort;
        if (!portPath) {
            throw new Error('No serial port specified');
        }
        
        return new Promise((resolve, reject) => {
            this.serialPort = new SerialPort(portPath, {
                baudRate: baudRate,
                autoOpen: false
            });
            
            this.serialPort.on('data', (data) => {
                const text = data.toString();
                this.serialBuffer += text;
                
                // Send data to frontend
                this.sendMessage({
                    type: 'serial_data',
                    data: text,
                    timestamp: Date.now()
                });
                
                // Process complete lines
                const lines = this.serialBuffer.split('\n');
                this.serialBuffer = lines.pop() || '';
                
                lines.forEach(line => {
                    this.sendMessage({
                        type: 'serial_line',
                        line: line.trim(),
                        timestamp: Date.now()
                    });
                });
            });
            
            this.serialPort.on('error', (error) => {
                this.error('Serial port error:', error);
                this.sendMessage({
                    type: 'serial_error',
                    error: error.message
                });
            });
            
            this.serialPort.open((error) => {
                if (error) {
                    reject(error);
                } else {
                    this.log('Serial monitor started on port:', portPath);
                    resolve({
                        success: true,
                        port: portPath,
                        baudRate
                    });
                }
            });
        });
    }
    
    async stopSerialMonitor() {
        if (this.serialPort && this.serialPort.isOpen) {
            return new Promise((resolve) => {
                this.serialPort.close((error) => {
                    if (error) {
                        this.error('Error closing serial port:', error);
                    }
                    this.serialPort = null;
                    resolve({ success: true });
                });
            });
        }
        
        return { success: true };
    }
    
    async sendSerialData(payload) {
        const { data } = payload;
        
        if (!this.serialPort || !this.serialPort.isOpen) {
            throw new Error('Serial port not open');
        }
        
        return new Promise((resolve, reject) => {
            this.serialPort.write(data, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ success: true });
                }
            });
        });
    }
    
    async getSketchList() {
        try {
            const sketches = [];
            const sketchesDir = this.config.sketchesPath;
            
            const items = await fs.readdir(sketchesDir);
            
            for (const item of items) {
                const itemPath = path.join(sketchesDir, item);
                const stat = await fs.stat(itemPath);
                
                if (stat.isDirectory()) {
                    // Check if it's a valid sketch (has .ino file)
                    const inoFile = path.join(itemPath, `${item}.ino`);
                    try {
                        await fs.access(inoFile);
                        sketches.push({
                            name: item,
                            path: itemPath,
                            modified: stat.mtime
                        });
                    } catch (error) {
                        // Not a valid sketch directory
                    }
                }
            }
            
            return sketches.sort((a, b) => b.modified - a.modified);
        } catch (error) {
            this.error('Failed to list sketches:', error);
            return [];
        }
    }
    
    async createSketch(payload) {
        const { name, template = 'basic' } = payload;
        
        if (!name || !/^[a-zA-Z0-9_]+$/.test(name)) {
            throw new Error('Invalid sketch name. Use only letters, numbers, and underscores.');
        }
        
        const sketchPath = path.join(this.config.sketchesPath, name);
        const inoFile = path.join(sketchPath, `${name}.ino`);
        
        // Check if sketch already exists
        try {
            await fs.access(sketchPath);
            throw new Error('Sketch already exists');
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
        
        // Create sketch directory
        await fs.mkdir(sketchPath, { recursive: true });
        
        // Get template content
        const templateContent = this.getTemplate(template);
        
        // Write .ino file
        await fs.writeFile(inoFile, templateContent);
        
        return {
            success: true,
            name,
            path: sketchPath,
            file: inoFile
        };
    }
    
    getTemplate(template) {
        const templates = {
            basic: `void setup() {
  // Put your setup code here, to run once:
  Serial.begin(9600);
}

void loop() {
  // Put your main code here, to run repeatedly:
  
}`,
            blink: `/*
  Blink
  Turns an LED on for one second, then off for one second, repeatedly.
*/

// the setup function runs once when you press reset or power the board
void setup() {
  // initialize digital pin LED_BUILTIN as an output.
  pinMode(LED_BUILTIN, OUTPUT);
}

// the loop function runs over and over again forever
void loop() {
  digitalWrite(LED_BUILTIN, HIGH);   // turn the LED on (HIGH is the voltage level)
  delay(1000);                       // wait for a second
  digitalWrite(LED_BUILTIN, LOW);    // turn the LED off by making the voltage LOW
  delay(1000);                       // wait for a second
}`,
            serial: `void setup() {
  // Initialize serial communication at 9600 bits per second:
  Serial.begin(9600);
  
  // Wait for serial port to connect. Needed for native USB port only
  while (!Serial) {
    ; // wait for serial port to connect
  }
  
  Serial.println("Serial communication initialized!");
}

void loop() {
  // Check if data is available to read
  if (Serial.available() > 0) {
    // Read the incoming byte:
    char incomingByte = Serial.read();
    
    // Echo the byte back:
    Serial.print("Received: ");
    Serial.println(incomingByte);
  }
  
  // Send a heartbeat every second
  static unsigned long lastHeartbeat = 0;
  if (millis() - lastHeartbeat > 1000) {
    Serial.println("Heartbeat");
    lastHeartbeat = millis();
  }
}`
        };
        
        return templates[template] || templates.basic;
    }
    
    startBoardMonitoring() {
        // Monitor for board connections/disconnections
        this.boardMonitorInterval = setInterval(async () => {
            const currentBoards = await this.listBoards();
            
            // Check for new boards
            currentBoards.forEach(board => {
                const exists = this.boardList.find(b => b.path === board.path);
                if (!exists) {
                    this.sendMessage({
                        type: 'board_connected',
                        board
                    });
                }
            });
            
            // Check for removed boards
            this.boardList.forEach(board => {
                const exists = currentBoards.find(b => b.path === board.path);
                if (!exists) {
                    this.sendMessage({
                        type: 'board_disconnected',
                        board
                    });
                }
            });
            
            this.boardList = currentBoards;
        }, 2000); // Check every 2 seconds
    }
    
    stopBoardMonitoring() {
        if (this.boardMonitorInterval) {
            clearInterval(this.boardMonitorInterval);
            this.boardMonitorInterval = null;
        }
    }
    
    async startSerialMonitoring() {
        // Auto-start serial monitoring if a board is connected
        const boards = await this.listBoards();
        if (boards.length > 0 && this.config.enableSerial) {
            const board = boards[0];
            try {
                await this.startSerialMonitor({ port: board.path });
                this.log('Auto-started serial monitor for board:', board.path);
            } catch (error) {
                this.error('Failed to auto-start serial monitor:', error);
            }
        }
    }
    
    getStatus() {
        return {
            ...super.getStatus(),
            arduinoInstalled: !!this.config.arduinoPath,
            arduinoRunning: !!this.arduinoProcess,
            serialPortOpen: !!this.serialPort && this.serialPort.isOpen,
            connectedBoards: this.boardList.length,
            currentPort: this.config.defaultPort,
            currentBoard: this.config.defaultBoard
        };
    }
}

module.exports = ArduinoIDEPlugin;