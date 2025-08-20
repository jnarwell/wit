# Unified 3D Slicer Integration Documentation

## Overview
The Unified 3D Slicer integration provides comprehensive control of all major 3D slicing software through a single, unified interface in the W.I.T. Universal Desktop Controller. This integration supports PrusaSlicer, OrcaSlicer, Bambu Studio, SuperSlicer, and Ultimaker Cura.

## Supported Slicers ✅

### **Primary Slicers** (Excellent CLI Support):
- ✅ **PrusaSlicer** - Most popular open-source slicer with excellent Prusa printer support
- ✅ **OrcaSlicer** - Enhanced PrusaSlicer fork with better automation and multi-printer support
- ✅ **SuperSlicer** - Feature-rich PrusaSlicer fork with advanced calibration tools

### **Secondary Slicers** (Good CLI Support):
- ✅ **Bambu Studio** - Optimized slicer for Bambu Lab printers with cloud features
- ✅ **Ultimaker Cura** - Popular open-source slicer with wide printer compatibility

### **Specialized Slicers** (Coming Soon):
- 🔄 **CHITUBOX** - Resin printer slicer (planned for future release)
- 🔄 **Lychee Slicer** - Professional resin slicer with AI features (planned for future release)

## Architecture

### **Plugin Structure:**
```
plugins/unified-slicer/
├── index.js           # Main plugin implementation
├── manifest.json      # Plugin configuration and metadata
├── package.json       # Node.js package definition
└── config.json        # User configuration (auto-generated)
```

### **Frontend Integration:**
```
src/pages/
├── SlicerControlPage.tsx    # Main slicer control interface
├── SlicerControlPage.css    # Styling for slicer interface
└── SoftwareIntegrationsPage.tsx  # Updated to include unified slicer
```

## Features

### **Multi-Slicer Management**
- **Auto-Detection**: Automatically finds installed slicers on the system
- **Version Detection**: Reports installed versions and CLI compatibility
- **Unified Interface**: Single interface to control all slicers
- **Default Selection**: Configure your preferred default slicer

### **File Processing**
- **Supported Input Formats**: STL, 3MF, OBJ, AMF, PLY
- **Supported Output Formats**: G-code, 3MF (Bambu Studio)
- **Batch Processing**: Slice multiple files simultaneously
- **File Management**: Built-in file browser for sliced files

### **Slicing Profiles**
- **Pre-defined Profiles**: Draft, Quality, High-Detail
- **Custom Profiles**: Create and save custom slicing configurations
- **Profile Settings**:
  - Layer height (0.1mm - 0.3mm)
  - Infill density (10% - 25%)
  - Print speed (30mm/s - 80mm/s)
  - Support material (enabled/disabled)
  - Filament type (PLA, PETG, ABS, etc.)

### **Real-time Monitoring**
- **Job Progress**: Live progress tracking for slicing operations
- **Status Updates**: Real-time status of all active jobs
- **Error Handling**: Comprehensive error reporting and recovery
- **Job Management**: Cancel running jobs, view job history

### **G-code Analysis**
- **Print Time Estimation**: Accurate print time calculations
- **Filament Usage**: Material consumption estimates
- **Layer Analysis**: Layer count and height analysis
- **Temperature Settings**: Hotend and bed temperature detection
- **File Metadata**: Generator information and file statistics

### **Printer Integration**
- **Direct Upload**: Send sliced files directly to connected printers
- **Queue Management**: Manage print queues across multiple printers
- **Profile Matching**: Automatic printer profile selection

## Configuration

### **Slicer Paths** (Auto-detected):
#### macOS:
- PrusaSlicer: `/Applications/PrusaSlicer.app/Contents/MacOS/PrusaSlicer`
- OrcaSlicer: `/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer`
- Bambu Studio: `/Applications/BambuStudio.app/Contents/MacOS/BambuStudio`
- SuperSlicer: `/Applications/SuperSlicer.app/Contents/MacOS/SuperSlicer`
- Cura: `/Applications/UltiMaker Cura.app/Contents/MacOS/UltiMaker Cura`

#### Windows:
- PrusaSlicer: `C:\Program Files\Prusa3D\PrusaSlicer\prusa-slicer.exe`
- OrcaSlicer: `C:\Program Files\OrcaSlicer\OrcaSlicer.exe`
- Bambu Studio: `C:\Program Files\Bambu Studio\BambuStudio.exe`
- SuperSlicer: `C:\Program Files\SuperSlicer\superslicer.exe`
- Cura: `C:\Program Files\Ultimaker Cura\Ultimaker Cura.exe`

#### Linux:
- PrusaSlicer: `/usr/bin/prusa-slicer`
- OrcaSlicer: `/usr/bin/orcaslicer`
- Bambu Studio: `/usr/bin/bambustudio`
- SuperSlicer: `/usr/bin/superslicer`
- Cura: `/usr/bin/cura`

### **Default Settings:**
- **Output Directory**: `~/Documents/3D Printing/Sliced`
- **Default Slicer**: PrusaSlicer
- **Default Profile**: Quality (0.2mm layer height, 20% infill)
- **Auto-detect Printers**: Enabled

## How to Use

### **Prerequisites**
- At least one supported slicer installed
- Universal Desktop Controller running
- W.I.T. backend server active

### **Starting the System**
Run these commands in separate terminals:

```bash
# Terminal 1: Backend Server
cd /Users/jmarwell/Documents/wit/software/backend
python dev_server.py

# Terminal 2: Frontend Web Application  
cd /Users/jmarwell/Documents/wit/software/frontend/web
npm run dev

# Terminal 3: Universal Desktop Controller
cd /Users/jmarwell/Documents/wit/software/universal-desktop-controller
npm start
```

### **Accessing the Integration**
1. Open http://localhost:3000 in your browser
2. Login with `admin/admin`
3. Navigate to "Software Integrations"
4. Find "Unified 3D Slicers" card (should show as "Connected")
5. Click "Full Control →" to access the slicer control interface

### **Basic Workflow**
1. **Select Files**: Upload STL/3MF files using the file selector
2. **Choose Slicer**: Select your preferred slicer from available options
3. **Select Profile**: Choose a slicing profile (Draft/Quality/High-Detail)
4. **Start Slicing**: Click "Slice File(s)" to begin processing
5. **Monitor Progress**: Watch real-time progress in the Active Jobs section
6. **Analyze Results**: Use G-code analysis to review slicing results
7. **Send to Printer**: Queue files directly to connected printers

## API Commands

### **Slicer Management**
- `getAvailableSlicers` - List all installed slicers
- `launchSlicer` - Open slicer application with optional files

### **File Processing**
- `slice` - Slice a single file
- `batchSlice` - Slice multiple files simultaneously
- `getSlicedFiles` - List all processed files
- `deleteSlicedFile` - Remove processed files

### **Profile Management**
- `getSlicingProfiles` - List available slicing profiles
- `saveSlicingProfile` - Create custom slicing profiles

### **Job Management**
- `getJobStatus` - Check status of slicing jobs
- `cancelJob` - Cancel running slicing operations

### **Analysis & Integration**
- `analyzeGCode` - Analyze generated G-code files
- `sendToPrinter` - Send files to connected printers

### **Configuration**
- `updateConfig` - Update plugin configuration
- `getStatus` - Get plugin status and statistics

## Current Status

### **Working Features:**
- ✅ **Multi-slicer Detection**: Automatically finds and configures all installed slicers
- ✅ **Unified CLI Interface**: Single interface for all supported slicers
- ✅ **Profile Management**: Pre-defined and custom slicing profiles
- ✅ **Batch Processing**: Simultaneous slicing of multiple files
- ✅ **Real-time Progress**: Live updates during slicing operations
- ✅ **G-code Analysis**: Comprehensive analysis of generated files
- ✅ **File Management**: Built-in browser for sliced files
- ✅ **Error Handling**: Robust error reporting and recovery

### **Current Behavior:**
- **With Slicers Installed**: Full functionality including launching, slicing, and analysis
- **Without Slicers**: Graceful degradation with clear installation instructions
- **Mixed Installation**: Works with any combination of installed slicers

### **Integration Points:**
- **Existing Printer Control**: Seamless integration with W.I.T. printer management
- **File System**: Organized output directory with automatic cleanup
- **WebSocket Communication**: Real-time updates between frontend and backend
- **Security**: Sandboxed execution with controlled file system access

## Performance & Scalability

### **Optimization Features:**
- **Parallel Processing**: Multiple slicing jobs can run simultaneously
- **Memory Management**: Efficient handling of large STL files
- **Progress Streaming**: Real-time progress updates without blocking
- **Error Recovery**: Automatic cleanup of failed jobs

### **Resource Management:**
- **Process Isolation**: Each slicer runs in isolated processes
- **Timeout Protection**: Automatic termination of stalled operations
- **Disk Space Monitoring**: Automatic cleanup of old files
- **CPU Throttling**: Configurable resource limits

## Troubleshooting

### **Common Issues:**

#### **Slicer Not Detected**
- Verify slicer is installed at expected path
- Check that slicer executable has proper permissions
- Try manual path configuration in settings

#### **Slicing Fails**
- Ensure input file is valid STL/3MF format
- Check available disk space in output directory
- Verify slicer supports the specified settings

#### **Progress Not Updating**
- Check WebSocket connection status
- Restart UDC if communication issues persist
- Monitor browser console for JavaScript errors

#### **Files Not Appearing**
- Check output directory permissions
- Ensure sufficient disk space available
- Verify file wasn't moved or deleted externally

### **Debug Information:**
- Plugin logs available in UDC console
- WebSocket messages logged in browser developer tools
- Detailed error messages in slicing job status

## Next Steps

### **Planned Enhancements:**
1. **Resin Slicer Support**: Integration with CHITUBOX and Lychee Slicer
2. **Cloud Integration**: Bambu Cloud and PrusaConnect integration
3. **Advanced Profiles**: Material-specific and printer-specific profiles
4. **Print Queue Integration**: Direct integration with printer queues
5. **Thumbnail Generation**: G-code thumbnail extraction and display

### **Future Integrations:**
- **Slic3r PE**: Legacy PrusaSlicer support
- **IdeaMaker**: Professional slicer integration
- **Simplify3D**: Commercial slicer support
- **Custom Slicers**: Plugin system for additional slicers

---

**Status**: Production-ready with comprehensive multi-slicer support
**Last Updated**: August 19, 2025
**Version**: 1.0.0
**Supported Slicers**: 5 (PrusaSlicer, OrcaSlicer, Bambu Studio, SuperSlicer, Cura)