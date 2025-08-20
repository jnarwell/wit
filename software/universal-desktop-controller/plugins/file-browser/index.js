/**
 * File Browser Plugin for W.I.T. Universal Desktop Controller
 * Provides complete file system access and management capabilities
 */

const { WITPlugin } = require('../../src/plugins/base/WITPlugin');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const { spawn, exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const chokidar = require('chokidar');
const mime = require('mime-types');

class FileBrowserPlugin extends WITPlugin {
    constructor(context) {
        super(context);
        
        this.watchers = new Map();
        this.openFiles = new Map();
        this.fileHandles = new Map();
    }
    
    async initialize() {
        await super.initialize();
        this.log('File Browser plugin initializing...');
        
        // Initialize config with defaults
        this.config = {
            rootPaths: this.config.rootPaths || 'auto',
            hiddenFiles: this.config.hiddenFiles !== false,
            followSymlinks: this.config.followSymlinks !== false,
            watchChanges: this.config.watchChanges !== false,
            maxFileSize: this.config.maxFileSize || 104857600, // 100MB
            ...this.config
        };
        
        // Auto-detect root paths if needed
        if (this.config.rootPaths === 'auto') {
            this.config.rootPaths = this.getDefaultRootPaths();
        }
        
        // Validate root paths exist
        for (const rootPath of this.config.rootPaths) {
            try {
                await fs.access(rootPath);
                this.log(`Root path accessible: ${rootPath}`);
            } catch (error) {
                this.log(`Root path not accessible: ${rootPath}`, error.message);
            }
        }
        
        this.log('File Browser plugin initialized');
    }
    
    getDefaultRootPaths() {
        const platform = os.platform();
        const home = os.homedir();
        
        switch (platform) {
            case 'darwin':
                return [
                    '/',
                    home,
                    path.join(home, 'Desktop'),
                    path.join(home, 'Documents'),
                    path.join(home, 'Downloads'),
                    '/Volumes',
                    '/Applications'
                ];
                
            case 'win32':
                const drives = this.getWindowsDrives();
                return [
                    ...drives,
                    home,
                    path.join(home, 'Desktop'),
                    path.join(home, 'Documents'),
                    path.join(home, 'Downloads'),
                    'C:\\Program Files',
                    'C:\\Program Files (x86)'
                ];
                
            case 'linux':
                return [
                    '/',
                    home,
                    path.join(home, 'Desktop'),
                    path.join(home, 'Documents'),
                    path.join(home, 'Downloads'),
                    '/media',
                    '/mnt',
                    '/opt'
                ];
                
            default:
                return [home];
        }
    }
    
    getWindowsDrives() {
        const drives = [];
        for (let i = 65; i <= 90; i++) {
            const drive = String.fromCharCode(i) + ':\\';
            if (fsSync.existsSync(drive)) {
                drives.push(drive);
            }
        }
        return drives;
    }
    
    async start() {
        await super.start();
        this.log('File Browser plugin started');
    }
    
    async stop() {
        // Stop all watchers
        for (const [path, watcher] of this.watchers) {
            await watcher.close();
        }
        this.watchers.clear();
        
        // Close all open files
        for (const [path, handle] of this.fileHandles) {
            try {
                await handle.close();
            } catch (error) {
                // Ignore errors on close
            }
        }
        this.fileHandles.clear();
        
        await super.stop();
        this.log('File Browser plugin stopped');
    }
    
    async onMessage(message) {
        const { action, payload } = message;
        
        try {
            switch (action) {
                case 'getRoots':
                    return await this.getRootPaths();
                    
                case 'listDirectory':
                    return await this.listDirectory(payload);
                    
                case 'getFileInfo':
                    return await this.getFileInfo(payload);
                    
                case 'readFile':
                    return await this.readFile(payload);
                    
                case 'writeFile':
                    return await this.writeFile(payload);
                    
                case 'createDirectory':
                    return await this.createDirectory(payload);
                    
                case 'delete':
                    return await this.deleteItem(payload);
                    
                case 'rename':
                    return await this.renameItem(payload);
                    
                case 'copy':
                    return await this.copyItem(payload);
                    
                case 'move':
                    return await this.moveItem(payload);
                    
                case 'search':
                    return await this.searchFiles(payload);
                    
                case 'watchDirectory':
                    return await this.watchDirectory(payload);
                    
                case 'unwatchDirectory':
                    return await this.unwatchDirectory(payload);
                    
                case 'openWithDefault':
                    return await this.openWithDefaultApp(payload);
                    
                case 'execute':
                    return await this.executeFile(payload);
                    
                case 'getSystemInfo':
                    return await this.getSystemInfo();
                    
                case 'getDiskUsage':
                    return await this.getDiskUsage(payload);
                    
                case 'compress':
                    return await this.compressFiles(payload);
                    
                case 'decompress':
                    return await this.decompressFile(payload);
                    
                case 'getStatus':
                    return this.getStatus();
                    
                default:
                    throw new Error(`Unknown action: ${action}`);
            }
        } catch (error) {
            this.error(`Error handling action ${action}:`, error);
            throw error;
        }
    }
    
    async getRootPaths() {
        const roots = [];
        
        for (const rootPath of this.config.rootPaths) {
            try {
                const stats = await fs.stat(rootPath);
                const info = {
                    path: rootPath,
                    name: path.basename(rootPath) || rootPath,
                    type: 'directory',
                    size: stats.size,
                    modified: stats.mtime,
                    created: stats.birthtime,
                    permissions: this.getPermissions(stats)
                };
                
                // Add disk usage for root paths
                if (os.platform() !== 'win32' || rootPath.endsWith(':\\')) {
                    try {
                        const usage = await this.getDiskUsage({ path: rootPath });
                        info.diskUsage = usage;
                    } catch (error) {
                        // Ignore disk usage errors
                    }
                }
                
                roots.push(info);
            } catch (error) {
                this.log(`Cannot access root path ${rootPath}:`, error.message);
            }
        }
        
        return roots;
    }
    
    async listDirectory(payload) {
        const { path: dirPath, showHidden = this.config.hiddenFiles } = payload;
        
        // Validate path
        this.validatePath(dirPath);
        
        const items = await fs.readdir(dirPath);
        const results = [];
        
        for (const item of items) {
            // Skip hidden files if not showing them
            if (!showHidden && item.startsWith('.')) {
                continue;
            }
            
            const itemPath = path.join(dirPath, item);
            
            try {
                const stats = await fs.lstat(itemPath);
                const isDirectory = stats.isDirectory();
                const isSymlink = stats.isSymbolicLink();
                
                let finalStats = stats;
                let linkTarget = null;
                
                // Follow symlinks if configured
                if (isSymlink && this.config.followSymlinks) {
                    try {
                        linkTarget = await fs.readlink(itemPath);
                        finalStats = await fs.stat(itemPath);
                    } catch (error) {
                        // Broken symlink
                    }
                }
                
                results.push({
                    name: item,
                    path: itemPath,
                    type: finalStats.isDirectory() ? 'directory' : 'file',
                    size: finalStats.size,
                    modified: finalStats.mtime,
                    created: finalStats.birthtime,
                    permissions: this.getPermissions(finalStats),
                    isSymlink,
                    linkTarget,
                    mimeType: !finalStats.isDirectory() ? mime.lookup(item) || 'application/octet-stream' : null,
                    extension: !finalStats.isDirectory() ? path.extname(item) : null
                });
            } catch (error) {
                // Handle permission errors
                results.push({
                    name: item,
                    path: itemPath,
                    type: 'unknown',
                    error: error.message
                });
            }
        }
        
        // Sort directories first, then by name
        results.sort((a, b) => {
            if (a.type === 'directory' && b.type !== 'directory') return -1;
            if (a.type !== 'directory' && b.type === 'directory') return 1;
            return a.name.localeCompare(b.name);
        });
        
        return results;
    }
    
    async getFileInfo(payload) {
        const { path: filePath } = payload;
        
        this.validatePath(filePath);
        
        const stats = await fs.lstat(filePath);
        const isDirectory = stats.isDirectory();
        const isSymlink = stats.isSymbolicLink();
        
        let finalStats = stats;
        let linkTarget = null;
        
        if (isSymlink) {
            try {
                linkTarget = await fs.readlink(filePath);
                finalStats = await fs.stat(filePath);
            } catch (error) {
                // Broken symlink
            }
        }
        
        const info = {
            name: path.basename(filePath),
            path: filePath,
            type: finalStats.isDirectory() ? 'directory' : 'file',
            size: finalStats.size,
            modified: finalStats.mtime,
            created: finalStats.birthtime,
            accessed: finalStats.atime,
            permissions: this.getPermissions(finalStats),
            isSymlink,
            linkTarget,
            mimeType: !finalStats.isDirectory() ? mime.lookup(filePath) || 'application/octet-stream' : null,
            extension: !finalStats.isDirectory() ? path.extname(filePath) : null
        };
        
        // Add additional info for directories
        if (isDirectory) {
            try {
                const items = await fs.readdir(filePath);
                info.itemCount = items.length;
            } catch (error) {
                info.itemCount = 0;
                info.error = error.message;
            }
        }
        
        return info;
    }
    
    async readFile(payload) {
        const { path: filePath, encoding = 'utf8', start, end } = payload;
        
        this.validatePath(filePath);
        
        // Check file size
        const stats = await fs.stat(filePath);
        if (stats.size > this.config.maxFileSize) {
            throw new Error(`File too large (${stats.size} bytes). Maximum allowed: ${this.config.maxFileSize} bytes`);
        }
        
        // Read file with optional range
        if (start !== undefined || end !== undefined) {
            const stream = fsSync.createReadStream(filePath, { start, end, encoding });
            const chunks = [];
            
            return new Promise((resolve, reject) => {
                stream.on('data', chunk => chunks.push(chunk));
                stream.on('end', () => resolve(chunks.join('')));
                stream.on('error', reject);
            });
        } else {
            return await fs.readFile(filePath, encoding);
        }
    }
    
    async writeFile(payload) {
        const { path: filePath, content, encoding = 'utf8', append = false } = payload;
        
        this.validatePath(filePath);
        
        // Create directory if it doesn't exist
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        
        if (append) {
            await fs.appendFile(filePath, content, encoding);
        } else {
            await fs.writeFile(filePath, content, encoding);
        }
        
        return { success: true, path: filePath };
    }
    
    async createDirectory(payload) {
        const { path: dirPath, recursive = true } = payload;
        
        this.validatePath(dirPath);
        
        try {
            await fs.mkdir(dirPath, { recursive });
            return { success: true, path: dirPath };
        } catch (error) {
            // Provide more user-friendly error messages
            if (error.code === 'EACCES') {
                throw new Error(`Permission denied: Cannot create directory at ${dirPath}`);
            } else if (error.code === 'EEXIST') {
                throw new Error(`Directory already exists: ${dirPath}`);
            } else if (error.code === 'ENOENT') {
                throw new Error(`Parent directory does not exist: ${path.dirname(dirPath)}`);
            } else {
                throw error;
            }
        }
    }
    
    async deleteItem(payload) {
        const { path: itemPath, recursive = true } = payload;
        
        this.validatePath(itemPath);
        
        const stats = await fs.lstat(itemPath);
        
        if (stats.isDirectory()) {
            if (recursive) {
                await fs.rm(itemPath, { recursive: true, force: true });
            } else {
                await fs.rmdir(itemPath);
            }
        } else {
            await fs.unlink(itemPath);
        }
        
        return { success: true, path: itemPath };
    }
    
    async renameItem(payload) {
        const { oldPath, newPath } = payload;
        
        this.validatePath(oldPath);
        this.validatePath(newPath);
        
        await fs.rename(oldPath, newPath);
        
        return { success: true, oldPath, newPath };
    }
    
    async copyItem(payload) {
        const { source, destination, recursive = true } = payload;
        
        this.validatePath(source);
        this.validatePath(destination);
        
        const stats = await fs.lstat(source);
        
        if (stats.isDirectory()) {
            await this.copyDirectory(source, destination, recursive);
        } else {
            await fs.copyFile(source, destination);
        }
        
        return { success: true, source, destination };
    }
    
    async copyDirectory(source, destination, recursive) {
        await fs.mkdir(destination, { recursive: true });
        
        if (recursive) {
            const items = await fs.readdir(source);
            
            for (const item of items) {
                const sourcePath = path.join(source, item);
                const destPath = path.join(destination, item);
                
                const stats = await fs.lstat(sourcePath);
                
                if (stats.isDirectory()) {
                    await this.copyDirectory(sourcePath, destPath, recursive);
                } else {
                    await fs.copyFile(sourcePath, destPath);
                }
            }
        }
    }
    
    async moveItem(payload) {
        const { source, destination } = payload;
        
        this.validatePath(source);
        this.validatePath(destination);
        
        // Try rename first (faster if on same filesystem)
        try {
            await fs.rename(source, destination);
        } catch (error) {
            // If rename fails (e.g., cross-device), copy and delete
            await this.copyItem({ source, destination, recursive: true });
            await this.deleteItem({ path: source, recursive: true });
        }
        
        return { success: true, source, destination };
    }
    
    async searchFiles(payload) {
        const { 
            directory, 
            pattern, 
            maxResults = 100,
            includeDirectories = true,
            includeFiles = true,
            caseSensitive = false
        } = payload;
        
        this.validatePath(directory);
        
        const results = [];
        const regex = new RegExp(pattern, caseSensitive ? '' : 'i');
        
        const searchDir = async (dir, depth = 0) => {
            if (results.length >= maxResults || depth > 10) {
                return;
            }
            
            try {
                const items = await fs.readdir(dir);
                
                for (const item of items) {
                    if (results.length >= maxResults) break;
                    
                    const itemPath = path.join(dir, item);
                    
                    try {
                        const stats = await fs.lstat(itemPath);
                        const isDirectory = stats.isDirectory();
                        
                        // Check if item matches pattern
                        if (regex.test(item)) {
                            if ((isDirectory && includeDirectories) || (!isDirectory && includeFiles)) {
                                results.push({
                                    name: item,
                                    path: itemPath,
                                    type: isDirectory ? 'directory' : 'file',
                                    size: stats.size,
                                    modified: stats.mtime
                                });
                            }
                        }
                        
                        // Recurse into directories
                        if (isDirectory && !item.startsWith('.')) {
                            await searchDir(itemPath, depth + 1);
                        }
                    } catch (error) {
                        // Skip items we can't access
                    }
                }
            } catch (error) {
                // Skip directories we can't access
            }
        };
        
        await searchDir(directory);
        
        return results;
    }
    
    async watchDirectory(payload) {
        const { path: dirPath, recursive = true } = payload;
        
        this.validatePath(dirPath);
        
        // Stop existing watcher if any
        if (this.watchers.has(dirPath)) {
            await this.watchers.get(dirPath).close();
        }
        
        // Create new watcher
        const watcher = chokidar.watch(dirPath, {
            persistent: true,
            ignoreInitial: true,
            depth: recursive ? undefined : 0,
            awaitWriteFinish: {
                stabilityThreshold: 200,
                pollInterval: 100
            }
        });
        
        // Set up event handlers
        watcher
            .on('add', path => this.emitFileEvent('added', path))
            .on('change', path => this.emitFileEvent('changed', path))
            .on('unlink', path => this.emitFileEvent('deleted', path))
            .on('addDir', path => this.emitFileEvent('directoryAdded', path))
            .on('unlinkDir', path => this.emitFileEvent('directoryDeleted', path))
            .on('error', error => this.error('Watcher error:', error));
        
        this.watchers.set(dirPath, watcher);
        
        return { success: true, watching: dirPath };
    }
    
    async unwatchDirectory(payload) {
        const { path: dirPath } = payload;
        
        if (this.watchers.has(dirPath)) {
            await this.watchers.get(dirPath).close();
            this.watchers.delete(dirPath);
        }
        
        return { success: true, path: dirPath };
    }
    
    async openWithDefaultApp(payload) {
        const { path: filePath } = payload;
        
        this.validatePath(filePath);
        
        const platform = os.platform();
        let command;
        
        switch (platform) {
            case 'darwin':
                command = `open "${filePath}"`;
                break;
            case 'win32':
                command = `start "" "${filePath}"`;
                break;
            case 'linux':
                command = `xdg-open "${filePath}"`;
                break;
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
        
        await execAsync(command);
        
        return { success: true, path: filePath };
    }
    
    async executeFile(payload) {
        const { path: filePath, args = [], cwd } = payload;
        
        this.validatePath(filePath);
        
        // Check if file is executable
        try {
            await fs.access(filePath, fs.constants.X_OK);
        } catch (error) {
            throw new Error('File is not executable');
        }
        
        return new Promise((resolve, reject) => {
            const process = spawn(filePath, args, {
                cwd: cwd || path.dirname(filePath),
                detached: true
            });
            
            process.unref();
            
            process.on('error', reject);
            process.on('spawn', () => {
                resolve({
                    success: true,
                    pid: process.pid
                });
            });
        });
    }
    
    async getSystemInfo() {
        return {
            platform: os.platform(),
            arch: os.arch(),
            hostname: os.hostname(),
            homedir: os.homedir(),
            tmpdir: os.tmpdir(),
            username: os.userInfo().username,
            shell: os.userInfo().shell
        };
    }
    
    async getDiskUsage(payload) {
        const { path: diskPath = '/' } = payload;
        
        const platform = os.platform();
        let command;
        
        if (platform === 'win32') {
            const drive = diskPath.charAt(0).toUpperCase();
            command = `wmic logicaldisk where "DeviceID='${drive}:'" get Size,FreeSpace /format:value`;
        } else {
            command = `df -k "${diskPath}" | tail -1`;
        }
        
        const { stdout } = await execAsync(command);
        
        if (platform === 'win32') {
            const lines = stdout.trim().split('\n');
            const freeSpace = parseInt(lines.find(l => l.startsWith('FreeSpace=')).split('=')[1]);
            const size = parseInt(lines.find(l => l.startsWith('Size=')).split('=')[1]);
            
            return {
                total: size,
                free: freeSpace,
                used: size - freeSpace,
                percentage: ((size - freeSpace) / size * 100).toFixed(2)
            };
        } else {
            const parts = stdout.trim().split(/\s+/);
            const total = parseInt(parts[1]) * 1024;
            const used = parseInt(parts[2]) * 1024;
            const free = parseInt(parts[3]) * 1024;
            const percentage = parts[4];
            
            return {
                total,
                used,
                free,
                percentage: parseFloat(percentage)
            };
        }
    }
    
    async compressFiles(payload) {
        const { files, outputPath, format = 'zip' } = payload;
        
        // Validate all input paths
        for (const file of files) {
            this.validatePath(file);
        }
        this.validatePath(outputPath);
        
        const platform = os.platform();
        let command;
        
        if (format === 'zip') {
            if (platform === 'win32') {
                // Use PowerShell for Windows
                const fileList = files.map(f => `"${f}"`).join(',');
                command = `powershell -Command "Compress-Archive -Path ${fileList} -DestinationPath '${outputPath}'"`;
            } else {
                // Use zip command for Unix-like systems
                const fileList = files.map(f => `"${f}"`).join(' ');
                command = `zip -r "${outputPath}" ${fileList}`;
            }
        } else if (format === 'tar.gz') {
            const fileList = files.map(f => `"${f}"`).join(' ');
            command = `tar -czf "${outputPath}" ${fileList}`;
        } else {
            throw new Error(`Unsupported compression format: ${format}`);
        }
        
        await execAsync(command);
        
        return { success: true, outputPath };
    }
    
    async decompressFile(payload) {
        const { filePath, outputDir } = payload;
        
        this.validatePath(filePath);
        this.validatePath(outputDir);
        
        // Create output directory
        await fs.mkdir(outputDir, { recursive: true });
        
        const platform = os.platform();
        const ext = path.extname(filePath).toLowerCase();
        let command;
        
        if (ext === '.zip') {
            if (platform === 'win32') {
                command = `powershell -Command "Expand-Archive -Path '${filePath}' -DestinationPath '${outputDir}'"`;
            } else {
                command = `unzip "${filePath}" -d "${outputDir}"`;
            }
        } else if (ext === '.gz' || filePath.endsWith('.tar.gz')) {
            command = `tar -xzf "${filePath}" -C "${outputDir}"`;
        } else if (ext === '.tar') {
            command = `tar -xf "${filePath}" -C "${outputDir}"`;
        } else {
            throw new Error(`Unsupported archive format: ${ext}`);
        }
        
        await execAsync(command);
        
        return { success: true, outputDir };
    }
    
    getPermissions(stats) {
        const mode = stats.mode;
        
        return {
            owner: {
                read: !!(mode & 0o400),
                write: !!(mode & 0o200),
                execute: !!(mode & 0o100)
            },
            group: {
                read: !!(mode & 0o040),
                write: !!(mode & 0o020),
                execute: !!(mode & 0o010)
            },
            others: {
                read: !!(mode & 0o004),
                write: !!(mode & 0o002),
                execute: !!(mode & 0o001)
            },
            octal: (mode & parseInt('777', 8)).toString(8)
        };
    }
    
    validatePath(filePath) {
        // Normalize path
        const normalized = path.normalize(filePath);
        
        // Prevent directory traversal attacks
        if (normalized.includes('..')) {
            throw new Error('Directory traversal not allowed');
        }
        
        // Check if path is within allowed roots
        const isAllowed = this.config.rootPaths.some(root => {
            return normalized.startsWith(path.normalize(root));
        });
        
        if (!isAllowed) {
            throw new Error(`Access denied: Path "${filePath}" is outside allowed directories`);
        }
        
        return normalized;
    }
    
    emitFileEvent(event, filePath) {
        this.sendMessage({
            type: 'file_event',
            event,
            path: filePath,
            timestamp: Date.now()
        });
    }
    
    getStatus() {
        return {
            ...super.getStatus(),
            rootPaths: this.config.rootPaths,
            watchedDirectories: Array.from(this.watchers.keys()),
            openFiles: Array.from(this.openFiles.keys()),
            config: {
                hiddenFiles: this.config.hiddenFiles,
                followSymlinks: this.config.followSymlinks,
                maxFileSize: this.config.maxFileSize
            }
        };
    }
}

module.exports = FileBrowserPlugin;