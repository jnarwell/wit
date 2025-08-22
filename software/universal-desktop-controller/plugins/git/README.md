# Git Plugin for W.I.T. Universal Desktop Controller

Comprehensive Git integration for version control of CAD files, code, and project assets with visual diff capabilities.

## Features

### Core Git Operations
- Initialize new repositories
- Clone from remote URLs
- Stage, commit, push, pull operations
- Branch management and merging
- View commit history and diffs
- Stash changes
- Tag management

### Advanced Features
- **CAD File Diff Visualization**: Visual comparison of CAD files (STEP, STL, IGES, FCStd, F3D, DWG, DXF)
- **Auto-fetch**: Automatically fetch updates from remotes at configurable intervals
- **Multi-repository Management**: Manage multiple Git repositories from a single interface
- **Git LFS Support**: Handle large files efficiently
- **Server Integration**: Sync with W.I.T. server Git settings

### Repository Management
- Automatic repository discovery
- Repository status dashboard
- Branch visualization
- Commit graph view
- File change tracking

## Installation

The Git plugin is included with the Universal Desktop Controller. It requires Git to be installed on your system.

### Prerequisites
- Git 2.0.0 or higher
- Node.js 14.0.0 or higher

### Git Installation
- **macOS**: `brew install git` or download from [git-scm.com](https://git-scm.com/)
- **Windows**: Download from [git-scm.com](https://git-scm.com/)
- **Linux**: `sudo apt-get install git` or `sudo yum install git`

## Configuration

The plugin can be configured through the settings interface or by editing the config file:

```json
{
  "repositoriesPath": "~/Documents/GitRepos",
  "defaultBranch": "main",
  "autoFetch": true,
  "fetchInterval": 300,
  "diffTool": "internal",
  "mergeStrategy": "merge",
  "cadDiffEnabled": true,
  "supportedCADFormats": ["step", "stl", "iges", "fcstd", "f3d", "dwg", "dxf"],
  "signCommits": false
}
```

## Usage

### Initialize a New Repository
```javascript
// From the UI or API
{
  "action": "init",
  "payload": {
    "name": "my-project",
    "path": "/path/to/repo"  // optional
  }
}
```

### Clone a Repository
```javascript
{
  "action": "clone",
  "payload": {
    "url": "https://github.com/user/repo.git",
    "name": "custom-name",  // optional
    "depth": 1  // optional, for shallow clone
  }
}
```

### Stage and Commit Changes
```javascript
// Stage files
{
  "action": "add",
  "payload": {
    "repoPath": "/path/to/repo",
    "files": ["file1.txt", "file2.js"]  // or ["."] for all
  }
}

// Commit
{
  "action": "commit",
  "payload": {
    "repoPath": "/path/to/repo",
    "message": "feat: Add new feature",
    "signoff": true
  }
}
```

### Push Changes
```javascript
{
  "action": "push",
  "payload": {
    "repoPath": "/path/to/repo",
    "remote": "origin",
    "branch": "main",
    "force": false,
    "tags": false
  }
}
```

### CAD File Diff
```javascript
{
  "action": "diffCAD",
  "payload": {
    "repoPath": "/path/to/repo",
    "file": "model.step",
    "oldCommit": "HEAD~1",
    "newCommit": "HEAD"
  }
}
```

## CAD File Support

The plugin provides special handling for CAD files:

### Supported Formats
- **STEP** (.step, .stp) - Standard for 3D model data exchange
- **STL** (.stl) - 3D printing and rapid prototyping
- **IGES** (.iges, .igs) - Initial Graphics Exchange Specification
- **FCStd** (.fcstd) - FreeCAD native format
- **F3D** (.f3d) - Fusion 360 native format
- **DWG** (.dwg) - AutoCAD drawing
- **DXF** (.dxf) - Drawing Exchange Format

### Visual Diff
When comparing CAD files between commits, the plugin:
1. Exports both versions of the file
2. Provides paths for external visualization tools
3. Future versions will include integrated 3D diff visualization

## Integration with Other Plugins

### CAD Software Integration
- Automatically detects changes in CAD files from FreeCAD, Fusion 360, etc.
- Provides commit suggestions based on design changes
- Tracks design iterations and versions

### File Browser Integration
- Right-click Git operations in file browser
- Visual indicators for Git status
- Quick commit from file context menu

### Server Integration
- Sync local repositories with W.I.T. server
- Share repositories with team members
- Automated backups to server

## API Reference

### Commands

| Command | Description | Required Parameters |
|---------|-------------|-------------------|
| `init` | Initialize new repository | `name` or `path` |
| `clone` | Clone remote repository | `url` |
| `status` | Get repository status | `repoPath` |
| `add` | Stage files | `repoPath`, `files` |
| `commit` | Create commit | `repoPath`, `message` |
| `push` | Push to remote | `repoPath` |
| `pull` | Pull from remote | `repoPath` |
| `fetch` | Fetch from remote | `repoPath` |
| `branch` | Manage branches | `repoPath`, `action` |
| `checkout` | Switch branches/files | `repoPath`, `target` |
| `merge` | Merge branches | `repoPath`, `branch` |
| `log` | View commit history | `repoPath` |
| `diff` | View changes | `repoPath` |
| `diffCAD` | CAD file diff | `repoPath`, `file` |

### Events

The plugin emits the following events:

| Event | Description | Payload |
|-------|-------------|---------|
| `repository_added` | New repository discovered | Repository info |
| `repository_updated` | Repository status changed | Repository info |
| `commit_created` | New commit created | Commit details |
| `fetch_completed` | Auto-fetch completed | Repository path |

## Best Practices

### CAD File Version Control
1. Use meaningful commit messages describing design changes
2. Commit before major design modifications
3. Use branches for experimental features
4. Tag stable releases of designs

### Large Files
1. Use Git LFS for files over 100MB
2. Consider shallow clones for large repositories
3. Exclude generated files (STL exports, etc.) using .gitignore

### Collaboration
1. Pull before starting work
2. Use feature branches
3. Write descriptive commit messages
4. Review changes before committing

## Troubleshooting

### Git Not Found
- Ensure Git is installed and in PATH
- Check plugin settings for custom Git path
- Restart the Universal Desktop Controller

### Permission Errors
- Check file permissions in repository
- Ensure Git credentials are configured
- Use SSH keys for authentication

### CAD Diff Not Working
- Verify CAD file format is supported
- Check file size (very large files may timeout)
- Ensure enough disk space for temporary files

## Development

### Adding New CAD Formats
1. Add format to `supportedCADFormats` in config
2. Implement format-specific diff logic
3. Add visualization support

### Custom Git Hooks
Place hooks in `.git/hooks/` directory:
- `pre-commit`: Validate CAD files
- `post-commit`: Update design documentation
- `pre-push`: Run design rule checks

## License

This plugin is part of the W.I.T. Universal Desktop Controller and is licensed under the MIT License.