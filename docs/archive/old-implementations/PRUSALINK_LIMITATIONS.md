# Prusa Printer API Limitations

## Important Note About Prusa Printer Control

Both PrusaLink (local) and PrusaConnect (cloud) APIs have significant limitations for printer control. This is by design for security and safety reasons.

## PrusaLink (Local Network)

### What Works:
- ✅ Reading printer status (temperatures, position, etc.)
- ✅ Managing print files
- ✅ Starting prints from uploaded files
- ✅ Monitoring print progress

### What Doesn't Work via API:
- ❌ Setting temperatures
- ❌ Moving axes (homing, jogging)
- ❌ Pausing/resuming prints
- ❌ Emergency stop
- ❌ Sending arbitrary G-code

## PrusaConnect (Cloud)

### What Works:
- ✅ Remote monitoring of printer status
- ✅ Viewing print history
- ✅ Managing print queue
- ✅ Starting prints from cloud-stored files

### What Doesn't Work via API:
- ❌ Direct temperature control
- ❌ Movement commands
- ❌ Real-time printer control
- ❌ G-code command execution

## Workarounds:

1. **Use the PrusaLink Web Interface**
   - Navigate to your printer's IP address
   - Use the built-in controls for temperature and movement

2. **Use OctoPrint Instead**
   - OctoPrint provides full API control including G-code commands
   - Install OctoPrint on a Raspberry Pi connected to your printer
   - W.I.T. fully supports OctoPrint's API

3. **PrusaConnect Web Interface**
   - Access via connect.prusa3d.com
   - Limited to monitoring and queue management

## Recommendation:

For full programmatic control of your Prusa printer through W.I.T., we recommend using **OctoPrint**. It provides:
- Complete G-code command support
- Temperature control API
- Movement control API
- Plugin ecosystem
- Camera support
- Real-time control capabilities

The W.I.T. platform already has full OctoPrint integration ready to use.

## Summary

- **PrusaLink**: Local access, read-only monitoring
- **PrusaConnect**: Cloud access, queue management only  
- **OctoPrint**: Full control, recommended solution