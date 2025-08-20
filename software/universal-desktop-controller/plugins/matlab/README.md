# MATLAB Plugin for W.I.T. Universal Desktop Controller

Advanced computational analysis and modeling integration for the W.I.T. platform.

## Features

### Core MATLAB Integration
- **MATLAB Launch**: Launch MATLAB desktop with customizable startup options
- **Engine Management**: Start/stop MATLAB Engine for programmatic control
- **Real-time Communication**: WebSocket-based communication with frontend
- **Cross-platform Support**: Works on Windows, macOS, and Linux
- **Live Output**: Real-time display of MATLAB computation results and visualizations

### Code Execution & Workspace
- **Interactive Terminal**: Execute MATLAB code directly from WIT frontend with actual results
- **Script Execution**: Run MATLAB scripts (.m files) with argument support
- **Function Calls**: Execute MATLAB functions with parameter passing
- **Workspace Management**: Load/save data, browse workspace files, clear workspace
- **Real Computation**: All calculations performed by actual MATLAB engine, not simulated

### Advanced Analysis Capabilities
- **Statistical Analysis**: Real-time sensor data statistics and visualization
- **Signal Processing**: FFT analysis, filtering, and signal manipulation
- **Optimization**: Process optimization using MATLAB Optimization Toolbox
- **Machine Learning**: Neural networks and regression model training
- **Simulation**: Linear system and control system simulation
- **Digital Twin Creation**: Framework for creating digital twin models

### Industrial Workshop Integration
- **Sensor Data Analysis**: Process data from workshop sensors and equipment
- **Process Optimization**: Optimize manufacturing processes and parameters
- **Predictive Analytics**: Machine learning models for maintenance predictions
- **Quality Control**: Statistical process control and quality analysis
- **Real-time Monitoring**: Live data visualization and dashboard creation

### Batch Processing & Automation
- **Batch Analysis**: Process multiple files or datasets automatically
- **Job Management**: Track and monitor long-running MATLAB operations
- **Progress Monitoring**: Real-time progress updates for batch operations
- **Error Handling**: Robust error handling and recovery mechanisms

### Web Applications & Deployment
- **Web App Server**: Deploy MATLAB applications as web services
- **Model Deployment**: Deploy trained models to production environments
- **Cloud Integration**: Connect to MATLAB Cloud services
- **Remote Access**: Access MATLAB functionality remotely

### Toolbox Integration
- **Toolbox Detection**: Automatically detect installed MATLAB toolboxes
- **Add-on Management**: Install and manage MATLAB add-ons
- **GPU Computing**: Enable GPU-accelerated computing when available
- **Parallel Computing**: Utilize Parallel Computing Toolbox features

## Installation & Setup

### Prerequisites
- MATLAB R2023a or later installed on the system
- W.I.T. Universal Desktop Controller
- Node.js dependencies: `axios`, `ws`

### Configuration
The plugin automatically detects MATLAB installations on your system. Default configuration includes:

- **MATLAB Path**: Auto-detected based on platform
- **Workspace**: `~/Documents/MATLAB`
- **Engine Mode**: Shared engine for better performance
- **Timeout**: 30 seconds for command execution
- **Features**: Engine, Web Apps, GPU, Parallel Computing

### Platform-specific Paths
- **macOS**: `/Applications/MATLAB_R2024b.app/bin/matlab`
- **Windows**: `C:\Program Files\MATLAB\R2024b\bin\matlab.exe`
- **Linux**: `/usr/local/MATLAB/R2024b/bin/matlab`

## Usage

### Basic Operations
1. **Start Engine**: Click "Start Engine" to launch MATLAB in command-line mode
2. **Execute Code**: Type MATLAB code in the command window and press Execute
3. **View Results**: See real computation results in the output panel
4. **Quick Analysis**: Use predefined analysis buttons for common tasks

### Example Commands
```matlab
% Basic calculations - returns actual results
2 + 2
% ans = 4

% Create and display variables
x = 1:10;
y = x.^2;
disp(y)

% Statistical analysis with real random data
data = randn(100,1);
fprintf('Mean: %.4f\n', mean(data));
fprintf('Std: %.4f\n', std(data));

% Create visualizations (opens in MATLAB figure window)
plot(x, y);
title('Quadratic Function');
```

### Quick Analysis Tools
- **Statistics**: Generate descriptive statistics for data
- **Plotting**: Create basic plots and visualizations
- **Optimization**: Run optimization algorithms
- **Simulation**: Simulate control systems and processes
- **FFT Analysis**: Perform frequency domain analysis

### Workspace Management
- **Browse Files**: View MATLAB files in your workspace
- **Save Workspace**: Save current variables to .mat files
- **Load Data**: Import data from various file formats
- **Clear Workspace**: Reset MATLAB workspace

### Advanced Features
- **Batch Processing**: Process multiple files or datasets
- **Web Apps**: Deploy MATLAB applications as web services
- **Cloud Integration**: Connect to MATLAB Cloud for remote computing
- **Model Deployment**: Deploy trained models for production use

## API Reference

### Core Commands
- `launch`: Launch MATLAB desktop application
- `startEngine`: Start MATLAB Engine for programmatic control
- `stopEngine`: Stop MATLAB Engine
- `executeCode`: Execute MATLAB code with timeout handling
- `executeScript`: Run MATLAB script files
- `runFunction`: Execute MATLAB functions with parameters

### Data Management
- `loadData`: Load data from files into MATLAB workspace
- `saveData`: Save workspace variables to files
- `getWorkspace`: Get information about workspace variables
- `clearWorkspace`: Clear all workspace variables
- `browseWorkspace`: Browse MATLAB files in workspace directory

### Analysis & Visualization
- `plotData`: Create plots and visualizations
- `analyzeSensorData`: Analyze sensor data with various methods
- `optimizeProcess`: Run optimization algorithms
- `simulateSystem`: Simulate control systems and processes
- `runMLModel`: Train and evaluate machine learning models

### Advanced Features
- `batchAnalysis`: Process multiple files in batch mode
- `createDigitalTwin`: Create digital twin models
- `deployModel`: Deploy models to production environments
- `connectToCloud`: Connect to MATLAB Cloud services
- `startWebApp`: Start MATLAB web application server

### Job Management
- `getJobStatus`: Get status of running jobs
- `cancelJob`: Cancel long-running operations
- `getStatus`: Get overall plugin status and configuration

## Integration with WIT Platform

### Workshop Equipment
- Connect to sensors and measurement devices
- Process real-time data from manufacturing equipment
- Control and monitor automated systems
- Analyze production quality and efficiency

### Data Pipeline
- Seamless data exchange with WIT database
- Export analysis results to other WIT modules
- Import project data for computational analysis
- Integration with WIT's AI and ML workflows

### Visualization & Reporting
- Generate professional reports and visualizations
- Export plots and analysis results
- Create interactive dashboards
- Integration with WIT's reporting system

## Error Handling & Troubleshooting

### Common Issues
1. **MATLAB Not Found**: Ensure MATLAB is installed and path is configured
2. **Engine Startup Failure**: Check MATLAB license and installation
3. **Permission Errors**: Verify file system permissions for workspace
4. **Timeout Errors**: Increase timeout for long-running operations

### Debug Mode
Enable verbose logging in plugin configuration to troubleshoot issues.

## License

This plugin is part of the W.I.T. platform and follows the same licensing terms.

## Support

For issues and questions:
1. Check the plugin logs in UDC console
2. Verify MATLAB installation and licensing
3. Review WIT system requirements
4. Contact WIT support team for assistance