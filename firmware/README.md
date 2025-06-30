# W.I.T. Firmware

Real-time embedded software for the W.I.T. Terminal hardware platform.

## Architecture
- **RTOS**: FreeRTOS or Zephyr
- **HAL**: Hardware abstraction layer for portability
- **Drivers**: Low-level hardware drivers
- **Core**: Main application logic

## Building
```bash
# Setup toolchain
./tools/setup-toolchain.sh

# Configure for target
make menuconfig

# Build firmware
make -j$(nproc)

# Flash to device
make flash
```

## Key Modules
- Voice wake word detection
- Real-time sensor processing
- Equipment communication protocols
- Safety monitoring system
- OTA update system

## Development Guidelines
- Keep ISR code minimal
- Use DMA for high-speed transfers
- Implement watchdog timers
- Follow MISRA-C guidelines where applicable
