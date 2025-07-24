# Changelog

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
