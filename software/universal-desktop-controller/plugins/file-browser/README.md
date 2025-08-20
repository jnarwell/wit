# File Browser Plugin for W.I.T. Universal Desktop Controller

## Overview

The File Browser plugin provides comprehensive file system access and management capabilities for the W.I.T. platform. It enables full control over files and directories across Windows, macOS, and Linux operating systems through a secure, web-based interface.

## Features

### 🗂️ File System Navigation
- Browse entire file system with root path access
- Quick access sidebar with common directories (Home, Desktop, Documents, Downloads, etc.)
- Disk usage visualization for each root path
- Support for symbolic links and special file types

### 📁 Directory Operations
- List directory contents with detailed metadata
- Create new directories with recursive support
- Navigate through directory hierarchies
- Show/hide hidden files toggle
- Real-time file system watching with chokidar

### 📄 File Operations
- Read file contents with configurable size limits (100MB default)
- Write and append to files
- Copy, move, delete, and rename files and directories
- Batch operations on multiple selected items
- File search functionality with pattern matching

### 🔐 Security Features
- Path validation to prevent directory traversal attacks
- Configurable root path restrictions
- Permission checking before operations
- File size limits to prevent memory exhaustion
- Detailed permission information (owner, group, others)

### 🗜️ Archive Support
- Compress files and directories (ZIP, tar.gz formats)
- Decompress archives to specified locations
- Cross-platform compression utilities

### 🖥️ System Integration
- Open files with default system applications
- Execute files with proper permissions
- Platform-specific file operations
- System information and disk usage reporting

## Installation

The File Browser plugin is included as a built-in plugin in the Universal Desktop Controller and requires no additional installation.

### Dependencies
- **chokidar**: File system watching
- **mime-types**: MIME type detection

## Configuration

The plugin supports the following configuration options in `manifest.json`:

```json
{
  "rootPaths": {
    "type": "array",
    "default": "auto",
    "description": "Root paths accessible to the file browser"
  },
  "hiddenFiles": {
    "type": "boolean", 
    "default": true,
    "description": "Show hidden files and directories"
  },
  "followSymlinks": {
    "type": "boolean",
    "default": true, 
    "description": "Follow symbolic links when browsing"
  },
  "maxFileSize": {
    "type": "number",
    "default": 104857600,
    "description": "Maximum file size to read (100MB default)"
  }
}
```

## API Commands

### Navigation Commands
- `getRoots()` - Get all accessible root paths with disk usage
- `listDirectory(path, showHidden)` - List directory contents
- `getFileInfo(path)` - Get detailed file/directory information

### File Operations
- `readFile(path, encoding, start, end)` - Read file contents
- `writeFile(path, content, encoding, append)` - Write to file
- `createDirectory(path, recursive)` - Create directory
- `delete(path, recursive)` - Delete file or directory
- `rename(oldPath, newPath)` - Rename file or directory
- `copy(source, destination, recursive)` - Copy file or directory
- `move(source, destination)` - Move file or directory

### Advanced Operations
- `search(directory, pattern, options)` - Search for files
- `watchDirectory(path, recursive)` - Watch for file changes
- `openWithDefault(path)` - Open with system default app
- `compress(files, outputPath, format)` - Create archive
- `decompress(filePath, outputDir)` - Extract archive

### System Information
- `getSystemInfo()` - Get platform and user information
- `getDiskUsage(path)` - Get disk space information

## Usage Examples

### Basic File Operations
```javascript
// Get root paths
const roots = await sendCommand('file-browser', 'getRoots');

// List directory contents
const files = await sendCommand('file-browser', 'listDirectory', {
  path: '/Users/username/Documents',
  showHidden: false
});

// Create a new folder
await sendCommand('file-browser', 'createDirectory', {
  path: '/Users/username/Documents/NewFolder'
});

// Read a file
const content = await sendCommand('file-browser', 'readFile', {
  path: '/Users/username/Documents/test.txt',
  encoding: 'utf8'
});
```

### File Watching
```javascript
// Start watching a directory
await sendCommand('file-browser', 'watchDirectory', {
  path: '/Users/username/Projects',
  recursive: true
});

// File change events will be emitted automatically
```

## Frontend Integration

The File Browser includes a complete React-based UI accessible through the W.I.T. web interface:

### Features
- Dual-pane file manager interface
- Path breadcrumb navigation  
- Multi-select operations
- Drag-and-drop ready structure
- Search and filtering
- Context menus for file operations
- Progress indicators for long operations

### Keyboard Shortcuts
- `Ctrl+A` - Select all files
- `Delete` - Delete selected files
- `F2` - Rename selected file
- `Ctrl+C` - Copy selected files
- `Ctrl+X` - Cut selected files  
- `Ctrl+V` - Paste files
- `Enter` - Open file/navigate into directory

## Platform Support

### Windows
- Full NTFS file system support
- Windows-specific paths and drives (C:\, D:\, etc.)
- PowerShell integration for compression
- Windows file associations

### macOS
- HFS+ and APFS file system support
- Unix permissions and symbolic links
- Spotlight integration capabilities
- macOS file associations and Quick Look

### Linux
- EXT4, XFS, and other Linux file systems
- Full Unix permissions support
- Package manager integration potential
- Desktop environment file associations

## Security Considerations

1. **Path Validation**: All file paths are normalized and validated to prevent directory traversal attacks
2. **Permission Checks**: File system permissions are respected and checked before operations  
3. **Access Control**: Root paths can be restricted to specific directories
4. **Resource Limits**: File size limits prevent memory exhaustion attacks
5. **Audit Trail**: All file operations are logged for security monitoring

## Error Handling

The plugin provides detailed error messages for common scenarios:
- Permission denied errors with suggested solutions
- File not found errors with path validation
- Disk space errors with available space information
- Network path errors for remote file systems

## Performance

- **Efficient Directory Listing**: Optimized for large directories (tested with 1750+ files)
- **Streaming File Operations**: Large files are processed in chunks
- **Caching**: Directory metadata is cached to improve navigation speed
- **Background Operations**: File watching and indexing don't block the UI

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure the UDC process has appropriate file system permissions
2. **Large File Handling**: Adjust `maxFileSize` configuration for larger files
3. **Network Paths**: Some network file systems may require additional configuration
4. **Symbolic Links**: Broken symbolic links are handled gracefully

### Debug Mode

Enable debug logging by setting the plugin's debug flag:
```javascript
// In plugin initialization
this.debug = true;
```

## Development

### Architecture
- **Base Class**: Extends `WITPlugin` for consistent plugin behavior
- **Event Driven**: Uses Node.js EventEmitter for file system events
- **Promise Based**: All operations return promises for async handling
- **Error Resilient**: Comprehensive error handling and recovery

### Testing
- Unit tests for core file operations
- Integration tests with various file systems
- Performance tests with large directories
- Cross-platform compatibility testing

## License

This plugin is part of the W.I.T. project and follows the same licensing terms.