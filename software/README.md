# W.I.T. Software Stack

High-level software components for the W.I.T. Terminal ecosystem.

## Components
- **Backend**: RESTful API, WebSocket services, MQTT broker
- **Frontend**: Web dashboard, system configuration UI
- **Mobile**: iOS/Android companion apps
- **AI**: Voice and vision processing pipelines
- **Integrations**: Equipment-specific adapters

## Tech Stack
- **Backend**: Python (FastAPI), Node.js services
- **Frontend**: React, TypeScript, Tailwind CSS
- **Mobile**: React Native
- **AI**: PyTorch, ONNX Runtime
- **Database**: PostgreSQL, TimescaleDB, Redis

## Quick Start
```bash
# Start all services
docker-compose up -d

# Run development servers
cd backend && python -m uvicorn main:app --reload
cd frontend && npm run dev
```

## API Documentation
API docs available at `http://localhost:8000/docs` when running locally.
