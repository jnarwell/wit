# Docker Desktop Integration Plugin

A comprehensive Docker integration plugin for the W.I.T. Universal Desktop Controller that provides complete container management, image operations, and Docker Compose support.

## Features

### Container Management
- **List Containers**: View all running and stopped containers with detailed information
- **Create Containers**: Create new containers from images with custom configuration
- **Start/Stop/Restart**: Complete container lifecycle management
- **Remove Containers**: Clean up unused containers with force options
- **Container Logs**: Real-time and historical log viewing
- **Execute Commands**: Run commands inside running containers
- **Container Inspection**: Detailed container information and configuration

### Image Operations
- **List Images**: View all local Docker images with size and creation info
- **Pull Images**: Download images from Docker registries
- **Build Images**: Build custom images from Dockerfiles with build arguments
- **Push Images**: Upload images to registries
- **Remove Images**: Clean up unused images
- **Image Inspection**: Detailed image metadata and layer information

### Network Management
- **List Networks**: View all Docker networks
- **Create Networks**: Create custom Docker networks with drivers
- **Remove Networks**: Clean up unused networks
- **Network Inspection**: Detailed network configuration

### Volume Management
- **List Volumes**: View all Docker volumes
- **Create Volumes**: Create named volumes for persistent data
- **Remove Volumes**: Clean up unused volumes
- **Volume Inspection**: Detailed volume information

### Docker Compose Support
- **Compose Up**: Start multi-container applications
- **Compose Down**: Stop and remove compose services
- **Compose PS**: List compose services status
- **Compose Logs**: View logs from compose services

### System Operations
- **System Info**: Docker daemon and system information
- **System Prune**: Clean up unused resources (containers, images, networks, volumes)
- **Resource Monitoring**: Container and system resource usage

## Installation Requirements

### Docker Desktop
- **Windows**: Docker Desktop for Windows
- **macOS**: Docker Desktop for Mac
- **Linux**: Docker Engine or Docker Desktop for Linux

### Supported Versions
- Docker Engine 20.0.0+
- Docker Desktop 3.0.0+
- Docker Compose 1.27.0+

## Configuration

The plugin supports extensive configuration options:

```json
{
  "autoStartDaemon": false,
  "enableBuildkit": true,
  "defaultRegistry": "docker.io",
  "composeProfiles": [],
  "resourceLimits": {
    "cpus": 4,
    "memory": "8GB",
    "swap": "1GB"
  },
  "networkSettings": {
    "enableIPv6": false,
    "dnsServers": []
  }
}
```

### Configuration Options

- **autoStartDaemon**: Automatically start Docker daemon when plugin starts
- **enableBuildkit**: Use Docker BuildKit for improved build performance
- **defaultRegistry**: Default Docker registry for image operations
- **composeProfiles**: Default profiles for Docker Compose operations
- **resourceLimits**: Docker Desktop resource allocation limits
- **networkSettings**: Docker networking configuration

## Usage Examples

### Container Operations

#### Create and Start a Container
```javascript
// Create a new container
await sendCommand('docker', 'createContainer', {
    image: 'nginx:alpine',
    name: 'my-nginx',
    ports: ['8080:80'],
    volumes: ['./html:/usr/share/nginx/html:ro'],
    environment: ['ENV=production']
});

// Start the container
await sendCommand('docker', 'startContainer', {
    containerId: 'my-nginx'
});
```

#### Get Container Logs
```javascript
const logs = await sendCommand('docker', 'getContainerLogs', {
    containerId: 'my-nginx',
    tail: 50,
    follow: false
});
```

### Image Operations

#### Build a Custom Image
```javascript
await sendCommand('docker', 'buildImage', {
    dockerfilePath: './Dockerfile',
    imageName: 'my-app:latest',
    buildContext: '.',
    buildArgs: ['NODE_ENV=production', 'VERSION=1.0.0']
});
```

#### Pull an Image
```javascript
await sendCommand('docker', 'pullImage', {
    imageName: 'postgres:13-alpine'
});
```

### Docker Compose Operations

#### Start a Compose Application
```javascript
await sendCommand('docker', 'composeUp', {
    composePath: './docker-compose.yml',
    detached: true,
    build: true
});
```

#### Stop Compose Services
```javascript
await sendCommand('docker', 'composeDown', {
    composePath: './docker-compose.yml',
    removeVolumes: false
});
```

### System Operations

#### Get System Information
```javascript
const systemInfo = await sendCommand('docker', 'getSystemInfo');
console.log('Docker version:', systemInfo.systemInfo.ServerVersion);
console.log('Total containers:', systemInfo.systemInfo.Containers);
```

#### Clean Up Resources
```javascript
await sendCommand('docker', 'pruneSystem', {
    containers: true,
    images: true,
    networks: true,
    volumes: true,
    force: true
});
```

## Frontend Integration

The Docker plugin integrates with the W.I.T. frontend through:

1. **Software Integrations Page**: Docker appears as an available integration
2. **Quick Actions**: Launch Docker Desktop, view system status
3. **Full Control Page**: Comprehensive Docker management interface (to be implemented)

### Available Commands from Frontend

- **Launch Docker Desktop**: `sendCommand('docker', 'launch')`
- **Get Status**: `sendCommand('docker', 'getStatus')`
- **List Containers**: `sendCommand('docker', 'listContainers', { all: true })`
- **List Images**: `sendCommand('docker', 'listImages')`

## Error Handling

The plugin provides comprehensive error handling:

- **Docker Not Installed**: Clear error messages with installation guidance
- **Docker Daemon Not Running**: Instructions to start Docker service
- **Permission Errors**: Guidance for Docker group membership (Linux)
- **Network Connectivity**: Registry connection error handling
- **Resource Constraints**: Memory and disk space error reporting

## Security Considerations

- **Sandboxed Operations**: All Docker commands run through secure subprocess execution
- **Path Validation**: Input validation for file paths and container names
- **Resource Limits**: Configurable resource constraints to prevent system overload
- **Registry Authentication**: Secure handling of registry credentials

## Platform Support

### Windows
- Docker Desktop for Windows
- Docker CLI tools
- Windows containers support

### macOS
- Docker Desktop for Mac
- Homebrew Docker installation support
- Apple Silicon (M1/M2) compatibility

### Linux
- Docker Engine
- Docker Desktop for Linux
- Podman compatibility (experimental)

## Development Workflow Integration

The Docker plugin enhances development workflows by:

1. **Container-based Development**: Quick container creation for development environments
2. **Multi-service Applications**: Docker Compose support for complex applications
3. **CI/CD Integration**: Image building and registry operations
4. **Microservices Management**: Multiple container orchestration
5. **Database Containers**: Quick database instance creation for development

## Troubleshooting

### Common Issues

**Docker Command Not Found**
- Ensure Docker is installed and in PATH
- Restart terminal/application after Docker installation

**Permission Denied (Linux)**
- Add user to docker group: `sudo usermod -aG docker $USER`
- Restart session after group change

**Docker Daemon Not Running**
- Start Docker Desktop application
- On Linux: `sudo systemctl start docker`

**Build Context Too Large**
- Use `.dockerignore` to exclude unnecessary files
- Optimize build context location

### Logging

Enable debug logging for troubleshooting:

```javascript
// In plugin configuration
{
  "logLevel": "debug",
  "enableVerboseOutput": true
}
```

## Dependencies

- **dockerode**: Node.js Docker API client (optional, for advanced operations)
- **Docker CLI**: Required for all operations
- **Docker Desktop**: Required for GUI-based operations

## Contributing

To extend the Docker plugin:

1. Add new commands to `manifest.json`
2. Implement command handlers in `index.js`
3. Update frontend integration if needed
4. Add comprehensive error handling
5. Update documentation

## License

MIT License - See main project license for details.