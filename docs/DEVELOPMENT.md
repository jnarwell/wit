# W.I.T. Development Guide

## Development Environment Setup

### Required Tools

- **Python 3.8+**: Backend development
- **Node.js 16+**: Frontend and UDC development
- **PostgreSQL 12+**: Database
- **Redis** (optional): Caching and session storage
- **Git**: Version control
- **VS Code** (recommended): IDE with extensions

### Recommended VS Code Extensions

- Python
- Pylance
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Thunder Client (API testing)
- GitLens

### Environment Setup

1. **Clone and setup**:
```bash
git clone https://github.com/yourusername/wit.git
cd wit
```

2. **Backend setup**:
```bash
cd software/backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements-dev.txt
pre-commit install
```

3. **Frontend setup**:
```bash
cd software/frontend/web
npm install
```

4. **Database setup**:
```bash
createdb wit_dev
cp .env.example .env
# Edit .env with your database credentials
alembic upgrade head
```

## Project Structure

### Backend Structure
```
software/backend/
├── api/                 # API endpoints
│   ├── auth_router.py   # Authentication
│   ├── equipment_api.py # Equipment management
│   └── projects_api.py  # Project management
├── core/                # Core business logic
│   ├── machine_manager.py
│   ├── machine_interface.py
│   └── connections/     # Connection handlers
├── services/            # Service layer
│   ├── ai_service.py    # AI integration
│   └── database_services.py
├── models/              # Database models
├── schemas/             # Pydantic schemas
├── tests/               # Test suite
└── dev_server.py        # Main application
```

### Frontend Structure
```
software/frontend/web/
├── src/
│   ├── components/      # Reusable components
│   ├── pages/           # Page components
│   ├── contexts/        # React contexts
│   ├── hooks/           # Custom hooks
│   ├── services/        # API services
│   ├── utils/           # Utilities
│   └── types/           # TypeScript types
├── public/              # Static assets
└── tests/               # Test files
```

## Development Workflow

### 1. Creating a New Feature

1. **Create feature branch**:
```bash
git checkout -b feature/your-feature-name
```

2. **Backend development**:
```python
# 1. Create new model (models/your_model.py)
class YourModel(Base):
    __tablename__ = "your_table"
    id = Column(Integer, primary_key=True)
    # ... fields

# 2. Create schema (schemas/your_schema.py)
class YourSchema(BaseModel):
    id: int
    # ... fields

# 3. Create API endpoint (api/your_api.py)
@router.get("/your-endpoint")
async def your_endpoint():
    # ... implementation

# 4. Register router in dev_server.py
app.include_router(your_router, prefix="/api/v1/your-route")
```

3. **Frontend development**:
```typescript
// 1. Create types (types/your-types.ts)
export interface YourType {
  id: number;
  // ... fields
}

// 2. Create API service (services/your-service.ts)
export const yourService = {
  async getItems(): Promise<YourType[]> {
    const response = await api.get('/your-endpoint');
    return response.data;
  }
};

// 3. Create component (components/YourComponent.tsx)
export const YourComponent: React.FC = () => {
  // ... implementation
};

// 4. Add to routing in App.tsx
```

### 2. Database Migrations

```bash
# Create new migration
alembic revision --autogenerate -m "Add your_table"

# Review generated migration
# Edit migrations/versions/xxx_add_your_table.py if needed

# Apply migration
alembic upgrade head

# Rollback if needed
alembic downgrade -1
```

### 3. Testing

#### Backend Testing
```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_your_feature.py

# Run with coverage
pytest --cov=. --cov-report=html

# Run specific test
pytest tests/test_your_feature.py::test_specific_function
```

#### Frontend Testing
```bash
# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

### 4. Code Style

#### Python (Backend)
```bash
# Format code
black .

# Sort imports
isort .

# Lint code
flake8

# Type checking
mypy .
```

#### TypeScript/JavaScript (Frontend)
```bash
# Format code
npm run format

# Lint code
npm run lint

# Fix lint issues
npm run lint:fix
```

## API Development

### Creating New Endpoints

1. **Define schema**:
```python
# schemas/printer_schema.py
from pydantic import BaseModel

class PrinterCreate(BaseModel):
    name: str
    type: str
    connection_type: str
    
class PrinterResponse(PrinterCreate):
    id: str
    status: dict
```

2. **Create endpoint**:
```python
# api/equipment_api.py
from fastapi import APIRouter, Depends
from typing import List

router = APIRouter()

@router.post("/printers", response_model=PrinterResponse)
async def create_printer(
    printer: PrinterCreate,
    current_user: User = Depends(get_current_user)
):
    # Implementation
    return printer_response

@router.get("/printers", response_model=List[PrinterResponse])
async def list_printers(
    current_user: User = Depends(get_current_user)
):
    # Implementation
    return printers
```

### WebSocket Implementation

```python
@app.websocket("/ws/updates")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Send updates
            await websocket.send_json({
                "type": "update",
                "data": {...}
            })
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        # Handle disconnect
        pass
```

## Frontend Development

### Component Guidelines

1. **Use functional components**:
```tsx
interface Props {
  title: string;
  onAction: () => void;
}

export const MyComponent: React.FC<Props> = ({ title, onAction }) => {
  return (
    <div className="industrial-component">
      <h2>{title}</h2>
      <button onClick={onAction}>Action</button>
    </div>
  );
};
```

2. **Use custom hooks**:
```tsx
// hooks/usePrinters.ts
export const usePrinters = () => {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    printerService.getAll()
      .then(setPrinters)
      .finally(() => setLoading(false));
  }, []);

  return { printers, loading };
};
```

3. **Industrial styling**:
```css
/* Use Tailwind classes */
.industrial-card {
  @apply border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)];
}

.industrial-button {
  @apply border-2 border-black bg-white px-4 py-2 font-bold uppercase hover:bg-gray-100 active:shadow-none active:translate-x-1 active:translate-y-1;
}
```

## UDC Plugin Development

See [PLUGINS.md](PLUGINS.md) for detailed plugin development guide.

## Debugging

### Backend Debugging

1. **VS Code launch.json**:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: FastAPI",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": ["dev_server:app", "--reload"],
      "jinja": true
    }
  ]
}
```

2. **Logging**:
```python
import logging
logger = logging.getLogger(__name__)

logger.debug("Debug message")
logger.info("Info message")
logger.error("Error message", exc_info=True)
```

### Frontend Debugging

1. **React Developer Tools**
2. **Redux DevTools** (if using Redux)
3. **Network tab for API calls**
4. **Console debugging**:
```typescript
console.log('[ComponentName]', 'Debug message', data);
```

## Performance Optimization

### Backend
- Use database indexes
- Implement caching with Redis
- Use async/await properly
- Optimize database queries
- Use connection pooling

### Frontend
- Lazy load components
- Memoize expensive computations
- Use React.memo for pure components
- Implement virtual scrolling for lists
- Optimize bundle size

## Security Best Practices

1. **Never commit secrets**
2. **Validate all inputs**
3. **Use parameterized queries**
4. **Implement rate limiting**
5. **Keep dependencies updated**
6. **Use HTTPS in production**
7. **Implement CORS properly**
8. **Sanitize user-generated content**

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment guide.

## Troubleshooting

### Common Issues

1. **Import errors**: Check virtual environment is activated
2. **Database errors**: Run migrations, check connection
3. **CORS errors**: Check CORS configuration
4. **WebSocket errors**: Check nginx/proxy configuration
5. **Build errors**: Clear cache, reinstall dependencies

### Getting Help

1. Check existing issues
2. Search in discussions
3. Ask on Discord
4. Create detailed bug report

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines.