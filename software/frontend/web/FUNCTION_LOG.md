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