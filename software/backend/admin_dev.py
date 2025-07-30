#!/usr/bin/env python3
"""
Simplified admin endpoints for development
These bypass the complex auth system and work directly with dev tokens
"""
from fastapi import APIRouter, HTTPException, Header, status
from jose import JWTError, jwt
import os
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

# Use the same secret key as dev_server
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

# Simple response models
class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    is_active: bool
    is_admin: bool
    created_at: str
    linked_accounts: List[dict] = []

class UsersListResponse(BaseModel):
    users: List[UserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

# Simple auth check
async def verify_admin_token(authorization: str = Header(None)) -> dict:
    """Verify the token and check if user is admin"""
    if not authorization or not authorization.startswith("Bearer "):
        logger.warning("No valid authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
        
        # Check if admin
        if username != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        return {"username": username, "id": "admin-id"}
    except JWTError as e:
        logger.error(f"JWT decode error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

# Note: This module now integrates directly with dev_server's users_db
# No mock data needed - all user data comes from dev_server.py

@router.get("/stats")
async def get_admin_stats(authorization: str = Header(None)):
    """Get admin dashboard statistics"""
    await verify_admin_token(authorization)
    
    # Import users_db from dev_server
    try:
        import dev_server
        users_db = dev_server.users_db
    except (ImportError, AttributeError) as e:
        logger.error(f"Failed to import from dev_server: {e}")
        # Return empty stats if import fails
        return {
            "total_users": 0,
            "active_users": 0,
            "admin_users": 0,
            "users_with_linked_accounts": 0,
            "recent_signups": 0,
            "stats_updated_at": datetime.utcnow().isoformat()
        }
    
    # Calculate stats from real users_db
    total_users = len(users_db)
    active_users = sum(1 for u in users_db.values() if u.get("is_active", True))
    admin_users = sum(1 for u in users_db.values() if u.get("is_admin", False))
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "admin_users": admin_users,
        "users_with_linked_accounts": 0,  # No linked accounts in dev mode
        "recent_signups": 1,  # Placeholder value
        "stats_updated_at": datetime.utcnow().isoformat()
    }

@router.get("/users", response_model=UsersListResponse)
async def list_users(
    page: int = 1,
    page_size: int = 10,
    search: Optional[str] = None,
    authorization: str = Header(None)
):
    """List all users with pagination"""
    await verify_admin_token(authorization)
    
    # Import users_db to get all users
    try:
        # Import from the same module since we're in the backend directory
        import dev_server
        users_db = dev_server.users_db
    except (ImportError, AttributeError) as e:
        logger.error(f"Failed to import users_db: {e}")
        # Return empty list if import fails
        return UsersListResponse(
            users=[],
            total=0,
            page=page,
            page_size=page_size,
            total_pages=0
        )
    
    # Convert users_db to list format
    all_users = []
    
    # Add users from users_db
    for username, user_data in users_db.items():
        all_users.append({
            "id": f"{username}-id",
            "username": username,
            "email": user_data.get("email", f"{username}@wit.local"),
            "is_active": user_data.get("is_active", True),
            "is_admin": user_data.get("is_admin", False),
            "created_at": "2025-01-01T00:00:00",
            "linked_accounts": []
        })
    
    # Filter users if search provided
    users = all_users
    if search:
        search_lower = search.lower()
        users = [u for u in users if 
                search_lower in u["username"].lower() or 
                search_lower in u["email"].lower()]
    
    # Paginate
    total = len(users)
    start = (page - 1) * page_size
    end = start + page_size
    paginated_users = users[start:end]
    
    return UsersListResponse(
        users=[UserResponse(**u) for u in paginated_users],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )

@router.post("/users")
async def create_user(
    user_data: dict,
    authorization: str = Header(None)
):
    """Create a new user"""
    await verify_admin_token(authorization)
    
    # Import the add_user function from dev_server
    try:
        import dev_server
        add_user = dev_server.add_user
        users_db = dev_server.users_db
    except (ImportError, AttributeError) as e:
        logger.error(f"Failed to import from dev_server: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error"
        )
    
    # Check if user already exists
    username = user_data["username"]
    if username in users_db:
        logger.warning(f"User {username} already exists")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Add to dev_server's users_db using the helper function
    add_user(
        username=username,
        password=user_data["password"],
        email=user_data["email"],
        is_admin=user_data.get("is_admin", False)
    )
    
    # Create response object
    new_user = {
        "id": f"{username}-id",
        "username": username,
        "email": user_data["email"],
        "is_active": True,
        "is_admin": user_data.get("is_admin", False),
        "created_at": datetime.utcnow().isoformat(),
        "linked_accounts": []
    }
    
    logger.info(f"Created user {username} with password (dev mode)")
    return UserResponse(**new_user)

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    authorization: str = Header(None)
):
    """Delete a user"""
    await verify_admin_token(authorization)
    
    # Import users_db from dev_server
    try:
        import dev_server
        users_db = dev_server.users_db
    except (ImportError, AttributeError) as e:
        logger.error(f"Failed to import from dev_server: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error"
        )
    
    # Extract username from user_id (format: "username-id")
    if user_id.endswith("-id"):
        username = user_id[:-3]
    else:
        username = user_id
    
    # Check if user exists
    if username not in users_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent deleting admin user
    if username == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete admin user"
        )
    
    # Delete user from users_db
    del users_db[username]
    logger.info(f"Deleted user {username} from users_db")
    
    return {"message": f"User {username} deleted successfully"}