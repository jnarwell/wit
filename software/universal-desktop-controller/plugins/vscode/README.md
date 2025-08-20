# VS Code Plugin for W.I.T. Universal Desktop Controller

## Overview
This plugin provides comprehensive integration between W.I.T. and Visual Studio Code, enabling code editing, project management, and development workflows through the W.I.T. interface.

## Features
- Launch VS Code with various options
- Open files, folders, and workspaces
- Create new projects from templates
- Install and manage extensions
- Git integration (clone, status)
- Search and replace in files
- File comparison (diff)
- Terminal integration
- Settings management
- Command palette access

## Supported Versions
- VS Code 1.50.0 and later
- VS Code Insiders
- Both stable and preview versions

## Installation Requirements

### Windows
- VS Code installed in standard locations:
  - `C:\Program Files\Microsoft VS Code\Code.exe`
  - `C:\Program Files (x86)\Microsoft VS Code\Code.exe`
  - `%LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe`

### macOS
- VS Code installed in:
  - `/Applications/Visual Studio Code.app`
  - VS Code CLI available in PATH (`/usr/local/bin/code`)

### Linux
- VS Code installed via:
  - Package manager (`/usr/bin/code`)
  - Snap (`/snap/bin/code`)
  - Manual installation (`/opt/visual-studio-code/code`)

## Commands

### Basic Operations
- `launch` - Launch VS Code
- `openFile` - Open file at specific line/column
- `openFolder` - Open folder as workspace
- `openWorkspace` - Open .code-workspace file
- `newWindow` - Open new VS Code window

### Project Management
- `createProject` - Create new project from template
- `addFolderToWorkspace` - Add folder to current workspace

### Extension Management
- `installExtension` - Install VS Code extension
- `uninstallExtension` - Remove extension
- `listExtensions` - List installed extensions

### Development Tools
- `openTerminal` - Open integrated terminal
- `diff` - Compare two files
- `search` - Search in files
- `replaceInFiles` - Find and replace across files

### Git Integration
- `gitClone` - Clone repository and open in VS Code
- `gitStatus` - Get git status of workspace

### Settings & Configuration
- `openSettings` - Open VS Code settings
- `openKeybindings` - Open keyboard shortcuts
- `openSnippets` - Open user snippets

## Project Templates

### Node.js Template
Creates a Node.js project with:
- `package.json` with basic scripts
- `index.js` entry point
- `.gitignore` for Node.js

### Python Template  
Creates a Python project with:
- `main.py` with basic structure
- `requirements.txt` for dependencies
- `.gitignore` for Python

### Web Template
Creates a web project with:
- `index.html` with basic structure
- `style.css` with reset styles
- `script.js` for JavaScript

### Empty Template
Creates minimal project with just README.md

## Usage Examples

### Open File at Specific Line
```javascript
await plugin.handleCommand('openFile', {
    filePath: '/path/to/file.js',
    line: 42,
    column: 15
});
```

### Create New Project
```javascript
await plugin.handleCommand('createProject', {
    projectName: 'MyApp',
    template: 'node',
    location: '~/Projects'
});
```

### Install Extension
```javascript
await plugin.handleCommand('installExtension', {
    extensionId: 'ms-python.python'
});
```

### Clone Repository
```javascript
await plugin.handleCommand('gitClone', {
    repositoryUrl: 'https://github.com/user/repo.git',
    targetDirectory: '~/Projects/repo'
});
```

### Search in Files
```javascript
await plugin.handleCommand('search', {
    query: 'function myFunction',
    folderPath: '/path/to/project'
});
```

## Configuration

The plugin supports these configuration options:

```json
{
    "defaultWorkspace": "~/Documents",
    "enableTerminalIntegration": true,
    "enableGitIntegration": true,
    "defaultExtensions": [
        "ms-python.python",
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode"
    ],
    "settings": {
        "telemetry.telemetryLevel": "off",
        "update.mode": "manual"
    }
}
```

## Troubleshooting

### VS Code Not Found
1. Verify VS Code is installed in a standard location
2. Check that the `code` command is available in PATH
3. On macOS, install the shell command via Command Palette > "Shell Command: Install 'code' command in PATH"

### Extensions Won't Install
1. Ensure VS Code has internet connectivity
2. Check VS Code marketplace is accessible
3. Try installing manually first to verify extension ID

### Git Commands Fail
1. Ensure Git is installed and available in PATH
2. Check repository URL is accessible
3. Verify you have appropriate permissions

### Project Templates Don't Work
1. Check write permissions to target directory
2. Ensure default workspace directory exists
3. Verify template name is valid (node, python, web, empty)

## Integration with W.I.T.

This plugin integrates seamlessly with other W.I.T. components:

- **File Browser**: Open files and folders in VS Code
- **Git Integration**: Clone repositories and manage version control
- **Terminal**: Launch VS Code with integrated terminal
- **Project Management**: Create and organize development projects
- **AI Terminal**: Natural language commands for VS Code operations

## Advanced Features

### Workspace Management
- Add multiple folders to workspace
- Save and restore workspace configurations
- Switch between different project setups

### Development Workflow
- Integrated debugging support
- Extension management from W.I.T.
- Custom snippet management
- Settings synchronization

### Collaboration
- Live Share integration (when extension installed)
- Remote development support
- Git workflow automation

## License
This plugin is part of the W.I.T. project and follows the same licensing terms.