# Engineering Notes - 2025-07-23

## Summary

This series of commits addresses critical stability and data integrity issues in both the frontend and backend. The primary focus was on resolving error loops, fixing database inconsistencies, and improving API route handling.

## Key Changes

### Frontend (`ProjectDetailPage.tsx`, `App.tsx`)

-   **Fixed Infinite Reload Loop**: Implemented a callback mechanism (`onNotFound`) to gracefully handle cases where a project is not found (404 error). The `ProjectDetailPage` now notifies the main `App` component, which then clears the invalid state and navigates the user away from the broken link, preventing the application from getting stuck.
-   **State Management**: Refined `useEffect` and `useCallback` dependencies to prevent unnecessary re-renders and API calls, making the project detail page more efficient.

### Backend (`database_services.py`, `projects_router.py`, `members_router.py`)

-   **Database Integrity**:
    -   Added a `UniqueConstraint` to the `TeamMember` model to prevent a user from being added to the same project multiple times. This resolves the `sqlalchemy.exc.MultipleResultsFound` error.
    -   The `wit.db` file was deleted to force a schema recreation with the new constraint.
-   **API Routing**:
    -   **Eliminated 307 Redirects**: Corrected FastAPI route definitions in `projects_router.py` by adding handlers for both slash and non-slash URL variants (e.g., `/projects` and `/projects/`).
    -   **Corrected Member Routes**: Fixed malformed routes in `members_router.py` that had a redundant `/projects` prefix.
-   **Robustness**:
    -   Updated the `get_project_member` database query to use `.first()` instead of `.scalar_one_or_none()` to prevent crashes if duplicate member entries still exist in the database from before the fix.

## Outcome

The application is now significantly more stable. The frontend no longer gets stuck on invalid project links, and the backend database integrity is enforced, preventing critical errors. The API is also more efficient due to the removal of unnecessary redirects.
