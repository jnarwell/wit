# Bambu Studio Quick Start Guide

## Overview
Bambu Studio integration in the W.I.T. Universal Desktop Controller provides automated slicing capabilities for Bambu Lab printers with 3MF output format.

## Key Differences from Other Slicers

### Output Format
- **Bambu Studio**: Outputs `.3mf` files (project format)
- **Other Slicers**: Output `.gcode` files (machine instructions)

### CLI Limitations
- **No Parameter Override**: Individual slicing parameters cannot be set via command line
- **Default Settings Only**: Uses Bambu Studio's configured profiles
- **Basic Commands**: Simplified command structure for slicing operations

## Working Command Structure

```bash
# Basic slicing command
BambuStudio --slice 2 --outputdir /path/to/output --export-3mf output.3mf input.stl
```

### Command Breakdown:
- `--slice 2`: Enable slicing with debug level 2
- `--outputdir /path`: Specify output directory
- `--export-3mf output.3mf`: Export as 3MF format
- `input.stl`: Input file to slice

## What Works ✅
- Auto-detection of Bambu Studio installation
- Basic slicing with default settings
- 3MF file generation
- File browser integration
- Job progress tracking
- Multi-file batch processing

## What Doesn't Work ❌
- Individual parameter override (layer height, infill, etc.)
- G-code generation (use Bambu Studio app to convert)
- Custom profile selection via CLI
- Detailed 3MF file analysis

## Workflow

1. **Select Files**: Use the file browser or manual path input
2. **Choose Bambu Studio**: Select from available slicers
3. **Slice**: Files will be sliced with default settings
4. **View Results**: 3MF files appear in the sliced files list
5. **Open in Bambu Studio**: Double-click to open and adjust settings

## Troubleshooting

### "Invalid option" Errors
If you see errors like `Invalid option --layer_height`:
- Remove all parameter overrides from the command
- Use only the basic command structure shown above

### Files Not Appearing
- Check the output directory exists
- Ensure Bambu Studio completed successfully
- Look for `.3mf` files, not `.gcode`

### Parameter Adjustment Needed
- Configure default profiles in Bambu Studio application
- Use Bambu Studio GUI for parameter-specific slicing
- Consider using PrusaSlicer for CLI parameter control

## Best Practices

1. **Configure Defaults**: Set up your preferred default profile in Bambu Studio
2. **Use for Bambu Printers**: Best suited for Bambu Lab printer workflows
3. **Post-Process in App**: Open 3MF files in Bambu Studio for final adjustments
4. **Alternative for CLI Control**: Use PrusaSlicer or OrcaSlicer for full CLI parameter control

## Future Enhancements

- Research Bambu Studio config file format for profile loading
- Investigate API options for parameter control
- Add 3MF to G-code conversion capability
- Implement Bambu Cloud integration

---

**Version**: 1.0
**Last Updated**: August 20, 2025
**Status**: Working with limitations