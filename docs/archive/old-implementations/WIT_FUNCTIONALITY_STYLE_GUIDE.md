# W.I.T. (Workshop Integrated Terminal) - Functionality & Style Guide

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Authentication & User Management](#authentication--user-management)
4. [Navigation & Routing](#navigation--routing)
5. [Dashboard System](#dashboard-system)
6. [Core Pages](#core-pages)
7. [Widget System](#widget-system)
8. [AI Terminal (W.I.T.)](#ai-terminal-wit)
9. [File Management](#file-management)
10. [API Endpoints](#api-endpoints)
11. [Design System](#design-system)
12. [Component Library](#component-library)
13. [Technical Stack](#technical-stack)

---

## System Overview

W.I.T. (Workshop Integrated Terminal) is a comprehensive workshop management system that combines real-time monitoring, project management, and AI-powered assistance into a unified platform. The system features a dark-themed, terminal-inspired interface with advanced visualization capabilities.

### Core Principles
- **Real-time Monitoring**: Live updates for machines, sensors, and projects
- **AI-First Interaction**: Natural language commands through the W.I.T. terminal
- **Modular Architecture**: Widget-based dashboard with drag-and-drop functionality
- **Professional Aesthetics**: Dark theme with terminal-inspired design elements

---

## Architecture

### Frontend Structure
```
software/frontend/web/
├── src/
│   ├── components/        # Reusable components
│   │   ├── widgets/      # Dashboard widgets
│   │   ├── Navigation.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Terminal.tsx
│   │   └── ...
│   ├── pages/            # Full page components
│   │   ├── HomePage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── MachinesPage.tsx
│   │   └── ...
│   ├── contexts/         # React contexts
│   │   └── AuthContext.tsx
│   ├── services/         # API services
│   └── App.tsx          # Main app component
```

### Backend Structure
```
software/backend/
├── app/
│   ├── api/             # API endpoints
│   │   └── v1/         # Version 1 endpoints
│   ├── core/           # Core functionality
│   ├── models/         # Data models
│   ├── services/       # Business logic
│   └── main.py        # FastAPI application
```

---

## Authentication & User Management

### Features
1. **Local Authentication**
   - Email/password registration with verification
   - Secure login with JWT tokens
   - Password strength requirements
   - Remember me functionality

2. **OAuth Integration**
   - Google OAuth 2.0 support
   - Automatic account creation
   - Pre-verified OAuth accounts

3. **User Roles**
   - Admin: Full system access
   - Operator: Standard user access
   - Role-based UI elements

### Pages
- **LoginPage**: Modern split-screen design with gradient background
- **SignupPage**: Comprehensive registration with real-time validation
- **EmailVerificationPage**: Token-based email confirmation

---

## Navigation & Routing

### Main Navigation Bar
- **Dashboard**: Home view with customizable widgets
- **Machines**: Equipment management
- **Projects**: Project tracking and management
- **Sensors**: Sensor monitoring
- **Software**: Software integrations (new)
- **W.I.T.**: AI terminal interface

### User Menu (Top Right)
- User profile display
- Account settings
- Admin panel (admin only)
- Sign out

### Routing Structure
```typescript
/ - HomePage (terminal landing)
/login - LoginPage
/signup - SignupPage
/verify-email - EmailVerificationPage
/dashboard - Dashboard (protected)
/machines - MachinesPage (protected)
/projects - ProjectsPage (protected)
/sensors - SensorsPage (protected)
/software - SoftwareIntegrationsPage (protected)
/wit - Terminal (protected)
/settings - SettingsPage (protected)
/about - AboutPage
```

---

## Dashboard System

### Grid System
- **Configurable Grid**: 3x3 default, adjustable from 1x1 to 5x5
- **Drag & Drop**: Click and hold to move widgets
- **Resize**: Drag widget edges to resize (1x1 to full grid)
- **Persistence**: Layout saved to localStorage
- **Collision Detection**: Prevents widget overlap

### Widget Categories
1. **Lists**: Projects, Machines, Sensors, Tasks
2. **Utilities**: System monitors, specialized displays
3. **Special**: W.I.T. Assistant, File Explorer, File Viewer

---

## Core Pages

### 1. HomePage
- **Terminal-style landing page**
- ASCII art W.I.T. logo
- Three navigation options (keyboard or mouse):
  - [1] Sign In
  - [2] Sign Up
  - [3] Learn More
- 4x responsive text scaling
- Green-on-black terminal aesthetic

### 2. MachinesPage
- **Grid layout** with status indicators
- Real-time status updates (WebSocket)
- Status lights: Running (green), Idle (gray), Maintenance (yellow), Error (red)
- Efficiency progress bars
- Click to navigate to detail view
- Add/Edit/Delete functionality

### 3. ProjectsPage
- **Card-based layout** with visual status
- Priority badges (High/Medium/Low)
- Status indicators (Not Started/In Progress/Blocked/Complete)
- Progress bars (placeholder for task-based calculation)
- Team assignment display
- Sidebar filters and controls

### 4. SensorsPage
- **Real-time sensor monitoring**
- Visual status indicators
- Type categorization (Temperature, Pressure, Humidity, etc.)
- Current value display
- Location mapping
- Grid layout with pagination

### 5. SoftwareIntegrationsPage (New)
- **38 predefined software tools** across 6 categories
- **Category tabs**: CAD & Design, Simulation & Analysis, Embedded, PCB, Data Acquisition, Manufacturing
- Grid layout (4x3) with pagination
- "Coming Soon" badges for future integrations
- Modal for adding custom integrations
- Status indicators (Connected/Disconnected/Error/Pending)

### 6. ProjectDetailPage
- **Tabbed interface**:
  - Overview: Summary, progress, stats
  - Tasks: Full CRUD with inline editing
  - Team: Member management
  - Files: Integrated file browser
  - Settings: Project configuration
- Task filtering by status
- Real-time updates
- Activity feed

---

## Widget System

### List Widgets

#### 1. ProjectsListWidget
- Compact project listing
- Status indicators
- Priority badges
- Click to navigate
- Pagination support

#### 2. MachinesListWidget
- Machine status overview
- Efficiency metrics
- Runtime display
- Status filtering

#### 3. SensorsListWidget
- Sensor value monitoring
- Type categorization
- Alert indicators
- Location display

#### 4. TasksListWidget
- Incomplete tasks sorted by due date
- Visual indicators:
  - Overdue (red)
  - Due today (orange)
  - Due soon (yellow)
- Project association
- Priority display

### Utility Widgets

#### 1. CPU Usage
- Real-time CPU monitoring
- Percentage display
- Trend indicator
- Progress bar visualization

#### 2. Memory (RAM)
- Memory usage tracking
- Available/Used display
- Color-coded status
- Historical trend

#### 3. Disk Space
- Storage monitoring
- Free/Used space
- Multiple drive support
- Warning thresholds

#### 4. Network
- Bandwidth monitoring
- Upload/Download speeds
- Connection status
- Data usage tracking

#### 5. Temperature
- System temperature monitoring
- Warning levels
- Multiple sensor support
- Celsius display

### Specialized Widgets (New)

#### 1. MachineStatusWidget
- **Real-time machine monitoring**
- Status: Running/Idle/Maintenance/Error
- Efficiency metrics (when running)
- Runtime tracking
- Last update timestamp
- Machine selector or specific display

#### 2. SensorDataWidget
- **Live sensor visualization**
- Types: Temperature, Pressure, Flow, Voltage
- Real-time chart (Chart.js)
- Current value with units
- 20-point history
- Trend analysis

#### 3. ProjectProgressWidget
- **Project completion tracking**
- Progress percentage
- Task breakdown (pie chart)
- Deadline countdown
- Status distribution
- Recent activity (large view)

#### 4. ScriptResultsWidget
- **Custom script execution**
- Auto-refresh (configurable)
- Multiple output formats:
  - JSON data
  - Analysis results
  - System metrics
  - Error traces
- Execution history
- Status indicators

#### 5. CustomGraphWidget
- **Fully configurable visualization**
- 7 chart types:
  - Line Chart
  - Bar Chart
  - Area Chart
  - Pie Chart
  - Doughnut Chart
  - Radar Chart
  - Numeric Display
- Settings panel:
  - Data source selection
  - 5 color schemes
  - 3-20 data points
  - 1-60s refresh interval
  - Legend/grid toggles
- Numeric mode for KPIs

### Special Widgets

#### 1. WITsWidget
- Embedded AI assistant
- Natural language input
- Command history
- Contextual responses

#### 2. FileExplorerWidget
- Directory tree navigation
- File operations
- Drag & drop support
- Context menus

#### 3. FileViewerWidget
- Syntax highlighting
- Image preview
- PDF rendering
- Text editing

---

## AI Terminal (W.I.T.)

### Features
- **Natural language processing**
- **Multi-domain commands**
- **Context awareness**
- **Real-time execution**
- **Rich responses** with tables and formatting

### Command Categories

#### File Operations
```
- List files: "show files", "list directory"
- Read files: "read config.json", "show contents of README"
- Create files: "create test.py", "make new file data.csv"
- Write content: "write 'Hello' to test.txt"
- Delete files: "delete temp.log", "remove old files"
```

#### System Information
```
- Status: "system status", "check health"
- Users: "list users", "who is online"
- Stats: "show statistics", "performance metrics"
```

#### Project Management
```
- List: "show all projects", "list my projects"
- Create: "create project 'New Robot'"
- Update: "update project status to complete"
- Delete: "delete project PROJ-001"
```

#### Task Management
```
- List: "show tasks for project X"
- Create: "add task 'Review code' due tomorrow"
- Update: "mark task as complete"
- Filter: "show overdue tasks"
```

#### Equipment & Sensors
```
- Status: "check all machines"
- Sensors: "show temperature sensors"
- Alerts: "any equipment errors?"
```

---

## File Management

### Storage Structure
```
wit_storage/
├── projects/
│   ├── {project_id}/
│   └── shared/
├── users/
│   ├── {username}/
│   └── shared/
└── system/
```

### Features
- **Hierarchical organization**
- **Project-based isolation**
- **User workspaces**
- **Shared directories**
- **File versioning** (planned)

---

## API Endpoints

### Authentication
- `POST /api/v1/auth/signup` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/verify-email` - Email verification
- `GET /api/v1/auth/google` - Google OAuth
- `GET /api/v1/auth/me` - Current user

### Resources
- `/api/v1/projects` - Project CRUD
- `/api/v1/machines` - Machine management
- `/api/v1/sensors` - Sensor data
- `/api/v1/tasks` - Task management
- `/api/v1/teams` - Team operations
- `/api/v1/files` - File operations

### WebSocket
- `/ws` - Real-time updates for machines, sensors

---

## Design System

### Color Palette

#### Primary Colors
- **Background**: `#0a0a0a` (near black)
- **Surface**: `#1a1a1a` (dark gray)
- **Border**: `#333333` (gray)
- **Text Primary**: `#f0f0f0` (off-white)
- **Text Secondary**: `#888888` (gray)

#### Status Colors
- **Success**: `#10B981` (green)
- **Error**: `#EF4444` (red)
- **Warning**: `#F59E0B` (amber)
- **Info**: `#3B82F6` (blue)

#### Gradient Accents
- **Blue**: `from-blue-600 to-blue-700`
- **Purple**: `from-purple-600 to-purple-700`
- **Green**: `from-green-600 to-green-700`
- **Indigo**: `from-indigo-600 to-indigo-700`

### Typography
- **Font Family**: System fonts with monospace for terminal
- **Headings**: 
  - H1: 24px (2xl)
  - H2: 20px (xl)
  - H3: 16px (base)
- **Body**: 14px (sm)
- **Small**: 12px (xs)

### Spacing
- **Base unit**: 4px
- **Common spacings**: 8px, 16px, 24px, 32px
- **Container padding**: 24px (6 units)

### Components

#### Buttons
```css
/* Primary */
.btn-primary {
  @apply bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors;
}

/* Secondary */
.btn-secondary {
  @apply bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors;
}

/* Danger */
.btn-danger {
  @apply bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors;
}
```

#### Cards
```css
.card {
  @apply bg-gray-800 rounded-lg shadow-lg border border-gray-700 hover:border-gray-600 transition-all;
}
```

#### Forms
```css
.input {
  @apply w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none;
}
```

### Animations
- **Transitions**: 200ms ease-in-out
- **Hover effects**: Scale, shadow, border color
- **Loading states**: Pulse, spin animations
- **Drag & drop**: Opacity and shadow changes

---

## Component Library

### Layout Components
- **Navigation**: Top navigation bar with user menu
- **Sidebar**: Collapsible sidebar for settings/filters
- **Grid**: Responsive grid system
- **Modal**: Overlay dialogs

### Data Display
- **Table**: Sortable, filterable data tables
- **Card**: Information cards with actions
- **Badge**: Status and priority indicators
- **Progress**: Linear and circular progress

### Input Components
- **TextField**: Text input with validation
- **Select**: Dropdown selection
- **Checkbox**: Binary choices
- **Switch**: Toggle switches
- **DatePicker**: Date selection

### Feedback
- **Alert**: Success/error/warning messages
- **Toast**: Temporary notifications
- **Loading**: Spinners and skeletons
- **Empty**: Empty state displays

### Visualization
- **Charts**: Line, bar, pie, doughnut, area
- **Gauges**: Circular progress indicators
- **Sparklines**: Mini trend charts
- **Heatmaps**: Data density visualization

---

## Technical Stack

### Frontend
- **React 19.1**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool
- **Tailwind CSS**: Utility-first styling
- **React Router v7**: Client-side routing
- **Chart.js**: Data visualization
- **React Icons**: Icon library
- **Axios**: HTTP client

### Backend
- **FastAPI**: Modern Python web framework
- **SQLAlchemy**: ORM
- **PostgreSQL**: Database
- **Redis**: Caching and sessions
- **WebSockets**: Real-time communication
- **JWT**: Authentication tokens

### Development Tools
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Git**: Version control
- **GitHub Actions**: CI/CD
- **Docker**: Containerization

### Deployment
- **Frontend**: Static hosting (Vercel/Netlify)
- **Backend**: Cloud VPS/Container service
- **Database**: Managed PostgreSQL
- **File Storage**: Object storage (S3-compatible)

---

## Best Practices

### Code Organization
1. **Component Structure**: One component per file
2. **Naming**: PascalCase for components, camelCase for functions
3. **Imports**: Grouped by type (React, components, utils)
4. **Props**: Interface definitions for all components

### State Management
1. **Local State**: useState for component state
2. **Context**: AuthContext for global auth
3. **URL State**: Query params for filters
4. **Storage**: localStorage for persistence

### Performance
1. **Code Splitting**: Lazy load large components
2. **Memoization**: useMemo for expensive calculations
3. **Virtualization**: For long lists
4. **Debouncing**: For search and filters

### Security
1. **Authentication**: JWT with refresh tokens
2. **Authorization**: Role-based access control
3. **Input Validation**: Client and server-side
4. **XSS Prevention**: Sanitize user content
5. **HTTPS**: Enforce secure connections

---

## Future Enhancements

### Planned Features
1. **Real-time Collaboration**: Multi-user project editing
2. **Advanced Analytics**: Machine learning insights
3. **Mobile App**: Native iOS/Android apps
4. **Voice Control**: Audio command interface
5. **AR Integration**: Augmented reality overlays
6. **Blockchain**: Supply chain tracking
7. **IoT Hub**: Direct device integration
8. **API Marketplace**: Third-party integrations

### Technical Improvements
1. **GraphQL API**: More flexible data fetching
2. **Microservices**: Service-oriented architecture
3. **Event Sourcing**: Complete audit trail
4. **Edge Computing**: Local processing nodes
5. **AI Model Training**: Custom model development

---

*Document Version: 1.0*  
*Last Updated: 2025-07-31*  
*W.I.T. - Workshop Integrated Terminal*