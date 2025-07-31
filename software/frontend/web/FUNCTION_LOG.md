# Function Log

This document tracks major functionality additions and changes to the WIT frontend application.

## 2024-01-31

### MCP (Model Context Protocol) Integration

#### MCP Settings Component (MCPSettings.tsx)
- **Component**: `MCPSettingsComponent`
  - Full configuration interface for MCP
  - Data permission toggles
  - Model permission management
  - Trusted model whitelist
  - Connection testing functionality

#### MCP Service (mcpService.ts)
- **Class**: `MCPService`
  - WebSocket connection management
  - Auto-reconnection logic
  - Message queue for offline operation
  - Permission-based data access control
  
- **Method**: `syncContext()`
  - Gathers permitted data types
  - Sends context updates to AI models
  - Respects user privacy settings

- **Method**: `handleMessage()`
  - Validates model trust status
  - Checks operation permissions
  - Routes messages to appropriate handlers

#### MCP Status Indicator (MCPStatusIndicator.tsx)
- **Component**: `MCPStatusIndicator`
  - Real-time connection status
  - Active model count display
  - Data transfer metrics
  - Quick access to settings

### General AI Query Integration

#### AI Service (aiService.ts)
- **Class**: `AIService`
  - Multi-provider support (Claude, OpenAI, Gemini)
  - Provider configuration management
  - Fallback to terminal's built-in AI
  
- **Method**: `query()`
  - Routes queries to appropriate AI provider
  - Handles API authentication
  - Returns standardized responses

#### Terminal AI Integration (Terminal.tsx)
- **Command Prefixes**:
  - "ask [question]" - Natural language queries
  - "? [question]" - Quick query shortcut
  - "@ai [question]" - Direct AI routing
  
- **Natural Language Detection**:
  - Questions without prefixes (what is, how do, why, when, where, who, which)
  - Math operations (5 + 5, 10 * 3, numbers with +, -, *, /, ^)
  - Square root notation (√, sqrt, square root of)
  - Action words (calculate, explain, define)
  
- **Features**:
  - Seamless integration with voice mode
  - Provider indication in responses
  - Error handling and fallbacks
  - Authentication token passing from context

#### Backend AI Endpoint (dev_server.py)
- **Endpoint**: `/api/v1/terminal/ai-query`
  - Simulated responses for development
  - Math calculations (square root, etc.)
  - Engineering formulas (voltage drop, etc.)
  - Workshop-specific knowledge (3D printing temps)

### Voice-Enabled Terminal

#### Voice Service (voiceService.ts)
- **Class**: `VoiceService`
  - Web Speech API integration
  - Wake word detection ("hey wit")
  - Auto-sleep after inactivity
  - Continuous listening with auto-restart
  
- **Method**: `handleFinalTranscript()`
  - Processes voice commands
  - Detects wake word when sleeping
  - Handles stop command
  - Manages silence detection

- **Method**: `speak()`
  - Text-to-speech for terminal responses
  - Configurable voice settings
  - Priority speech interruption

#### Terminal Voice Integration (Terminal.tsx)
- **Voice Commands**:
  - "voice on/off" - Toggle voice mode
  - "help" - Shows commands including voice
  - "voice help" - Voice-specific help
  
- **UI Elements**:
  - Real-time voice status indicator
  - Voice transcript display
  - Microphone toggle button
  - Status states: Listening, Speaking, Sleeping, Ready

### Audio/Video Recording Features

#### Audio Recording (AudioOutputWidget.tsx)
- **Function**: `startRecording()`
  - Initiates MediaRecorder with WebM/Opus format
  - Starts recording timer
  - Sets recording state indicators
  
- **Function**: `stopRecording()`
  - Stops MediaRecorder
  - Triggers automatic download
  - Resets recording state

- **Function**: `downloadRecording(blob: Blob, filename: string)`
  - Creates download link
  - Auto-downloads recorded audio file
  - Filename includes timestamp

#### Video Recording (VideoStreamWidget.tsx)
- **Function**: `startRecording()`
  - Initiates MediaRecorder with WebM/VP9 format
  - Supports fallback codec selection
  - Starts recording timer
  - Updates UI state

- **Function**: `stopRecording()`
  - Stops video recording
  - Triggers automatic download
  - Resets recording indicators

- **Function**: `formatTime(seconds: number)`
  - Formats recording duration as MM:SS
  - Used in both audio and video widgets

### UI Enhancements
- Added recording buttons to both widgets
- Visual feedback with pulsing animations
- Compact view indicators
- Real-time recording timers
- Status bar updates

## 2024-01-30

### Terminal AI Agent Settings
- Multi-agent selection system
- Settings persistence with localStorage
- Synthesis framework for combining responses

### Dashboard Widgets
- Audio output widget with visualization
- Video stream widget with multiple sources
- Machine-specific audio/video configuration
- Responsive grid layout support