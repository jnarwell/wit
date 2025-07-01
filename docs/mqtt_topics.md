# W.I.T. MQTT Topic Structure

## Topic Naming Convention
All topics follow the pattern: `wit/{category}/{subcategory}/{identifier}`

## Core Topic Categories

### 1. System Topics
- `wit/system/status` - System-wide status updates
- `wit/system/heartbeat` - Component heartbeat messages
- `wit/system/alerts/{level}` - System alerts (info/warning/critical/emergency)
- `wit/system/logs/{component}` - Component logs

### 2. Equipment Topics
- `wit/equipment/{equipment_id}/status` - Equipment online/offline status
- `wit/equipment/{equipment_id}/telemetry` - Real-time telemetry data
- `wit/equipment/{equipment_id}/command` - Commands to equipment
- `wit/equipment/{equipment_id}/response` - Command responses
- `wit/equipment/{equipment_id}/events` - Equipment events

### 3. Job Topics
- `wit/jobs/{job_id}/status` - Job status updates
- `wit/jobs/{job_id}/progress` - Progress updates
- `wit/jobs/{job_id}/telemetry` - Job-specific telemetry
- `wit/jobs/queue` - Job queue updates

### 4. Safety Topics
- `wit/safety/alerts` - Safety alerts
- `wit/safety/zones/{zone_id}/status` - Zone status
- `wit/safety/emergency` - Emergency stop signals
- `wit/safety/sensors/{sensor_id}` - Safety sensor data

### 5. Voice/Command Topics
- `wit/voice/commands` - Voice commands
- `wit/voice/responses` - Voice responses
- `wit/voice/status` - Voice system status

### 6. Vision Topics
- `wit/vision/detections` - Object detections
- `wit/vision/alerts` - Vision-based alerts
- `wit/vision/streams/{camera_id}` - Stream status

### 7. User Interface Topics
- `wit/ui/notifications` - UI notifications
- `wit/ui/updates` - UI state updates
- `wit/ui/requests` - UI requests

## Message Formats

All messages use JSON format with standard fields:
```json
{
  "timestamp": "2024-01-20T15:30:00Z",
  "source": "component_id",
  "correlation_id": "unique_id",
  "data": {
    // Message-specific data
  }
}
```

## QoS Levels
- QoS 0: Telemetry, logs (fire-and-forget)
- QoS 1: Status updates, notifications (at least once)
- QoS 2: Commands, safety alerts (exactly once)

## Retained Messages
The following topics use retained messages:
- Equipment status
- System status
- Safety alerts
- Current job status
