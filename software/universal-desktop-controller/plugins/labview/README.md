# LabVIEW Plugin for W.I.T. Universal Desktop Controller

## Overview
This plugin provides integration between W.I.T. and National Instruments LabVIEW, enabling control of LabVIEW from the W.I.T. interface.

## Supported Versions
- LabVIEW 2020 and later
- LabVIEW Community Edition 2025
- Both 32-bit and 64-bit versions

## Features
- Launch LabVIEW
- Open existing VI files
- Open LabVIEW projects
- Create new VIs (launches LabVIEW for manual creation)
- Create new projects
- Run and stop VIs
- Web service integration
- Remote panel support
- VI Server connectivity

## Known Limitations

### Creating New VI Files
LabVIEW uses a proprietary binary file format for VI files that cannot be directly created by external applications. When creating a new VI:

1. The plugin will launch LabVIEW
2. You'll need to manually create the VI using File > New VI
3. Save it with your desired name

This is a limitation of LabVIEW's file format, not the plugin.

### Platform-Specific Paths
The plugin searches for LabVIEW in common installation locations:

**macOS:**
- `/Applications/National Instruments/LabVIEW 2025 64-bit/LabVIEWCommunity.app`
- `/Applications/National Instruments/LabVIEW [YEAR].app`

**Windows:**
- `C:\Program Files\National Instruments\LabVIEW [YEAR]\`
- `C:\Program Files (x86)\National Instruments\LabVIEW [YEAR]\`

**Linux:**
- `/usr/local/natinst/LabVIEW-[YEAR]/`
- `/opt/natinst/LabVIEW-[YEAR]/`

## Configuration
The plugin stores configuration in:
- VI Path: `~/Documents/LabVIEW Data`
- Projects Path: `~/Documents/LabVIEW Data/Projects`

## Commands
- `launch` - Start LabVIEW
- `openVI` - Open an existing VI file
- `openProject` - Open a LabVIEW project
- `newVI` - Create a new VI (opens LabVIEW)
- `newProject` - Create a new project
- `runVI` - Run a VI
- `stopVI` - Stop VI execution
- `getStatus` - Get plugin and LabVIEW status

## Troubleshooting

### LabVIEW Not Found
If the plugin cannot find your LabVIEW installation:
1. Check that LabVIEW is installed in a standard location
2. Try launching LabVIEW manually to ensure it's properly installed
3. Check the UDC logs for the paths being searched

### VI Files Won't Open
- Ensure the VI file is not corrupted
- Check that the VI version is compatible with your LabVIEW version
- Try opening the VI directly in LabVIEW first

### Community Edition Support
LabVIEW Community Edition 2025 is fully supported. The plugin will automatically detect it at:
- macOS: `/Applications/National Instruments/LabVIEW 2025 64-bit/LabVIEWCommunity.app`
- Windows: `C:\Program Files\National Instruments\LabVIEW 2025\LabVIEWCommunity.exe`