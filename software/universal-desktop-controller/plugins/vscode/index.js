const { WITPlugin } = require('../../src/plugins/base/WITPlugin');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const util = require('util');
const execPromise = util.promisify(exec);

class VSCodePlugin extends WITPlugin {
    constructor(context) {
        super(context);
        this.vscodePath = null;
        this.vscodeProcesses = new Map();
        this.installedExtensions = new Set();
        this.config = {
            defaultWorkspace: path.join(os.homedir(), 'Documents'),
            enableTerminalIntegration: true,
            enableGitIntegration: true,
            defaultExtensions: [
                'ms-python.python',
                'dbaeumer.vscode-eslint',
                'esbenp.prettier-vscode'
            ],
            settings: {
                'telemetry.telemetryLevel': 'off',
                'update.mode': 'manual'
            }
        };
    }

    async initialize() {
        await super.initialize();
        
        this.log('info', 'VS Code plugin initializing...');
        
        // Find VS Code installation
        this.vscodePath = await this.findVSCode();
        if (!this.vscodePath) {
            this.log('warn', 'VS Code installation not found. Please install VS Code.');
        } else {
            this.log('info', `Found VS Code at: ${this.vscodePath}`);
        }
        
        // Load saved configuration
        const savedConfig = await this.loadData('config.json');
        if (savedConfig) {
            this.config = { ...this.config, ...savedConfig };
        }
        
        // Create default workspace directory if it doesn't exist
        try {
            await fs.mkdir(this.config.defaultWorkspace, { recursive: true });
        } catch (error) {
            this.log('warn', `Could not create default workspace: ${error.message}`);
        }
        
        this.log('info', 'VS Code plugin initialized');
    }
    
    async start() {
        await super.start();
        
        if (this.vscodePath) {
            // Get list of installed extensions
            await this.updateExtensionsList();
            
            this.log('info', 'VS Code plugin started successfully');
            
            // Emit status update to indicate plugin is active
            this.emit('plugin_status_update', {
                pluginId: this.id,
                status: 'active'
            });
        } else {
            this.log('info', 'VS Code plugin started but VS Code not installed');
            
            // Emit status update to indicate plugin is inactive (not installed)
            this.emit('plugin_status_update', {
                pluginId: this.id,
                status: 'inactive'
            });
        }
    }

    async findVSCode() {
        const platform = process.platform;
        const manifest = require('./manifest.json');
        const possiblePaths = manifest.requirements.vscode.paths[platform] || [];
        
        // Expand environment variables in paths
        const expandedPaths = possiblePaths.map(p => {
            return p.replace(/%([^%]+)%/g, (match, varName) => process.env[varName] || match)
                    .replace(/\$HOME/g, os.homedir())
                    .replace(/\$\{HOME\}/g, os.homedir())
                    .replace(/~\//, os.homedir() + '/');
        });
        
        for (const vscodePath of expandedPaths) {
            try {
                await fs.access(vscodePath, fs.constants.X_OK);
                return vscodePath;
            } catch (error) {
                // Continue searching
            }
        }
        
        // Try to find via command line
        try {
            const { stdout } = await execPromise('which code');
            if (stdout.trim()) {
                return stdout.trim();
            }
        } catch (error) {
            // Not found via which
        }
        
        // Try Windows where command
        if (platform === 'win32') {
            try {
                const { stdout } = await execPromise('where code');
                if (stdout.trim()) {
                    return stdout.trim().split('\n')[0];
                }
            } catch (error) {
                // Not found via where
            }
        }
        
        return null;
    }

    async onMessage(message) {
        const { action, payload = {} } = message;
        return await this.handleCommand(action, payload);
    }
    
    async handleCommand(command, payload = {}) {
        this.log('info', `Handling command: ${command}`);
        
        switch (command) {
            case 'launch':
                return await this.launchVSCode();
                
            case 'openFile':
                return await this.openFile(payload);
                
            case 'openFolder':
                return await this.openFolder(payload);
                
            case 'openWorkspace':
                return await this.openWorkspace(payload);
                
            case 'newWindow':
                return await this.newWindow(payload);
                
            case 'addFolderToWorkspace':
                return await this.addFolderToWorkspace(payload);
                
            case 'installExtension':
                return await this.installExtension(payload);
                
            case 'uninstallExtension':
                return await this.uninstallExtension(payload);
                
            case 'listExtensions':
                return await this.listExtensions();
                
            case 'runCommand':
                return await this.runCommand(payload);
                
            case 'openTerminal':
                return await this.openTerminal(payload);
                
            case 'openSettings':
                return await this.openSettings(payload);
                
            case 'openKeybindings':
                return await this.openKeybindings();
                
            case 'openSnippets':
                return await this.openSnippets(payload);
                
            case 'diff':
                return await this.diffFiles(payload);
                
            case 'search':
                return await this.searchInFiles(payload);
                
            case 'replaceInFiles':
                return await this.replaceInFiles(payload);
                
            case 'gitClone':
                return await this.gitClone(payload);
                
            case 'gitStatus':
                return await this.gitStatus(payload);
                
            case 'createProject':
                return await this.createProject(payload);
                
            case 'getStatus':
                return this.getStatus();
                
            default:
                throw new Error(`Unknown command: ${command}`);
        }
    }

    async launchVSCode(additionalArgs = []) {
        if (!this.vscodePath) {
            return { 
                success: false, 
                message: 'VS Code installation not found. Please install VS Code.' 
            };
        }
        
        try {
            const args = [...additionalArgs];
            
            this.log('info', `Launching VS Code with args: ${args.join(' ')}`);
            
            const vscodeProcess = spawn(this.vscodePath, args, {
                detached: true,
                stdio: 'ignore'
            });
            
            vscodeProcess.unref();
            
            this.vscodeProcesses.set(vscodeProcess.pid, {
                pid: vscodeProcess.pid,
                args: args,
                startTime: new Date()
            });
            
            return {
                success: true,
                pid: vscodeProcess.pid,
                message: 'VS Code launched successfully'
            };
        } catch (error) {
            this.log('error', `Failed to launch VS Code: ${error.message}`);
            throw error;
        }
    }

    async openFile(payload) {
        const { filePath, line, column } = payload;
        
        if (!filePath) {
            throw new Error('File path is required');
        }
        
        const args = [];
        
        // Add goto line:column if specified
        if (line) {
            if (column) {
                args.push('--goto', `${filePath}:${line}:${column}`);
            } else {
                args.push('--goto', `${filePath}:${line}`);
            }
        } else {
            args.push(filePath);
        }
        
        return await this.launchVSCode(args);
    }

    async openFolder(payload) {
        const { folderPath } = payload;
        
        if (!folderPath) {
            throw new Error('Folder path is required');
        }
        
        return await this.launchVSCode([folderPath]);
    }

    async openWorkspace(payload) {
        const { workspacePath } = payload;
        
        if (!workspacePath) {
            throw new Error('Workspace path is required');
        }
        
        // Ensure it's a .code-workspace file
        if (!workspacePath.endsWith('.code-workspace')) {
            throw new Error('Invalid workspace file. Must be a .code-workspace file');
        }
        
        return await this.launchVSCode([workspacePath]);
    }

    async newWindow(payload) {
        const { folderPath } = payload;
        
        const args = ['--new-window'];
        
        if (folderPath) {
            args.push(folderPath);
        }
        
        return await this.launchVSCode(args);
    }

    async addFolderToWorkspace(payload) {
        const { folderPath } = payload;
        
        if (!folderPath) {
            throw new Error('Folder path is required');
        }
        
        return await this.launchVSCode(['--add', folderPath]);
    }

    async installExtension(payload) {
        const { extensionId } = payload;
        
        if (!extensionId) {
            throw new Error('Extension ID is required');
        }
        
        if (!this.vscodePath) {
            throw new Error('VS Code installation not found');
        }
        
        try {
            const { stdout, stderr } = await execPromise(
                `"${this.vscodePath}" --install-extension ${extensionId}`
            );
            
            if (stderr && !stderr.includes('successfully installed')) {
                throw new Error(stderr);
            }
            
            // Update extensions list
            this.installedExtensions.add(extensionId);
            
            return {
                success: true,
                extensionId,
                message: `Extension ${extensionId} installed successfully`
            };
        } catch (error) {
            this.log('error', `Failed to install extension: ${error.message}`);
            throw error;
        }
    }

    async uninstallExtension(payload) {
        const { extensionId } = payload;
        
        if (!extensionId) {
            throw new Error('Extension ID is required');
        }
        
        if (!this.vscodePath) {
            throw new Error('VS Code installation not found');
        }
        
        try {
            const { stdout, stderr } = await execPromise(
                `"${this.vscodePath}" --uninstall-extension ${extensionId}`
            );
            
            if (stderr && !stderr.includes('successfully uninstalled')) {
                throw new Error(stderr);
            }
            
            // Update extensions list
            this.installedExtensions.delete(extensionId);
            
            return {
                success: true,
                extensionId,
                message: `Extension ${extensionId} uninstalled successfully`
            };
        } catch (error) {
            this.log('error', `Failed to uninstall extension: ${error.message}`);
            throw error;
        }
    }

    async listExtensions() {
        if (!this.vscodePath) {
            throw new Error('VS Code installation not found');
        }
        
        try {
            const { stdout } = await execPromise(
                `"${this.vscodePath}" --list-extensions`
            );
            
            const extensions = stdout.trim().split('\n').filter(Boolean);
            
            return {
                success: true,
                extensions,
                count: extensions.length
            };
        } catch (error) {
            this.log('error', `Failed to list extensions: ${error.message}`);
            throw error;
        }
    }

    async updateExtensionsList() {
        try {
            const result = await this.listExtensions();
            this.installedExtensions = new Set(result.extensions);
        } catch (error) {
            this.log('warn', 'Could not update extensions list');
        }
    }

    async runCommand(payload) {
        const { command } = payload;
        
        if (!command) {
            throw new Error('Command is required');
        }
        
        // VS Code CLI supports running commands via --command flag
        return await this.launchVSCode(['--command', command]);
    }

    async openTerminal(payload) {
        const { cwd } = payload;
        
        const args = ['--command', 'workbench.action.terminal.new'];
        
        if (cwd) {
            // Open folder first, then terminal
            return await this.launchVSCode([cwd, '--command', 'workbench.action.terminal.new']);
        }
        
        return await this.launchVSCode(args);
    }

    async openSettings(payload) {
        const { json = false } = payload;
        
        if (json) {
            return await this.launchVSCode(['--command', 'workbench.action.openSettingsJson']);
        } else {
            return await this.launchVSCode(['--command', 'workbench.action.openSettings']);
        }
    }

    async openKeybindings() {
        return await this.launchVSCode(['--command', 'workbench.action.openGlobalKeybindings']);
    }

    async openSnippets(payload) {
        const { language } = payload;
        
        if (language) {
            return await this.launchVSCode(['--command', `workbench.action.openSnippets?${language}`]);
        } else {
            return await this.launchVSCode(['--command', 'workbench.action.openSnippets']);
        }
    }

    async diffFiles(payload) {
        const { file1, file2 } = payload;
        
        if (!file1 || !file2) {
            throw new Error('Two file paths are required for diff');
        }
        
        return await this.launchVSCode(['--diff', file1, file2]);
    }

    async searchInFiles(payload) {
        const { query, folderPath } = payload;
        
        if (!query) {
            throw new Error('Search query is required');
        }
        
        const args = [];
        
        if (folderPath) {
            args.push(folderPath);
        }
        
        // Open search with query
        args.push('--command', `workbench.action.findInFiles?{"query":"${query}"}`);
        
        return await this.launchVSCode(args);
    }

    async replaceInFiles(payload) {
        const { find, replace, folderPath } = payload;
        
        if (!find || replace === undefined) {
            throw new Error('Find and replace values are required');
        }
        
        const args = [];
        
        if (folderPath) {
            args.push(folderPath);
        }
        
        // Open replace in files
        args.push('--command', `workbench.action.replaceInFiles?{"query":"${find}","replace":"${replace}"}`);
        
        return await this.launchVSCode(args);
    }

    async gitClone(payload) {
        const { repositoryUrl, targetDirectory } = payload;
        
        if (!repositoryUrl) {
            throw new Error('Repository URL is required');
        }
        
        try {
            // Clone using git command
            const cloneDir = targetDirectory || path.join(this.config.defaultWorkspace, path.basename(repositoryUrl, '.git'));
            
            await execPromise(`git clone "${repositoryUrl}" "${cloneDir}"`);
            
            // Open the cloned repository in VS Code
            await this.openFolder({ folderPath: cloneDir });
            
            return {
                success: true,
                repositoryUrl,
                clonedTo: cloneDir,
                message: 'Repository cloned and opened in VS Code'
            };
        } catch (error) {
            this.log('error', `Failed to clone repository: ${error.message}`);
            throw error;
        }
    }

    async gitStatus(payload) {
        const { folderPath = process.cwd() } = payload;
        
        try {
            const { stdout } = await execPromise('git status --porcelain', { cwd: folderPath });
            
            const files = stdout.trim().split('\n').filter(Boolean).map(line => {
                const [status, ...pathParts] = line.trim().split(' ');
                return {
                    status: status,
                    path: pathParts.join(' ')
                };
            });
            
            return {
                success: true,
                folderPath,
                files,
                count: files.length
            };
        } catch (error) {
            this.log('error', `Failed to get git status: ${error.message}`);
            throw error;
        }
    }

    async createProject(payload) {
        const { 
            projectName, 
            template = 'empty', 
            location = this.config.defaultWorkspace 
        } = payload;
        
        if (!projectName) {
            throw new Error('Project name is required');
        }
        
        const projectPath = path.join(location, projectName);
        
        try {
            // Create project directory
            await fs.mkdir(projectPath, { recursive: true });
            
            // Create basic project structure based on template
            switch (template) {
                case 'node':
                    await this.createNodeProject(projectPath, projectName);
                    break;
                    
                case 'python':
                    await this.createPythonProject(projectPath, projectName);
                    break;
                    
                case 'web':
                    await this.createWebProject(projectPath, projectName);
                    break;
                    
                case 'empty':
                default:
                    // Just create README
                    await fs.writeFile(
                        path.join(projectPath, 'README.md'),
                        `# ${projectName}\n\nCreated with W.I.T. VS Code integration\n`
                    );
            }
            
            // Open project in VS Code
            await this.openFolder({ folderPath: projectPath });
            
            return {
                success: true,
                projectName,
                projectPath,
                template,
                message: `Project ${projectName} created and opened in VS Code`
            };
        } catch (error) {
            this.log('error', `Failed to create project: ${error.message}`);
            throw error;
        }
    }

    async createNodeProject(projectPath, projectName) {
        // Create package.json
        const packageJson = {
            name: projectName.toLowerCase().replace(/\s+/g, '-'),
            version: '1.0.0',
            description: `${projectName} project`,
            main: 'index.js',
            scripts: {
                start: 'node index.js',
                test: 'echo "Error: no test specified" && exit 1'
            },
            keywords: [],
            author: '',
            license: 'MIT'
        };
        
        await fs.writeFile(
            path.join(projectPath, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        );
        
        // Create index.js
        await fs.writeFile(
            path.join(projectPath, 'index.js'),
            `// ${projectName}\nconsole.log('Hello from ${projectName}!');\n`
        );
        
        // Create .gitignore
        await fs.writeFile(
            path.join(projectPath, '.gitignore'),
            'node_modules/\n.env\n*.log\n'
        );
    }

    async createPythonProject(projectPath, projectName) {
        // Create main.py
        await fs.writeFile(
            path.join(projectPath, 'main.py'),
            `#!/usr/bin/env python3\n"""${projectName} - Main module"""\n\ndef main():\n    print(f"Hello from ${projectName}!")\n\nif __name__ == "__main__":\n    main()\n`
        );
        
        // Create requirements.txt
        await fs.writeFile(
            path.join(projectPath, 'requirements.txt'),
            '# Add your dependencies here\n'
        );
        
        // Create .gitignore
        await fs.writeFile(
            path.join(projectPath, '.gitignore'),
            '__pycache__/\n*.py[cod]\n*$py.class\n.env\nvenv/\n.venv/\n'
        );
    }

    async createWebProject(projectPath, projectName) {
        // Create index.html
        await fs.writeFile(
            path.join(projectPath, 'index.html'),
            `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>${projectName}</h1>
    <p>Created with W.I.T. VS Code integration</p>
    <script src="script.js"></script>
</body>
</html>`
        );
        
        // Create style.css
        await fs.writeFile(
            path.join(projectPath, 'style.css'),
            `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: Arial, sans-serif;
    line-height: 1.6;
    padding: 20px;
}

h1 {
    color: #333;
    margin-bottom: 10px;
}`
        );
        
        // Create script.js
        await fs.writeFile(
            path.join(projectPath, 'script.js'),
            `// ${projectName} JavaScript\nconsole.log('${projectName} loaded');\n`
        );
    }

    getStatus() {
        return {
            ...super.getStatus(),
            vscodeInstalled: !!this.vscodePath,
            vscodePath: this.vscodePath,
            activeProcesses: this.vscodeProcesses.size,
            installedExtensions: Array.from(this.installedExtensions),
            config: this.config,
            searchedPaths: this.vscodePath ? [] : this.getSearchedPaths()
        };
    }
    
    getSearchedPaths() {
        const platform = process.platform;
        const manifest = require('./manifest.json');
        const possiblePaths = manifest.requirements.vscode.paths[platform] || [];
        
        // Expand environment variables in paths
        return possiblePaths.map(p => {
            return p.replace(/%([^%]+)%/g, (match, varName) => process.env[varName] || match)
                    .replace(/\$HOME/g, os.homedir())
                    .replace(/\$\{HOME\}/g, os.homedir());
        });
    }

    async stop() {
        await super.stop();
        
        // Clear process tracking
        this.vscodeProcesses.clear();
        
        this.log('info', 'VS Code plugin stopped');
    }
}

module.exports = VSCodePlugin;