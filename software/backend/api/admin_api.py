"""
Admin API for user management
Only accessible by admin users
"""
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from sqlalchemy.orm import selectinload
import uuid
import logging

from services.database_services import get_session, User, LinkedAccount
from auth.security import get_password_hash

logger = logging.getLogger(__name__)

# For development, we'll check if we're running in dev mode
import os
logger.info(f"RUNNING_IN_DEV_SERVER: {os.getenv('RUNNING_IN_DEV_SERVER', 'false')}")
if os.getenv("RUNNING_IN_DEV_SERVER", "false") == "true":
    # Development mode - use simple auth
    from fastapi import HTTPException, status, Header
    from jose import JWTError, jwt
    
    SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this-in-production")
    ALGORITHM = "HS256"
    
    async def get_current_user(authorization: str = Header(None)):
        """Simple auth for dev server"""
        logger.info(f"get_current_user called with authorization: {authorization[:50] if authorization else 'None'}...")
        logger.info(f"Using SECRET_KEY: {SECRET_KEY[:20]}...")
        
        if not authorization or not authorization.startswith("Bearer "):
            logger.warning("No valid authorization header found")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        token = authorization.split(" ")[1]
        logger.info(f"Attempting to decode token: {token[:20]}...")
        
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            logger.info(f"Token decoded successfully. Payload: {payload}")
            username = payload.get("sub")
            if username is None:
                logger.warning("No 'sub' field in token payload")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Could not validate credentials",
                )
            
            logger.info(f"Authenticated user: {username}")
            # For dev, admin user has admin privileges
            return {
                "id": "admin-id" if username == "admin" else "user-id",
                "username": username,
                "is_admin": username == "admin",
                "email": f"{username}@wit.local"
            }
        except JWTError as e:
            logger.error(f"JWT decode error: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
else:
    # Production mode - use full auth
    from services.auth_services import get_current_user

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

# Pydantic models
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    is_admin: bool = False

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    is_active: bool
    is_admin: bool
    created_at: datetime
    linked_accounts: List[dict] = []

class UsersListResponse(BaseModel):
    users: List[UserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

# Dependency to check if user is admin
async def require_admin(authorization: str = Header(None)) -> dict:
    """Require the current user to be an admin"""
    current_user = await get_current_user(authorization)
    
    # Handle both dict and object formats
    if hasattr(current_user, 'is_admin'):
        is_admin = current_user.is_admin
    else:
        is_admin = current_user.get("is_admin", False)
    
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    # Convert to dict if it's an object
    if hasattr(current_user, '__dict__'):
        return {
            "id": str(getattr(current_user, 'id', 'admin')),
            "username": current_user.username,
            "is_admin": current_user.is_admin
        }
    return current_user

@router.get("/users", response_model=UsersListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_session)
):
    """List all users with pagination"""
    # Check admin permissions
    current_admin = await require_admin(authorization)
    
    # Build query
    query = select(User).options(selectinload(User.linked_accounts))
    
    # Add search filter if provided
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            (User.username.ilike(search_filter)) |
            (User.email.ilike(search_filter))
        )
    
    # Get total count
    count_query = select(func.count()).select_from(User)
    if search:
        count_query = count_query.where(
            (User.username.ilike(search_filter)) |
            (User.email.ilike(search_filter))
        )
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Add pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(User.created_at.desc())
    
    # Execute query
    result = await db.execute(query)
    users = result.scalars().all()
    
    # Convert to response format
    user_responses = []
    for user in users:
        linked_accounts = []
        for account in user.linked_accounts:
            linked_accounts.append({
                "provider": account.provider,
                "email": account.email,
                "status": account.status,
                "connected_at": account.created_at.isoformat()
            })
        
        user_responses.append(UserResponse(
            id=str(user.id),
            username=user.username,
            email=user.email,
            is_active=user.is_active,
            is_admin=user.is_admin,
            created_at=user.created_at,
            linked_accounts=linked_accounts
        ))
    
    total_pages = (total + page_size - 1) // page_size
    
    return UsersListResponse(
        users=user_responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.post("/users", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_session)
):
    """Create a new user (automatically verified)"""
    # Check if username already exists
    existing = await db.execute(
        select(User).where(User.username == user_data.username)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Check if email already exists
    existing = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists"
        )
    
    # Create new user
    new_user = User(
        id=uuid.uuid4(),
        username=user_data.username,
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        is_active=True,  # Auto-verified
        is_admin=user_data.is_admin,
        created_at=datetime.utcnow()
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    logger.info(f"Admin {current_admin['username']} created user {new_user.username}")
    
    return UserResponse(
        id=str(new_user.id),
        username=new_user.username,
        email=new_user.email,
        is_active=new_user.is_active,
        is_admin=new_user.is_admin,
        created_at=new_user.created_at,
        linked_accounts=[]
    )

@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_session)
):
    """Update user details"""
    # Get user
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id))
        .options(selectinload(User.linked_accounts))
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent admin from disabling themselves
    if str(user.id) == current_admin['id'] and user_update.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot disable your own account"
        )
    
    # Update fields
    if user_update.email is not None:
        # Check if email already exists
        existing = await db.execute(
            select(User).where(
                User.email == user_update.email,
                User.id != user.id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )
        user.email = user_update.email
    
    if user_update.is_active is not None:
        user.is_active = user_update.is_active
    
    if user_update.is_admin is not None:
        user.is_admin = user_update.is_admin
    
    await db.commit()
    await db.refresh(user)
    
    logger.info(f"Admin {current_admin['username']} updated user {user.username}")
    
    # Format response
    linked_accounts = []
    for account in user.linked_accounts:
        linked_accounts.append({
            "provider": account.provider,
            "email": account.email,
            "status": account.status,
            "connected_at": account.created_at.isoformat()
        })
    
    return UserResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        is_active=user.is_active,
        is_admin=user.is_admin,
        created_at=user.created_at,
        linked_accounts=linked_accounts
    )

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_session)
):
    """Delete a user and all their data"""
    # Prevent admin from deleting themselves
    if user_id == current_admin['id']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    # Get user
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id))
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    username = user.username
    
    # Delete user (cascade will handle related records)
    await db.delete(user)
    await db.commit()
    
    logger.info(f"Admin {current_admin['username']} deleted user {username}")
    
    return {"message": f"User {username} deleted successfully"}

@router.get("/stats")
async def get_admin_stats(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_session)
):
    """Get admin dashboard statistics"""
    # Check admin permissions
    current_admin = await require_admin(authorization)
    
    # Total users
    total_users_result = await db.execute(select(func.count()).select_from(User))
    total_users = total_users_result.scalar()
    
    # Active users
    active_users_result = await db.execute(
        select(func.count()).select_from(User).where(User.is_active == True)
    )
    active_users = active_users_result.scalar()
    
    # Admin users
    admin_users_result = await db.execute(
        select(func.count()).select_from(User).where(User.is_admin == True)
    )
    admin_users = admin_users_result.scalar()
    
    # Users with linked accounts
    linked_accounts_result = await db.execute(
        select(func.count(func.distinct(LinkedAccount.user_id))).select_from(LinkedAccount)
    )
    users_with_linked_accounts = linked_accounts_result.scalar()
    
    # Recent signups (last 7 days)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    recent_signups_result = await db.execute(
        select(func.count()).select_from(User).where(User.created_at >= seven_days_ago)
    )
    recent_signups = recent_signups_result.scalar()
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "admin_users": admin_users,
        "users_with_linked_accounts": users_with_linked_accounts,
        "recent_signups": recent_signups,
        "stats_updated_at": datetime.utcnow().isoformat()
    }