# Function Log

This document tracks major functionality additions and changes to the WIT frontend application.

## 2024-01-31

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