# Changelog

## [Unreleased] - 2025-07-31

### Added - Software Integrations & Dashboard Widgets
- **Software Integrations Page**: New page for managing external software connections
  - Grid layout with filtering by status and type
  - Category tabs for organized browsing (CAD, Simulation, Embedded, PCB, Data Acquisition, Manufacturing)
  - Predefined software catalog with 38 industry-standard tools:
    - CAD & Design: SolidWorks, Fusion 360, OnShape, AutoCAD, Inventor, Creo, CATIA, Rhino 3D, FreeCAD
    - Simulation & Analysis: ANSYS, COMSOL, Abaqus, NASTRAN, Simulink, Adams, LS-DYNA
    - Programming & Embedded: Arduino IDE, PlatformIO, MPLAB X, Keil, Code Composer Studio, STM32CubeIDE
    - PCB & Electronics: Altium Designer, KiCad, Eagle, Proteus, LTspice, Multisim
    - Data Acquisition: DEWESoft, LabVIEW, MATLAB, dSPACE, HBM nCode
    - Manufacturing & CAM: Mastercam, PowerMill, HSMWorks, EdgeCAM, NX CAM
  - "Coming Soon" badges for future integrations
  - Modal dialog for adding custom integrations
  - Responsive 4-column grid layout with pagination

- **Enhanced Dashboard Utility Widgets**: Five new specialized widgets for monitoring and analysis
  - **Machine Status Widget**: Real-time machine monitoring
    - Running/idle/maintenance/error status indicators
    - Efficiency metrics and runtime tracking
    - Machine selector dropdown or specific machine display
    - Visual status indicators with color coding
  
  - **Sensor Data Widget**: Live sensor visualization
    - Support for temperature, pressure, flow rate, and voltage sensors
    - Real-time chart with historical data (using Chart.js)
    - Current value display with appropriate units
    - Trend analysis and averages for larger widgets
  
  - **Project Progress Widget**: Project tracking and visualization
    - Progress percentage with deadline tracking
    - Task breakdown showing completed/in-progress/pending/blocked
    - Doughnut chart visualization for task distribution
    - Color-coded status indicators
  
  - **Script Results Widget**: Custom script execution display
    - Auto-refresh capability with configurable intervals
    - Simulated outputs for sensor data, system status, analysis results
    - Execution history tracking for larger widgets
    - Success/error status indicators with execution time
  
  - **Custom Graph Widget**: Highly configurable data visualization
    - 7 chart types: Line, Bar, Area, Pie, Doughnut, Radar, Numeric Display
    - Settings panel with full customization:
      - Data source selection (Random, Sensor, System, API, Manual)
      - 5 color schemes (Default, Blue, Green, Purple, Orange)
      - Adjustable data points (3-20)
      - Auto-refresh interval (1-60 seconds)
      - Legend and grid toggles
    - Numeric display mode for KPIs and counts
    - Responsive design adapting to widget size

## [Unreleased] - 2025-07-31

### Added
- **Enhanced Signup Page**: Complete user registration experience with advanced features
  - Comprehensive form validation with real-time feedback
  - Password strength indicator with visual meter and requirements checklist
  - Show/hide password toggle for both password fields
  - Google OAuth integration for one-click signup
  - Email verification flow with success confirmation page
  - Responsive design matching the login page aesthetic
- **Email Verification System**: Backend implementation for secure user registration
  - POST `/api/v1/auth/signup` endpoint for new user registration
  - Email verification token generation and storage
  - GET `/api/v1/auth/verify-email` endpoint for email confirmation
  - POST `/api/v1/auth/resend-verification` for resending verification emails
  - Users remain inactive until email is verified
- **Google OAuth Integration**: Seamless social authentication
  - GET `/api/v1/auth/google` endpoint for OAuth redirect
  - GET `/api/v1/auth/google/callback` for handling OAuth response
  - Automatic user creation for new Google users
  - Pre-verified accounts for Google users
  - Frontend integration with token handling
- **Tasks List Dashboard Widget**: New widget displaying incomplete tasks sorted by due date
  - Shows task title, project name, status, priority, and due date
  - Visual indicators for overdue tasks (red), due today (orange), and due soon (yellow)
  - Integrates with the tasks API endpoint `/api/v1/tasks/incomplete`
  - Falls back gracefully when no tasks exist
- **Robust Project Detail Page**: Complete redesign with tabbed interface
  - **Overview Tab**: Project summary, progress visualization, quick stats, and activity feed placeholder
  - **Tasks Tab**: Dedicated task management with full CRUD operations
    - Click-to-edit tasks with modal dialog
    - Working filter buttons (All, Not Started, In Progress, Blocked, Complete)
    - Visual status indicators with colored borders
    - Quick status updates via dropdown
    - Task deletion with confirmation
  - **Team Tab**: Team member management interface
  - **Files Tab**: Integrated project file browser
  - **Settings Tab**: Placeholder for future project settings
- **Comprehensive AI Command System**: Extended WIT AI capabilities with natural language commands
  - **Project Management**: list, create, update, and delete projects
  - **Task Management**: list, create, update, and delete tasks with due dates
  - **Team Management**: list team members and add users to projects with roles
  - **File Operations**: Enhanced existing file commands
  - **Equipment Management**: list all equipment and check status
  - Created detailed command documentation in `/docs/WIT_AI_COMMANDS.md`
- **Homepage Terminal Interface**: Added landing page with terminal-style navigation
  - Large terminal display with "Hello WIT" greeting and ASCII art logo
  - Three navigation options: Sign In, Sign Up, and Learn More
  - Full keyboard support (number keys 1-3, arrow keys, Enter) and mouse interaction
  - 4x text size with responsive scaling for different screen sizes
  - Auto-redirect to dashboard for authenticated users
  - Consistent design matching existing terminal component
- **About Page**: Created informational page about W.I.T. features
  - Lists current features and upcoming additions
  - Responsive design with proper overflow handling
  - Consistent dark theme matching the application
- **Settings Page Enhancement**: Improved external connections interface
  - Added collapsible category sections (Project Management, File Management, Development, Cloud)
  - Added new AI connections tab featuring Anthropic, OpenAI, Gemini, and DeepSeek
  - Fixed icon import error (replaced non-existent FiBrain with FaBrain)
  - Responsive design improvements for better mobile experience
- **Backend File Management System**: Complete overhaul of file operations
  - Added GET `/content` endpoint for file viewing with Query parameters
  - Added GET `/project/{project_id}` endpoint for project-specific files
  - Added WebSocket endpoints for real-time file updates (`/ws/project/{project_id}`, `/ws/files`)
  - Fixed file paths to not include "default_user" prefix for cleaner URLs
  - Updated all file operation endpoints to accept `base_dir` and `project_id` parameters
  - Fixed path handling to prevent duplication issues
  - Implemented proper file creation with actual disk writes

### Fixed
- **Task Creation Backend**: Fixed missing `due_date` field assignment in task creation endpoint
- **Development Server Enhancements**: Major fixes to dev_server.py for full functionality
  - Added missing `projects_db` and `tasks_db` storage definitions
  - Fixed project endpoints to handle both UUID and project_id formats (e.g., PROJ-0001)
  - Fixed task endpoints to use correct field names (`name` instead of `title`, `assigned_to` instead of `assignee`)
  - Added PATCH endpoint for tasks
  - Fixed project and task deletion to work with both ID formats
  - Fixed `get_project_tasks` to properly match projects by either ID format
- **Admin Panel Integration**: Fixed user management persistence
  - User creation now properly persists to dev_server's `users_db`
  - User deletion removes users from authentication system
  - User listing shows real users from `users_db` instead of mock data
  - Admin statistics reflect actual user counts
- **File Operations**: Implemented real filesystem operations
  - Replaced mock file storage with actual filesystem using pathlib
  - Files stored in `./wit_storage/users/` and `./wit_storage/projects/`
  - Full CRUD operations for files and folders
  - File upload with proper path handling
- **Frontend Compatibility**: Fixed API response formats
  - FileBrowser now receives proper array format preventing "nodes.map is not a function" error
  - Added empty `/api/v1/accounts/linked` endpoint to prevent login redirects
  - Fixed OAuth client_id error by adding environment variable loading
- **SQLAlchemy Duplicate Model Issue**: Fixed "Multiple classes found for path 'SensorReading'" error
  - Identified conflicting model definitions in `models/microcontroller.py`
  - Created fix script to comment out duplicate model imports
  - Prevents model registration conflicts in declarative base
- **Task Status Mismatch**: Aligned frontend and backend task status values (not_started, in_progress, blocked, complete, cancelled)
- **Tasks Widget Error**: Fixed TypeError when rendering tasks with undefined status values
- **File Management Path Issues**: Resolved multiple backend file operation errors
  - Fixed 422 errors on file creation by updating request models
  - Fixed 404 errors on file operations by handling path prefixes correctly
  - Fixed rename operation to use `old_path` field instead of `path`
  - Fixed file upload form field handling
  - Resolved path duplication issue ("default_user/default_user")
- **CSS Class Conflicts**: Fixed terminal page file explorer positioning
  - Renamed HomePage terminal classes to avoid conflicts with existing Terminal component
  - File explorer now correctly appears on the right side of the terminal page

### Changed
- **Task Model**: Added `due_date` field to the Task SQLAlchemy model
- **ProjectDetailPage**: Replaced the existing page with `ProjectDetailPageTabbed` for better organization
- **AI Tools**: Expanded `ai_tools.py` with 11 new command functions and their tool definitions
- **AuthContext**: Added `setToken` method to support OAuth token handling
- **Login Flow**: Updated to redirect `/create-user` link to new `/signup` page

## [Unreleased] - 2025-07-25 (Night)

### Added
- **Enhanced Project Management**: Complete overhaul of project display with rich interactive features
  - Editable status lights (Not Started/In Progress/Blocked/Complete) with color-coded indicators
  - Editable priority tags (Low/Medium/High) with click-to-change functionality
  - Real-time updates via PATCH endpoints for status and priority changes
  - Visual progress bars (placeholder for task-based calculation)
  - Grid layout controls with adjustable columns
- **Advanced Filtering & Sorting**: 
  - Filter projects by status and priority
  - Sort by date created, last updated, name, priority, or status
  - Responsive grid layout that adapts to selected column count
- **Database Schema Updates**:
  - Added `priority` field to projects and tasks tables
  - Updated `status` field with new values: not_started, in_progress, blocked, complete
  - Added `updated_at` timestamps with automatic updates

### Changed
- **Project Display**: Replaced generic SpecificWidget with custom project cards showing:
  - Interactive status light with hover dropdown
  - Priority badge with click-to-edit functionality
  - Team information and project type
  - Progress indicator (to be calculated from tasks)
- **API Enhancements**:
  - Added PATCH endpoints for partial updates to projects and tasks
  - Updated schemas to include new status and priority fields

## [Unreleased] - 2025-07-25 (Evening)

### Added
- **Microcontroller Support**: Comprehensive backend infrastructure for Arduino, ESP32, and Raspberry Pi
  - Database models for microcontrollers, sensor readings, and device logs
  - API endpoints for device management, connection control, and data retrieval
  - Serial, network (TCP/UDP/HTTP), and MQTT connection support
  - Real-time WebSocket support for streaming sensor data
  - Automatic connection parameter detection based on device type
- **Machines Page Enhancements**: 
  - Added microcontroller types (Arduino Uno/Mega/Nano, ESP32/8266, Raspberry Pi)
  - Serial port scanning functionality for automatic device detection
  - Baud rate configuration for serial connections
  - Grouped machine types in dropdown (Workshop Equipment vs Microcontrollers)
  - Microcontroller-specific icon display

### Fixed
- **Authentication Headers**: Fixed missing `getAuthHeaders` function causing connection test and delete failures
- **WebSocket URL**: Corrected printer WebSocket endpoint path to match backend routing
- **Machine Deletion**: Fixed 404 errors by properly including backend equipment API router for printer endpoints
- **Machine Type Selection**: Machine name now automatically updates to default name when type is changed

### Changed
- **Machine Type Selection**: Reorganized add machine dialog with categorized dropdown for better UX

## [Unreleased] - 2025-07-25

### Added
- **Dashboard File Widgets**: Two new dashboard widgets for file management
  - **File Explorer Widget**: Browse and view files directly from the dashboard with folder navigation
  - **File Viewer Widget**: Pin specific files to the dashboard for persistent quick access
- **Widget Data Updates**: List widgets now display real data from Projects, Machines, and Sensors pages
  - Projects, Machines, and Sensors pages now save data to localStorage and dispatch update events
  - List widgets listen for these events and refresh automatically
  - WIT terminal commands that create items now trigger widget refreshes
- **Mini Terminal Enhancement**: WITsWidget transformed from voice assistant to functional mini terminal
  - Matches the main WIT page interface (without file explorer)
  - Executes commands through the same AI backend
  - Automatically refreshes list widgets when items are created via commands

### Fixed
- **Widget Interaction**: Resolved drag behavior conflict with file selection in File Explorer and File Viewer widgets
  - Added proper event propagation stopping to prevent widget dragging when clicking on files
  - Users can now properly select files and folders without triggering widget movement
- **Data Display**: Fixed list widgets showing hardcoded sample data instead of actual user data
- **Context Menu**: Fixed separator items appearing as clickable options in file browser context menus
- **File Sync**: Fixed file content synchronization between project pages and main storage
- **Project Naming**: Project folders in main storage now show project names instead of IDs

### Changed
- **Widget Architecture**: ListWidget component refactored to remove all sample data fallback logic
- **Data Flow**: Implemented proper data persistence and event-driven updates across all list widgets

## [Unreleased] - 2025-07-24 (Late Night)

### Added
- **Enhanced File Viewer**: Comprehensive multi-format file viewing support
  - **CSV Files**: Interactive table view with proper parsing for quoted values, sticky headers, and hover effects
  - **JSON Files**: Syntax-highlighted viewer with color-coded keys, values, and proper indentation
  - **PDF Files**: Full PDF viewer with page navigation, zoom controls, and proper authorization
  - **RTF Files**: Text extraction and display with clean formatting
  - **DOC/DOCX Files**: Microsoft Word document parsing and text display
  - **LOG Files**: Terminal-style viewer with green-on-black theme
- **Backend Document Processing**: 
  - Added `/api/v1/files/parse` endpoint for RTF and DOCX text extraction
  - Added `/api/v1/files/download` endpoint for binary file downloads with proper MIME types
  - Installed `striprtf` and `python-docx` libraries for document parsing
- **WebSocket Improvements**: Added automatic reconnection logic with error handling for better stability

### Fixed
- **PDF Rendering**: Resolved canvas conflicts in React StrictMode by implementing proper render task management
- **Binary File Handling**: Fixed 500 errors when attempting to read binary files as text
- **File Type Detection**: Improved file extension handling to properly route requests to appropriate endpoints

## [Unreleased] - 2025-07-24 (Night)

### Added
- **AI Tooling**: Empowered the AI with a comprehensive set of tools, allowing it to manage files (list, read, write, create, delete), check equipment status, and search conversation logs.
- **Real-Time UI Updates**: Implemented a WebSocket connection to automatically refresh the file browser and viewer in real-time when the AI performs any file operation, ensuring the UI always reflects the current state.
- **AI Conversation Logging**: Created a permanent `WIT_LOG.md` file to log all AI conversations with precise timestamps for future analysis and debugging.

### Fixed
- **AI Authentication**: Resolved a critical bug where the AI's tools were not using the authenticated user's context, causing `NoneType` errors and incorrect file operations.
- **CORS & WebSocket Errors**: Fixed multiple CORS and WebSocket connection issues that prevented the frontend from communicating with the backend, including adding the frontend's origin to the allowed list and correctly handling WebSocket connections.
- **API Validation**: Corrected several Pydantic validation errors by making `project_id` optional in `FileOperationRequest` and `FileUpdateRequest` models, allowing for operations on user-level files.
- **Python Errors**: Fixed numerous `NameError`, `TypeError`, `SyntaxError`, and `IndentationError` exceptions that arose during the development of the new AI features.

## [Unreleased] - 2025-07-24 (Evening)

### Fixed
- **API Routing**: Resolved a series of cascading API routing issues that prevented file viewing, creation, and editing, returning the file management system to full functionality.
- **Path Validation**: Corrected a critical path validation bug that caused duplicated path segments and `FileNotFoundError` exceptions during file operations.
- **Missing Endpoints**: Implemented the missing `/api/v1/files/content` (GET) and `/api/v1/files/update` (POST) endpoints to allow reading and saving file content.

## [Unreleased] - 2025-07-24 (Afternoon)

### Added
- **Folder Uploads**: Implemented the ability to upload entire folders with their contents from the file browser.
- **Folder Content Management**: Users can now right-click on folders to create new files and subfolders within them.
- **Visual Indentation**: Added visual indentation to the file browser to clearly represent the file hierarchy.
- **File Extension Validation**: New files created through the UI now default to `.md` if no extension is provided.

### Fixed
- **File Operations**:
    - Corrected a bug that prevented file deletion and renaming.
    - Fixed an issue where creating files inside a folder would incorrectly place them at the root.
    - Resolved a path validation error that was causing 403 Forbidden errors on file operations.
- **UI Layout**: Adjusted the default width of the file browser to 1/4 of the screen for a better layout.

## [Unreleased] - 2025-07-24

### Added
- **AI Terminal & File Browser**: Implemented a new primary "WIT" page featuring an interactive terminal and a file browser.
- **Resizable Panes**: Added a draggable divider to allow resizing of the terminal and file browser panes.
- **File Operations**: Implemented a right-click context menu in the file browser for creating, renaming, and deleting files and folders.
- **AI Capabilities**:
    - Integrated the terminal with the Claude API for natural language command processing.
    - Enabled the AI to perform actions ("tools") like managing projects and equipment.
    - Provided the AI with database context for user-specific responses.
- **Chat Persistence**: The terminal now saves chat history and maintains conversational context between page loads.

### Fixed
- **UI Bugs**:
    - Corrected a bug where the browser's default context menu would appear over the custom file browser menu.
    - Fixed an issue where creating files/folders inside a directory would incorrectly place them at the root.
    - Resolved a visual bug where the resizer handle would "jump" when dragged.
- **Backend Stability**:
    - Fixed multiple `ImportError` and `NameError` issues by removing unused routers and correcting dependencies.
    - Resolved a critical `AttributeError` in the Claude service by switching to the official `anthropic` library.
    - Corrected an API error caused by referencing a non-existent AI model.

## [Unreleased] - 2025-07-23

### Added
- Created a new, clean database schema with `User` and `Project` models.
- Implemented a `CreateUserPage.tsx` on the frontend with a corresponding API endpoint to allow new user registration.
- Re-implemented the `projects_router.py` with endpoints for creating, reading, updating, and deleting projects.
- Added a `Task` model and a `tasks_router.py` to support basic task management within projects.

### Fixed
- Resolved a persistent server crashing issue by removing all legacy database models and API routers that were causing import errors.
- Corrected a React Hooks error in `ProjectsPage.tsx` that was caused by calling `useRef` inside a conditional block.
- Fixed multiple syntax and import errors in `AuthContext.tsx`, `dev_server.py`, and various router files.

### Removed
- Deleted a large number of obsolete and duplicate files, including old database models, schemas, and backup files, to clean up the codebase.
