# W.I.T. API Reference

## Overview

The W.I.T. API is a RESTful API with WebSocket support for real-time communication. All endpoints are prefixed with `/api/v1/` unless otherwise specified.

Base URL: `http://localhost:8000`

## Authentication

W.I.T. uses JWT (JSON Web Token) based authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Authentication Endpoints

#### Register New User
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "string",
  "email": "user@example.com",
  "password": "string",
  "full_name": "string" (optional)
}
```

#### Login
```http
POST /api/v1/auth/token
Content-Type: application/x-www-form-urlencoded

username=user@example.com&password=yourpassword
```

Alternative JSON login:
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "yourpassword"
}
```

Response:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer"
}
```

#### Get Current User
```http
GET /api/v1/auth/me
Authorization: Bearer <token>
```

## Equipment Management

### Printers

#### List All Printers
```http
GET /api/v1/equipment/printers
Authorization: Bearer <token>
```

Response:
```json
[
  {
    "printer_id": "string",
    "name": "string",
    "type": "string",
    "connection_type": "string",
    "status": {
      "state": "idle|printing|paused|error",
      "temperature": {
        "bed": {"actual": 0, "target": 0},
        "tool0": {"actual": 0, "target": 0}
      },
      "progress": 0,
      "time_remaining": 0
    }
  }
]
```

#### Add Printer
```http
POST /api/v1/equipment/printers
Authorization: Bearer <token>
Content-Type: application/json

{
  "printer_id": "string",
  "name": "string",
  "type": "prusaconnect|prusalink|octoprint|serial",
  "connection_type": "network|serial",
  "ip_address": "string" (for network printers),
  "api_key": "string" (for API-based printers),
  "port": "string" (for serial printers),
  "baudrate": 115200 (for serial printers)
}
```

#### Get Printer Status
```http
GET /api/v1/equipment/printers/{printer_id}
Authorization: Bearer <token>
```

#### Delete Printer
```http
DELETE /api/v1/equipment/printers/{printer_id}
Authorization: Bearer <token>
```

#### Send Printer Command
```http
POST /api/v1/equipment/printers/{printer_id}/commands
Authorization: Bearer <token>
Content-Type: application/json

{
  "command": "string",
  "parameters": {} (optional)
}
```

Supported commands:
- `home` - Home all axes
- `move` - Move to position `{"x": 0, "y": 0, "z": 0}`
- `temperature` - Set temperature `{"bed": 60, "tool0": 200}`
- `pause` - Pause current print
- `resume` - Resume paused print
- `cancel` - Cancel current print

#### Set Temperature
```http
POST /api/v1/equipment/printers/{printer_id}/temperature
Authorization: Bearer <token>
Content-Type: application/json

{
  "bed": 60,
  "tool0": 200
}
```

#### Discover Printers
```http
GET /api/v1/equipment/printers/discover
Authorization: Bearer <token>
```

#### Test Printer Connection
```http
POST /api/v1/equipment/printers/test
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "prusaconnect|prusalink|octoprint",
  "ip_address": "string",
  "api_key": "string"
}
```

## Project Management

#### List Projects
```http
GET /api/v1/projects/
Authorization: Bearer <token>
```

#### Create Project
```http
POST /api/v1/projects/
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "string",
  "description": "string",
  "status": "planning|active|completed|on-hold",
  "priority": "low|medium|high",
  "tags": ["string"],
  "metadata": {}
}
```

#### Get Project
```http
GET /api/v1/projects/{project_id}
Authorization: Bearer <token>
```

#### Update Project
```http
PUT /api/v1/projects/{project_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "string",
  "description": "string",
  "status": "string",
  "priority": "string"
}
```

#### Delete Project
```http
DELETE /api/v1/projects/{project_id}
Authorization: Bearer <token>
```

### Tasks

#### Get Project Tasks
```http
GET /api/v1/projects/{project_id}/tasks
Authorization: Bearer <token>
```

#### Create Task
```http
POST /api/v1/projects/{project_id}/tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "string",
  "description": "string",
  "status": "todo|in-progress|done",
  "priority": "low|medium|high",
  "assigned_to": "user_id" (optional),
  "due_date": "2025-01-20T00:00:00" (optional)
}
```

#### Update Task
```http
PUT /api/v1/tasks/{task_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "string",
  "status": "string",
  "priority": "string"
}
```

#### Delete Task
```http
DELETE /api/v1/tasks/{task_id}
Authorization: Bearer <token>
```

## Desktop Controller

#### Launch Arduino IDE
```http
POST /api/v1/desktop-controller/arduino/launch
Authorization: Bearer <token>
```

#### Get Arduino Sketches
```http
GET /api/v1/desktop-controller/arduino/sketches
Authorization: Bearer <token>
```

## System

#### Get Serial Ports
```http
GET /api/v1/microcontrollers/ports
Authorization: Bearer <token>
```

Response:
```json
[
  {
    "port": "/dev/ttyUSB0",
    "description": "USB Serial Device",
    "manufacturer": "Arduino"
  }
]
```

## WebSocket Endpoints

### Printer Updates
```
ws://localhost:8000/ws/printers
```

Receives real-time updates for all printers:
```json
{
  "type": "printer_update",
  "printer_id": "string",
  "data": {
    "status": {},
    "temperature": {},
    "progress": 0
  }
}
```

### Printer-Specific Updates
```
ws://localhost:8000/ws/printers/{printer_id}
```

### Desktop Controller
```
ws://localhost:8000/ws/desktop-controller
```

For UDC plugin communication:
```json
{
  "type": "plugin_command",
  "plugin": "arduino-ide",
  "command": "launch",
  "args": {}
}
```

### Printer Bridge
```
ws://localhost:8000/ws/printer-bridge/{printer_id}
```

For G-code bridge connections.

## Error Responses

All API errors follow this format:
```json
{
  "detail": "Error message"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

## Rate Limiting

Currently no rate limiting is implemented. In production:
- Authenticated requests: 1000/hour
- Unauthenticated requests: 100/hour
- WebSocket connections: 10 concurrent per user

## CORS

In development, CORS is configured to allow:
- Origins: `http://localhost:*`
- Methods: All
- Headers: All
- Credentials: Yes

## API Versioning

The API uses URL versioning. Current version: `v1`

Future versions will be available at `/api/v2/`, etc.

## Pagination

List endpoints support pagination:
```
GET /api/v1/projects/?page=1&limit=20
```

Response includes pagination metadata:
```json
{
  "items": [],
  "total": 100,
  "page": 1,
  "pages": 5,
  "limit": 20
}
```

## Filtering and Sorting

Some endpoints support filtering and sorting:
```
GET /api/v1/projects/?status=active&sort=created_at:desc
```

## Webhooks

Webhook support is planned but not yet implemented.

## SDK Support

Official SDKs are planned for:
- Python
- JavaScript/TypeScript
- Go

## API Playground

When running in development, interactive API documentation is available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`