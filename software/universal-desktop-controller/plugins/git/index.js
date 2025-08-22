/**
 * Git Plugin for W.I.T. Universal Desktop Controller
 * Provides comprehensive Git integration for version control of CAD files, code, and project assets
 */

const { WITPlugin } = require('../../src/plugins/base/WITPlugin');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { promisify } = require('util');
const execAsync = promisify(exec);

class GitPlugin extends WITPlugin {
    constructor(context) {
        super(context);
        
        this.gitPath = null;
        this.gitVersion = null;
        this.repositories = new Map(); // Map of repo path -> repo info
        this.activeWatchers = new Map();
        this.fetchIntervals = new Map();
        
        // Default configuration
        this.config = {
            repositoriesPath: path.join(os.homedir(), 'Documents', 'GitRepos'),
            defaultBranch: 'main',
            autoFetch: true,
            fetchInterval: 300, // 5 minutes
            diffTool: 'internal',
            mergeStrategy: 'merge',
            cadDiffEnabled: true,
            supportedCADFormats: ['step', 'stl', 'iges', 'fcstd', 'f3d', 'dwg', 'dxf'],
            commitTemplate: '',
            signCommits: false,
            ...this.config
        };
    }
    
    async initialize() {
        try {
            await super.initialize();
            
            this.log('Git plugin initializing...');
            
            // Ensure repositories directory exists
            try {
                const reposPath = this.expandPath(this.config.repositoriesPath);
                await fs.mkdir(reposPath, { recursive: true });
            } catch (error) {
                this.log('Warning: Could not create repositories directory:', error.message);
            }
            
            // Detect Git installation
            await this.detectGit();
            
            if (this.gitPath) {
                this.log(`Git found at: ${this.gitPath}`);
                this.log(`Git version: ${this.gitVersion}`);
                
                // Configure Git if needed
                await this.configureGit();
                
                // Scan for existing repositories
                await this.scanRepositories();
                
                // Load saved repository metadata
                try {
                    const savedRepos = await this.loadData('repositories.json');
                    if (savedRepos) {
                        for (const [repoPath, repoInfo] of Object.entries(savedRepos)) {
                            this.repositories.set(repoPath, repoInfo);
                        }
                    }
                } catch (error) {
                    this.log('No saved repository data found');
                }
            } else {
                this.log('Git not found. Please install Git from https://git-scm.com/');
            }
            
            this.log('Git plugin initialized');
        } catch (error) {
            this.log('Error during initialization:', error.message);
            // Don't throw - allow plugin to load even with errors
        }
    }
    
    async start() {
        await super.start();
        
        // Start auto-fetch for repositories if enabled
        if (this.config.autoFetch && this.gitPath) {
            for (const [repoPath, repoInfo] of this.repositories) {
                if (repoInfo.hasRemote) {
                    this.startAutoFetch(repoPath);
                }
            }
        }
        
        this.log('Git plugin started successfully');
        
        // Emit status update
        this.emit('plugin_status_update', {
            pluginId: this.id,
            status: 'active'
        });
    }
    
    async stop() {
        // Stop all watchers
        for (const [path, watcher] of this.activeWatchers) {
            if (watcher && typeof watcher.close === 'function') {
                watcher.close();
            }
        }
        this.activeWatchers.clear();
        
        // Clear fetch intervals
        for (const [path, interval] of this.fetchIntervals) {
            clearInterval(interval);
        }
        this.fetchIntervals.clear();
        
        // Save repository metadata
        try {
            const reposData = {};
            for (const [repoPath, repoInfo] of this.repositories) {
                reposData[repoPath] = repoInfo;
            }
            await this.saveData('repositories.json', reposData);
        } catch (error) {
            this.log('Failed to save repository data:', error.message);
        }
        
        await super.stop();
        this.log('Git plugin stopped');
    }
    
    async detectGit() {
        try {
            this.log('Detecting Git installation...');
            
            // Check configured path first
            if (this.config.gitPath && this.config.gitPath !== 'auto') {
                try {
                    await fs.access(this.config.gitPath);
                    this.gitPath = this.config.gitPath;
                    this.gitVersion = await this.getGitVersion(this.gitPath);
                    return;
                } catch (error) {
                    this.log('Configured Git path not found:', this.config.gitPath);
                }
            }
            
            // Auto-detect Git
            const platform = os.platform();
            const manifest = require('./manifest.json');
            const possiblePaths = manifest.requirements.git.paths[platform] || [];
            
            for (const testPath of possiblePaths) {
                try {
                    const expandedPath = testPath.replace(/%([^%]+)%/g, (_, varName) => {
                        return process.env[varName] || '';
                    });
                    await fs.access(expandedPath);
                    this.gitPath = expandedPath;
                    this.gitVersion = await this.getGitVersion(expandedPath);
                    
                    // Save detected path
                    this.config.gitPath = expandedPath;
                    try {
                        await this.saveData('config.json', this.config);
                    } catch (error) {
                        this.log('Warning: Could not save config:', error.message);
                    }
                    break;
                } catch (error) {
                    // Continue searching
                }
            }
            
            // Try command line
            if (!this.gitPath) {
                try {
                    const { stdout } = await execAsync('which git || where git');
                    const cmdPath = stdout.trim().split('\n')[0];
                    if (cmdPath) {
                        this.gitPath = cmdPath;
                        this.gitVersion = await this.getGitVersion(cmdPath);
                    }
                } catch (error) {
                    // Command not found
                }
            }
        } catch (error) {
            this.log('Error detecting Git:', error.message);
        }
    }
    
    async getGitVersion(gitPath) {
        try {
            const { stdout } = await execAsync(`"${gitPath}" --version`);
            const versionMatch = stdout.match(/git version (\d+\.\d+\.\d+)/);
            return versionMatch ? versionMatch[1] : 'unknown';
        } catch (error) {
            this.log('Failed to get Git version:', error.message);
            return 'unknown';
        }
    }
    
    async configureGit() {
        try {
            // Set default branch name if not already set
            const { stdout: currentDefault } = await execAsync(`"${this.gitPath}" config --global init.defaultBranch`);
            if (!currentDefault.trim()) {
                await execAsync(`"${this.gitPath}" config --global init.defaultBranch ${this.config.defaultBranch}`);
                this.log(`Set default branch to: ${this.config.defaultBranch}`);
            }
            
            // Enable long paths on Windows
            if (os.platform() === 'win32') {
                await execAsync(`"${this.gitPath}" config --global core.longpaths true`);
            }
            
            // Set up diff tool for CAD files if enabled
            if (this.config.cadDiffEnabled) {
                // Register custom diff driver for CAD files
                for (const format of this.config.supportedCADFormats) {
                    await execAsync(`"${this.gitPath}" config --global diff.${format}.textconv "echo 'Binary CAD file'"`);
                }
            }
        } catch (error) {
            this.log('Warning: Some Git configuration failed:', error.message);
        }
    }
    
    async scanRepositories() {
        try {
            const reposPath = this.expandPath(this.config.repositoriesPath);
            const entries = await fs.readdir(reposPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const repoPath = path.join(reposPath, entry.name);
                    const gitDir = path.join(repoPath, '.git');
                    
                    try {
                        await fs.access(gitDir);
                        // This is a Git repository
                        const repoInfo = await this.getRepositoryInfo(repoPath);
                        this.repositories.set(repoPath, repoInfo);
                    } catch (error) {
                        // Not a Git repository
                    }
                }
            }
            
            this.log(`Found ${this.repositories.size} repositories`);
        } catch (error) {
            this.log('Error scanning repositories:', error.message);
        }
    }
    
    async getRepositoryInfo(repoPath) {
        try {
            const info = {
                path: repoPath,
                name: path.basename(repoPath),
                branch: 'unknown',
                hasRemote: false,
                remotes: [],
                isDirty: false,
                ahead: 0,
                behind: 0,
                lastFetch: null
            };
            
            // Get current branch
            try {
                const { stdout } = await execAsync(`cd "${repoPath}" && "${this.gitPath}" branch --show-current`);
                info.branch = stdout.trim() || 'HEAD detached';
            } catch (error) {
                // Might be in detached HEAD state
            }
            
            // Get remotes
            try {
                const { stdout } = await execAsync(`cd "${repoPath}" && "${this.gitPath}" remote -v`);
                const remotes = stdout.trim().split('\n')
                    .filter(line => line.includes('(fetch)'))
                    .map(line => {
                        const parts = line.split('\t');
                        return {
                            name: parts[0],
                            url: parts[1].replace(' (fetch)', '')
                        };
                    });
                info.remotes = remotes;
                info.hasRemote = remotes.length > 0;
            } catch (error) {
                // No remotes
            }
            
            // Check if dirty
            try {
                const { stdout } = await execAsync(`cd "${repoPath}" && "${this.gitPath}" status --porcelain`);
                info.isDirty = stdout.trim().length > 0;
            } catch (error) {
                // Error checking status
            }
            
            // Get ahead/behind if has remote
            if (info.hasRemote && info.branch !== 'HEAD detached') {
                try {
                    const { stdout } = await execAsync(
                        `cd "${repoPath}" && "${this.gitPath}" rev-list --left-right --count origin/${info.branch}...${info.branch}`
                    );
                    const [behind, ahead] = stdout.trim().split('\t').map(n => parseInt(n) || 0);
                    info.ahead = ahead;
                    info.behind = behind;
                } catch (error) {
                    // Remote branch might not exist
                }
            }
            
            return info;
        } catch (error) {
            this.log(`Error getting repository info for ${repoPath}:`, error.message);
            return {
                path: repoPath,
                name: path.basename(repoPath),
                error: error.message
            };
        }
    }
    
    async onMessage(message) {
        const { action, payload } = message;
        
        try {
            switch (action) {
                case 'getStatus':
                    return await this.getStatus();
                    
                case 'init':
                    return await this.initRepository(payload);
                    
                case 'clone':
                    return await this.cloneRepository(payload);
                    
                case 'status':
                    return await this.getRepoStatus(payload);
                    
                case 'add':
                    return await this.addFiles(payload);
                    
                case 'commit':
                    return await this.commit(payload);
                    
                case 'push':
                    return await this.push(payload);
                    
                case 'pull':
                    return await this.pull(payload);
                    
                case 'fetch':
                    return await this.fetch(payload);
                    
                case 'branch':
                    return await this.manageBranches(payload);
                    
                case 'checkout':
                    return await this.checkout(payload);
                    
                case 'merge':
                    return await this.merge(payload);
                    
                case 'log':
                    return await this.getLog(payload);
                    
                case 'diff':
                    return await this.getDiff(payload);
                    
                case 'diffCAD':
                    return await this.getCADDiff(payload);
                    
                case 'listRepositories':
                    return await this.listRepositories();
                    
                case 'syncWithServer':
                    return await this.syncWithServer(payload);
                    
                default:
                    throw new Error(`Unknown action: ${action}`);
            }
        } catch (error) {
            this.log(`Error handling action ${action}:`, error);
            throw error;
        }
    }
    
    async getStatus() {
        try {
            const baseStatus = super.getStatus();
            return {
                ...baseStatus,
                installed: !!this.gitPath,
                path: this.gitPath || null,
                version: this.gitVersion || 'unknown',
                repositoriesPath: this.config.repositoriesPath,
                repositoryCount: this.repositories.size,
                activeWatchers: this.activeWatchers.size,
                autoFetchEnabled: this.config.autoFetch,
                cadDiffEnabled: this.config.cadDiffEnabled
            };
        } catch (error) {
            this.log('Error getting status:', error);
            return {
                initialized: false,
                started: false,
                error: error.message
            };
        }
    }
    
    async initRepository(payload) {
        const { path: repoPath, name, bare = false } = payload;
        
        if (!this.gitPath) {
            throw new Error('Git not found. Please install Git from https://git-scm.com/');
        }
        
        const targetPath = repoPath || path.join(
            this.expandPath(this.config.repositoriesPath),
            name || `new-repo-${Date.now()}`
        );
        
        // Create directory
        await fs.mkdir(targetPath, { recursive: true });
        
        // Initialize repository
        const args = ['init'];
        if (bare) args.push('--bare');
        
        const { stdout, stderr } = await execAsync(
            `cd "${targetPath}" && "${this.gitPath}" ${args.join(' ')}`
        );
        
        // Get repository info
        const repoInfo = await this.getRepositoryInfo(targetPath);
        this.repositories.set(targetPath, repoInfo);
        
        // Create initial commit if not bare
        if (!bare) {
            // Create README
            const readmePath = path.join(targetPath, 'README.md');
            await fs.writeFile(readmePath, `# ${path.basename(targetPath)}\n\nCreated with W.I.T. Git Plugin\n`);
            
            // Add and commit
            await execAsync(`cd "${targetPath}" && "${this.gitPath}" add README.md`);
            await execAsync(`cd "${targetPath}" && "${this.gitPath}" commit -m "Initial commit"`);
        }
        
        return {
            success: true,
            repository: repoInfo,
            message: `Repository initialized at ${targetPath}`
        };
    }
    
    async cloneRepository(payload) {
        const { url, name, path: targetPath, depth } = payload;
        
        if (!this.gitPath) {
            throw new Error('Git not found');
        }
        
        if (!url) {
            throw new Error('Repository URL is required');
        }
        
        // Determine target path
        const repoName = name || path.basename(url, '.git');
        const clonePath = targetPath || path.join(
            this.expandPath(this.config.repositoriesPath),
            repoName
        );
        
        // Build clone command
        const args = ['clone', url];
        if (depth) args.push('--depth', depth);
        args.push(clonePath);
        
        // Clone repository
        const { stdout, stderr } = await execAsync(
            `"${this.gitPath}" ${args.join(' ')}`
        );
        
        // Get repository info
        const repoInfo = await this.getRepositoryInfo(clonePath);
        this.repositories.set(clonePath, repoInfo);
        
        // Start auto-fetch if enabled
        if (this.config.autoFetch) {
            this.startAutoFetch(clonePath);
        }
        
        return {
            success: true,
            repository: repoInfo,
            message: `Repository cloned to ${clonePath}`
        };
    }
    
    async getRepoStatus(payload) {
        const { repoPath } = payload;
        
        if (!repoPath) {
            throw new Error('Repository path is required');
        }
        
        const { stdout } = await execAsync(
            `cd "${repoPath}" && "${this.gitPath}" status --porcelain=v2 --branch`
        );
        
        const status = {
            branch: null,
            upstream: null,
            ahead: 0,
            behind: 0,
            staged: [],
            unstaged: [],
            untracked: []
        };
        
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
            if (line.startsWith('# branch.head')) {
                status.branch = line.split(' ')[2];
            } else if (line.startsWith('# branch.upstream')) {
                status.upstream = line.split(' ')[2];
            } else if (line.startsWith('# branch.ab')) {
                const parts = line.split(' ');
                status.ahead = parseInt(parts[2].substring(1));
                status.behind = Math.abs(parseInt(parts[3]));
            } else if (line.startsWith('1') || line.startsWith('2')) {
                // File changes
                const parts = line.split(' ');
                const file = parts[parts.length - 1];
                const xy = parts[1];
                
                if (xy[0] !== '.') {
                    status.staged.push({ file, status: xy[0] });
                }
                if (xy[1] !== '.') {
                    status.unstaged.push({ file, status: xy[1] });
                }
            } else if (line.startsWith('?')) {
                const file = line.substring(2);
                status.untracked.push(file);
            }
        }
        
        return status;
    }
    
    async addFiles(payload) {
        const { repoPath, files = ['.'] } = payload;
        
        if (!repoPath) {
            throw new Error('Repository path is required');
        }
        
        const args = ['add', ...files];
        const { stdout, stderr } = await execAsync(
            `cd "${repoPath}" && "${this.gitPath}" ${args.join(' ')}`
        );
        
        return {
            success: true,
            message: `Added ${files.length} file(s) to staging area`
        };
    }
    
    async commit(payload) {
        const { repoPath, message, amend = false, author, signoff = false } = payload;
        
        if (!repoPath) {
            throw new Error('Repository path is required');
        }
        
        if (!message && !amend) {
            throw new Error('Commit message is required');
        }
        
        const args = ['commit'];
        if (message) args.push('-m', message);
        if (amend) args.push('--amend');
        if (author) args.push('--author', author);
        if (signoff) args.push('--signoff');
        if (this.config.signCommits) args.push('-S');
        
        const { stdout } = await execAsync(
            `cd "${repoPath}" && "${this.gitPath}" ${args.join(' ')}`
        );
        
        // Extract commit hash from output
        const hashMatch = stdout.match(/\[[\w\s]+\s+([a-f0-9]+)\]/);
        const commitHash = hashMatch ? hashMatch[1] : null;
        
        return {
            success: true,
            commitHash,
            message: stdout.trim()
        };
    }
    
    async push(payload) {
        const { repoPath, remote = 'origin', branch, force = false, tags = false } = payload;
        
        if (!repoPath) {
            throw new Error('Repository path is required');
        }
        
        const args = ['push', remote];
        if (branch) args.push(branch);
        if (force) args.push('--force-with-lease');
        if (tags) args.push('--tags');
        
        const { stdout, stderr } = await execAsync(
            `cd "${repoPath}" && "${this.gitPath}" ${args.join(' ')}`
        );
        
        return {
            success: true,
            message: stdout || stderr || 'Push completed'
        };
    }
    
    async pull(payload) {
        const { repoPath, remote = 'origin', branch, rebase = false } = payload;
        
        if (!repoPath) {
            throw new Error('Repository path is required');
        }
        
        const args = ['pull', remote];
        if (branch) args.push(branch);
        if (rebase) args.push('--rebase');
        
        const { stdout, stderr } = await execAsync(
            `cd "${repoPath}" && "${this.gitPath}" ${args.join(' ')}`
        );
        
        return {
            success: true,
            message: stdout || 'Pull completed'
        };
    }
    
    async fetch(payload) {
        const { repoPath, remote = 'origin', prune = false } = payload;
        
        if (!repoPath) {
            throw new Error('Repository path is required');
        }
        
        const args = ['fetch', remote];
        if (prune) args.push('--prune');
        
        const { stdout } = await execAsync(
            `cd "${repoPath}" && "${this.gitPath}" ${args.join(' ')}`
        );
        
        // Update last fetch time
        const repoInfo = this.repositories.get(repoPath);
        if (repoInfo) {
            repoInfo.lastFetch = new Date().toISOString();
            this.repositories.set(repoPath, repoInfo);
        }
        
        return {
            success: true,
            message: 'Fetch completed'
        };
    }
    
    async manageBranches(payload) {
        const { repoPath, action, name, remote = false } = payload;
        
        if (!repoPath) {
            throw new Error('Repository path is required');
        }
        
        switch (action) {
            case 'list':
                const args = ['branch'];
                if (remote) args.push('-r');
                else args.push('-a');
                
                const { stdout } = await execAsync(
                    `cd "${repoPath}" && "${this.gitPath}" ${args.join(' ')}`
                );
                
                const branches = stdout.trim().split('\n').map(line => {
                    const current = line.startsWith('*');
                    const name = line.substring(2).trim();
                    return { name, current };
                });
                
                return { branches };
                
            case 'create':
                if (!name) throw new Error('Branch name is required');
                await execAsync(
                    `cd "${repoPath}" && "${this.gitPath}" branch ${name}`
                );
                return { success: true, message: `Branch ${name} created` };
                
            case 'delete':
                if (!name) throw new Error('Branch name is required');
                await execAsync(
                    `cd "${repoPath}" && "${this.gitPath}" branch -d ${name}`
                );
                return { success: true, message: `Branch ${name} deleted` };
                
            default:
                throw new Error(`Unknown branch action: ${action}`);
        }
    }
    
    async checkout(payload) {
        const { repoPath, target, createBranch = false } = payload;
        
        if (!repoPath || !target) {
            throw new Error('Repository path and target are required');
        }
        
        const args = ['checkout'];
        if (createBranch) args.push('-b');
        args.push(target);
        
        const { stdout } = await execAsync(
            `cd "${repoPath}" && "${this.gitPath}" ${args.join(' ')}`
        );
        
        return {
            success: true,
            message: stdout.trim()
        };
    }
    
    async merge(payload) {
        const { repoPath, branch, strategy, message } = payload;
        
        if (!repoPath || !branch) {
            throw new Error('Repository path and branch are required');
        }
        
        const args = ['merge', branch];
        if (strategy) args.push('--strategy', strategy);
        if (message) args.push('-m', message);
        
        const { stdout } = await execAsync(
            `cd "${repoPath}" && "${this.gitPath}" ${args.join(' ')}`
        );
        
        return {
            success: true,
            message: stdout.trim()
        };
    }
    
    async getLog(payload) {
        const { repoPath, limit = 50, oneline = false, graph = false } = payload;
        
        if (!repoPath) {
            throw new Error('Repository path is required');
        }
        
        const args = ['log', `-${limit}`];
        if (oneline) args.push('--oneline');
        if (graph) args.push('--graph');
        args.push('--pretty=format:%H|%h|%an|%ae|%ad|%s');
        
        const { stdout } = await execAsync(
            `cd "${repoPath}" && "${this.gitPath}" ${args.join(' ')}`
        );
        
        const commits = stdout.trim().split('\n').map(line => {
            const [hash, shortHash, author, email, date, subject] = line.split('|');
            return { hash, shortHash, author, email, date, subject };
        });
        
        return { commits };
    }
    
    async getDiff(payload) {
        const { repoPath, file, staged = false, commit } = payload;
        
        if (!repoPath) {
            throw new Error('Repository path is required');
        }
        
        const args = ['diff'];
        if (staged) args.push('--staged');
        if (commit) args.push(commit);
        if (file) args.push('--', file);
        
        const { stdout } = await execAsync(
            `cd "${repoPath}" && "${this.gitPath}" ${args.join(' ')}`
        );
        
        return {
            diff: stdout,
            isEmpty: stdout.trim().length === 0
        };
    }
    
    async getCADDiff(payload) {
        const { repoPath, file, oldCommit = 'HEAD~1', newCommit = 'HEAD' } = payload;
        
        if (!repoPath || !file) {
            throw new Error('Repository path and file are required');
        }
        
        // Check if file is a supported CAD format
        const ext = path.extname(file).toLowerCase().substring(1);
        if (!this.config.supportedCADFormats.includes(ext)) {
            throw new Error(`Unsupported CAD format: ${ext}`);
        }
        
        // Export both versions to temp directory
        const tempDir = path.join(os.tmpdir(), 'wit-git-diff', Date.now().toString());
        await fs.mkdir(tempDir, { recursive: true });
        
        const oldFile = path.join(tempDir, `old_${path.basename(file)}`);
        const newFile = path.join(tempDir, `new_${path.basename(file)}`);
        
        // Get old version
        await execAsync(
            `cd "${repoPath}" && "${this.gitPath}" show ${oldCommit}:${file} > "${oldFile}"`
        );
        
        // Get new version
        await execAsync(
            `cd "${repoPath}" && "${this.gitPath}" show ${newCommit}:${file} > "${newFile}"`
        );
        
        // For now, return paths for external visualization
        // In a full implementation, this would integrate with CAD viewers
        return {
            format: ext,
            oldFile,
            newFile,
            visualization: 'external',
            message: 'CAD files exported for diff visualization'
        };
    }
    
    async listRepositories() {
        const repos = [];
        
        for (const [repoPath, repoInfo of this.repositories) {
            // Update repository info
            const updatedInfo = await this.getRepositoryInfo(repoPath);
            this.repositories.set(repoPath, updatedInfo);
            repos.push(updatedInfo);
        }
        
        return repos;
    }
    
    async syncWithServer(payload) {
        const { serverUrl, token } = payload;
        
        // This would integrate with the W.I.T. server's Git functionality
        // For now, return a placeholder response
        return {
            success: false,
            message: 'Server sync not yet implemented'
        };
    }
    
    // Helper methods
    
    expandPath(filePath) {
        if (filePath.startsWith('~')) {
            return path.join(os.homedir(), filePath.slice(1));
        }
        return filePath;
    }
    
    startAutoFetch(repoPath) {
        if (this.fetchIntervals.has(repoPath)) {
            return; // Already running
        }
        
        const interval = setInterval(async () => {
            try {
                await this.fetch({ repoPath });
                this.log(`Auto-fetch completed for ${repoPath}`);
            } catch (error) {
                this.log(`Auto-fetch failed for ${repoPath}:`, error.message);
            }
        }, this.config.fetchInterval * 1000);
        
        this.fetchIntervals.set(repoPath, interval);
    }
    
    stopAutoFetch(repoPath) {
        const interval = this.fetchIntervals.get(repoPath);
        if (interval) {
            clearInterval(interval);
            this.fetchIntervals.delete(repoPath);
        }
    }
}

module.exports = GitPlugin;