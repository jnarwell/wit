const { WITPlugin } = require('../../src/plugins/base/WITPlugin');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class FileManagerPlugin extends WITPlugin {
    constructor(context) {
        super(context);
        this.config = {
            defaultPath: os.homedir(),
            maxFileSize: 10 * 1024 * 1024, // 10MB limit for safety
            allowedExtensions: null // null means all extensions allowed
        };
    }
    
    async initialize() {
        await super.initialize();
        
        // Load saved configuration
        this.config = await this.loadData('config.json') || this.config;
        
        this.log('info', 'File Manager plugin initialized');
    }
    
    async start() {
        await super.start();
        
        this.log('info', 'File Manager plugin started');
        
        // Emit status update
        this.emit('plugin_status_update', {
            pluginId: this.id,
            status: 'active'
        });
    }
    
    async onMessage(message) {
        const { action, payload = {} } = message;
        return await this.handleCommand(action, payload);
    }
    
    async handleCommand(command, payload = {}) {
        this.log('info', `Handling command: ${command}`);
        
        switch (command) {
            case 'createFile':
                return await this.createFile(payload);
                
            case 'createDirectory':
                return await this.createDirectory(payload);
                
            case 'readFile':
                return await this.readFileContent(payload);
                
            case 'writeFile':
                return await this.writeFileContent(payload);
                
            case 'listDirectory':
                return await this.listDirectory(payload);
                
            case 'deleteFile':
                return await this.deleteFile(payload);
                
            case 'copyFile':
                return await this.copyFile(payload);
                
            case 'moveFile':
                return await this.moveFile(payload);
                
            case 'getFileInfo':
                return await this.getFileInfo(payload);
                
            case 'getStatus':
                return this.getStatus();
                
            default:
                throw new Error(`Unknown command: ${command}`);
        }
    }
    
    async createFile(payload) {
        const { filePath, content = '', encoding = 'utf8' } = payload;
        
        if (!filePath) {
            throw new Error('File path is required');
        }
        
        try {
            // Ensure parent directory exists
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });
            
            // Check if file already exists
            try {
                await fs.access(filePath);
                throw new Error(`File already exists: ${filePath}`);
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
            }
            
            // Create the file
            await fs.writeFile(filePath, content, encoding);
            
            this.log('info', `Created file: ${filePath}`);
            return { 
                success: true, 
                filePath,
                size: Buffer.byteLength(content, encoding)
            };
        } catch (error) {
            this.log('error', `Failed to create file: ${error.message}`);
            throw error;
        }
    }
    
    async createDirectory(payload) {
        const { dirPath } = payload;
        
        if (!dirPath) {
            throw new Error('Directory path is required');
        }
        
        try {
            await fs.mkdir(dirPath, { recursive: true });
            
            this.log('info', `Created directory: ${dirPath}`);
            return { success: true, dirPath };
        } catch (error) {
            this.log('error', `Failed to create directory: ${error.message}`);
            throw error;
        }
    }
    
    async readFileContent(payload) {
        const { filePath, encoding = 'utf8' } = payload;
        
        if (!filePath) {
            throw new Error('File path is required');
        }
        
        try {
            const stats = await fs.stat(filePath);
            
            // Check file size limit
            if (stats.size > this.config.maxFileSize) {
                throw new Error(`File too large. Max size: ${this.config.maxFileSize} bytes`);
            }
            
            const content = await fs.readFile(filePath, encoding);
            
            return { 
                success: true, 
                content,
                size: stats.size,
                modified: stats.mtime
            };
        } catch (error) {
            this.log('error', `Failed to read file: ${error.message}`);
            throw error;
        }
    }
    
    async writeFileContent(payload) {
        const { filePath, content, encoding = 'utf8', mode } = payload;
        
        if (!filePath || content === undefined) {
            throw new Error('File path and content are required');
        }
        
        try {
            // Check content size
            const size = Buffer.byteLength(content, encoding);
            if (size > this.config.maxFileSize) {
                throw new Error(`Content too large. Max size: ${this.config.maxFileSize} bytes`);
            }
            
            // Write options
            const options = { encoding };
            if (mode) options.mode = mode;
            
            await fs.writeFile(filePath, content, options);
            
            this.log('info', `Wrote to file: ${filePath}`);
            return { success: true, filePath, size };
        } catch (error) {
            this.log('error', `Failed to write file: ${error.message}`);
            throw error;
        }
    }
    
    async listDirectory(payload) {
        const { dirPath = this.config.defaultPath, includeHidden = false } = payload;
        
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            const items = [];
            for (const entry of entries) {
                // Skip hidden files unless requested
                if (!includeHidden && entry.name.startsWith('.')) continue;
                
                const fullPath = path.join(dirPath, entry.name);
                
                try {
                    const stats = await fs.stat(fullPath);
                    items.push({
                        name: entry.name,
                        path: fullPath,
                        type: entry.isDirectory() ? 'directory' : 'file',
                        size: stats.size,
                        modified: stats.mtime,
                        created: stats.birthtime
                    });
                } catch (error) {
                    // Skip items we can't stat
                    this.log('warn', `Could not stat ${fullPath}: ${error.message}`);
                }
            }
            
            return { 
                success: true, 
                path: dirPath,
                items: items.sort((a, b) => {
                    // Directories first, then alphabetical
                    if (a.type !== b.type) {
                        return a.type === 'directory' ? -1 : 1;
                    }
                    return a.name.localeCompare(b.name);
                })
            };
        } catch (error) {
            this.log('error', `Failed to list directory: ${error.message}`);
            throw error;
        }
    }
    
    async deleteFile(payload) {
        const { filePath, recursive = false } = payload;
        
        if (!filePath) {
            throw new Error('File path is required');
        }
        
        // Safety check - don't delete system directories
        const safePaths = [os.homedir(), '/', 'C:\\', '/usr', '/etc', '/var'];
        if (safePaths.includes(filePath)) {
            throw new Error('Cannot delete system directories');
        }
        
        try {
            const stats = await fs.stat(filePath);
            
            if (stats.isDirectory() && !recursive) {
                throw new Error('Use recursive option to delete directories');
            }
            
            if (stats.isDirectory()) {
                await fs.rmdir(filePath, { recursive: true });
            } else {
                await fs.unlink(filePath);
            }
            
            this.log('info', `Deleted: ${filePath}`);
            return { success: true, filePath };
        } catch (error) {
            this.log('error', `Failed to delete: ${error.message}`);
            throw error;
        }
    }
    
    async copyFile(payload) {
        const { sourcePath, destinationPath, overwrite = false } = payload;
        
        if (!sourcePath || !destinationPath) {
            throw new Error('Source and destination paths are required');
        }
        
        try {
            // Check if destination exists
            if (!overwrite) {
                try {
                    await fs.access(destinationPath);
                    throw new Error(`Destination already exists: ${destinationPath}`);
                } catch (error) {
                    if (error.code !== 'ENOENT') throw error;
                }
            }
            
            // Ensure destination directory exists
            await fs.mkdir(path.dirname(destinationPath), { recursive: true });
            
            // Copy the file
            await fs.copyFile(sourcePath, destinationPath);
            
            this.log('info', `Copied ${sourcePath} to ${destinationPath}`);
            return { success: true, sourcePath, destinationPath };
        } catch (error) {
            this.log('error', `Failed to copy file: ${error.message}`);
            throw error;
        }
    }
    
    async moveFile(payload) {
        const { sourcePath, destinationPath, overwrite = false } = payload;
        
        if (!sourcePath || !destinationPath) {
            throw new Error('Source and destination paths are required');
        }
        
        try {
            // Check if destination exists
            if (!overwrite) {
                try {
                    await fs.access(destinationPath);
                    throw new Error(`Destination already exists: ${destinationPath}`);
                } catch (error) {
                    if (error.code !== 'ENOENT') throw error;
                }
            }
            
            // Ensure destination directory exists
            await fs.mkdir(path.dirname(destinationPath), { recursive: true });
            
            // Move/rename the file
            await fs.rename(sourcePath, destinationPath);
            
            this.log('info', `Moved ${sourcePath} to ${destinationPath}`);
            return { success: true, sourcePath, destinationPath };
        } catch (error) {
            this.log('error', `Failed to move file: ${error.message}`);
            throw error;
        }
    }
    
    async getFileInfo(payload) {
        const { filePath } = payload;
        
        if (!filePath) {
            throw new Error('File path is required');
        }
        
        try {
            const stats = await fs.stat(filePath);
            const parsed = path.parse(filePath);
            
            return {
                success: true,
                name: parsed.base,
                dir: parsed.dir,
                ext: parsed.ext,
                size: stats.size,
                isDirectory: stats.isDirectory(),
                isFile: stats.isFile(),
                created: stats.birthtime,
                modified: stats.mtime,
                accessed: stats.atime,
                permissions: stats.mode
            };
        } catch (error) {
            this.log('error', `Failed to get file info: ${error.message}`);
            throw error;
        }
    }
    
    getStatus() {
        return {
            ...super.getStatus(),
            config: this.config
        };
    }
    
    async stop() {
        await super.stop();
        this.log('info', 'File Manager plugin stopped');
    }
}

module.exports = FileManagerPlugin;