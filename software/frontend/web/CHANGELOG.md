# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- General AI query capability in terminal
  - Ask any question with "ask", "?", or "@ai" prefix
  - Natural language detection - recognizes questions without prefixes
  - Math operations automatically detected (e.g., "what is 5 + 5", "10 * 3")
  - Square root support with multiple formats (√, sqrt, "square root of")
  - Integrated with Claude and other AI providers
  - Handles math, science, engineering, and general knowledge queries
  - Voice-enabled AI responses
  - Examples: "what is the square root of 144", "how do I calculate voltage drop"
- Terminal now routes ANY unrecognized command to AI models
  - WIT-specific commands handled first
  - All other commands sent to AI for natural language processing
  - Updated help text to reflect new AI-first approach
- Function page with custom WIT tools and capabilities
  - 11 custom tools across 5 categories (3D Modeling, Visualization, Analysis, Automation, Utilities)
  - WIT CAD Modeler with 3D viewer demo
  - WIT Slicer with full slicing interface demo
  - Tool status indicators (Available, Beta, Coming Soon)
  - Category filtering and statistics
- 3D Slicer software integrations
  - Added 9 popular slicers (PrusaSlicer, Cura, Bambu Studio, etc.)
  - Added 8 printer control software (OctoPrint, Mainsail, PrusaLink, etc.)
  - New categories: "3D Slicers" and "Printer Control" in Software page

### Fixed
- Voice feedback loop - terminal no longer responds to its own speech
- Added British male voice selection for deeper voice
- Pauses speech recognition while speaking to prevent echo
- AI query authentication - properly passes auth tokens from context to AI service
- Natural language question detection now works without AI prefixes
- Fixed "I'm still learning..." responses for valid questions

### Added
- Voice-enabled terminal with speech recognition and text-to-speech
  - Voice commands: "voice on/off" to toggle voice mode
  - Wake word detection: "hey wit" activates when sleeping
  - Auto-pause after 3 seconds of silence
  - Auto-sleep after 5 minutes of inactivity
  - Real-time voice status indicators
  - Voice transcript display while listening
  - Persistent voice state across tab switches
  - Help command with voice instructions
- MCP (Model Context Protocol) integration for two-way AI model communication
  - Comprehensive MCP settings panel in user settings
  - Data permission management (machines, projects, sensors, tasks, files, analytics, user profile)
  - Model operation permissions (read, write, execute, delete)
  - Trusted AI model whitelist
  - MCP server connection configuration
  - Auto-sync functionality with configurable intervals
  - Real-time MCP status indicator in navigation bar
  - WebSocket-based communication service
  - Secure authentication with API keys
- Audio and video recording functionality to dashboard widgets
  - One-click recording for audio widget (microphone sources)
  - One-click recording for video widget (webcam sources)
  - Automatic file download with timestamp in filename
  - Visual recording indicators (pulsing red dot)
  - Real-time recording timer display
  - WebM format for both audio and video recordings

### Changed
- Enhanced terminal with voice controls and indicators
- Enhanced audio widget with recording controls
- Enhanced video widget with recording controls
- Updated widget status indicators to show recording state
- Added MCP tab to settings page
- Updated terminal welcome message with voice instructions

## [0.2.0] - 2024-01-31

### Added
- Terminal AI agent selection settings
  - Settings modal with 4 predefined AI agents
  - Multi-agent selection with checkboxes
  - Synthesis option for combining multiple agent responses
  - LocalStorage persistence for settings
- Audio output widget for dashboard
  - Real-time audio visualization with frequency bars
  - Mute/unmute functionality
  - Volume control slider
  - Multiple audio source selection
  - Device enumeration support
- Video stream widget for dashboard
  - Webcam and stream support (RTSP, HTTP)
  - Play/pause controls
  - Fullscreen mode
  - Multiple video source selection
  - Settings panel for source configuration
- Audio/video device configuration in machine settings
  - Enable/disable toggles
  - Device name and stream URL configuration
  - Stream type selection for video
  - Integration with dashboard widgets

## [0.1.0] - 2024-01-30

### Added
- Initial project setup
- Dashboard with customizable widget grid
- Machine management system
- Terminal interface
- Task management features
- File browser
- 3D workspace visualization