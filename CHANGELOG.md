# Changelog

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
