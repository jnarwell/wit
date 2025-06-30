# W.I.T. Hardware Design

This directory contains all hardware design files for the W.I.T. Terminal system.

## Directory Structure
- `electrical/` - PCB designs, schematics, and electrical documentation
- `mechanical/` - CAD files, enclosure designs, and mechanical drawings
- `testing/` - Test procedures, validation reports, and compliance documentation

## Design Tools
- **Electrical**: KiCad 7.0+ (open source) or Altium Designer
- **Mechanical**: Fusion 360 or FreeCAD
- **Simulation**: LTSpice for circuits, Ansys for thermal

## Key Components
- Main processing board with AMD/Intel CPU
- Hailo-8L NPU expansion card
- Power distribution board
- Modular interface boards
- Voice processing array board

## Design Guidelines
- Follow IPC standards for PCB design
- Maintain 10% component derating
- Design for manufacturing (DFM) from the start
- Consider thermal management in all designs
