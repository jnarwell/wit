"""
W.I.T. Auth Service

File: software/backend/services/auth_service.py

Authentication and authorization service using JWT tokens.
"""

import os
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
import secrets

# Configure logging
logger = logging.getLogger(__name__)

# Security configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Password hashing - Import from the central security module to ensure consistency
from auth.security import pwd_context, verify_password, get_password_hash

# Database imports
from services.database_services import get_session

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


# Models
class Token(BaseModel):
    """Token response model"""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Token data model"""
    username: Optional[str] = None
    user_id: Optional[str] = None
    scopes: list = []


class UserCreate(BaseModel):
    """User creation model"""
    username: str
    email: EmailStr
    password: str
    is_admin: bool = False


class UserLogin(BaseModel):
    """User login model"""
    username: str
    password: str


class UserResponse(BaseModel):
    """User response model"""
    id: str
    username: str
    email: str
    is_active: bool
    is_admin: bool
    created_at: datetime
    last_login: Optional[datetime] = None


class PasswordChange(BaseModel):
    """Password change model"""
    old_password: str
    new_password: str


class AuthService:
    """Authentication service"""
    
    def __init__(self, database_service=None):
        self.db = database_service
        
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        return verify_password(plain_password, hashed_password)
        
    def get_password_hash(self, password: str) -> str:
        """Hash password"""
        return get_password_hash(password)
        
    def create_access_token(self, data: dict, 
                          expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            
        to_encode.update({"exp": expire, "type": "access"})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        
        return encoded_jwt
        
    def create_refresh_token(self, data: dict) -> str:
        """Create JWT refresh token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        
        to_encode.update({"exp": expire, "type": "refresh"})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        
        return encoded_jwt
        
    def decode_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Decode JWT token"""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except JWTError:
            return None
            
    async def authenticate_user(self, username: str, password: str) -> Optional[dict]:
        """Authenticate user"""
        if not self.db:
            # Demo user for testing
            if username == "admin" and password == "admin":
                return {
                    "id": "demo-admin-id",
                    "username": "admin",
                    "email": "admin@wit.local",
                    "is_admin": True,
                    "is_active": True
                }
            return None
            
        # Get user from database
        from .database_services import User, get_session
        result = await self.db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        
        if not user:
            return None
            
        if not self.verify_password(password, user.hashed_password):
            return None
            
        if not user.is_active:
            return None
        
        return {
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "is_admin": user.is_admin,
            "is_active": user.is_active,
            "created_at": user.created_at
        }
        
    async def create_user(self, user_data: UserCreate) -> Optional[dict]:
        """Create new user"""
        if not self.db:
            return None
            
        # Check if user exists
        from .database_services import User
        result = await self.db.execute(select(User).where(User.username == user_data.username))
        existing = result.scalar_one_or_none()
        if existing:
            raise ValueError("Username already exists")
            
        result = await self.db.execute(select(User).where(User.email == user_data.email))
        existing = result.scalar_one_or_none()
        if existing:
            raise ValueError("Email already exists")
            
        # Create user
        user = User(
            username=user_data.username,
            email=user_data.email,
            hashed_password=self.get_password_hash(user_data.password),
            is_admin=user_data.is_admin
        )
        
        user = await self.db.create(user)
        
        return {
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "is_admin": user.is_admin,
            "is_active": user.is_active,
            "created_at": user.created_at
        }
        
    async def get_user_by_id(self, user_id: str) -> Optional[dict]:
        """Get user by ID"""
        if not self.db:
            # Demo user
            if user_id == "demo-admin-id":
                return {
                    "id": "demo-admin-id",
                    "username": "admin",
                    "email": "admin@wit.local",
                    "is_admin": True,
                    "is_active": True
                }
            return None
            
        from .database_services import User
        import uuid
        # Convert string to UUID if needed
        if isinstance(user_id, str):
            try:
                user_id = uuid.UUID(user_id)
            except ValueError:
                return None
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            return None
            
        return {
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "is_admin": user.is_admin,
            "is_active": user.is_active,
            "created_at": user.created_at
        }
        
    async def change_password(self, user_id: str, 
                            old_password: str, 
                            new_password: str) -> bool:
        """Change user password"""
        if not self.db:
            return False
            
        from .database_services import User
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            return False
            
        if not self.verify_password(old_password, user.hashed_password):
            return False
            
        new_hash = self.get_password_hash(new_password)
        user.hashed_password = new_hash
        await self.db.commit()
        
        return True
        
    def create_api_key(self, user_id: str, name: str) -> str:
        """Create API key for user"""
        # Generate secure random key
        api_key = secrets.token_urlsafe(32)
        
        # In production, would store hashed key in database
        # with associated user_id and permissions
        
        return api_key
        
    async def validate_api_key(self, api_key: str) -> Optional[dict]:
        """Validate API key"""
        # In production, would look up key in database
        # For now, accept any key starting with "wit_"
        if api_key.startswith("wit_"):
            return {
                "id": "api-user-id",
                "username": "api_user",
                "email": "api@wit.local",
                "is_admin": False,
                "is_active": True
            }
        return None


# Global auth service instance
auth_service = AuthService()


# Dependency functions for FastAPI
async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_session)) -> dict:
    """Get current user from token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Create auth service with database
    auth_with_db = AuthService(db)
    payload = auth_with_db.decode_token(token)
    if not payload:
        raise credentials_exception
        
    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception
        
    token_data = TokenData(username=username)
    
    # Get user
    user = await auth_with_db.get_user_by_id(payload.get("user_id"))
    
    if user is None:
        raise credentials_exception
        
    if not user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
        
    return user


async def get_current_active_user(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """Get current active user"""
    if not current_user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


async def is_admin(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """Check if user is admin"""
    if not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


# Optional: API key authentication
from fastapi.security import APIKeyHeader

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def get_api_key_user(api_key: Optional[str] = Depends(api_key_header)) -> Optional[dict]:
    """Get user from API key"""
    if not api_key:
        return None
        
    user = await auth_service.validate_api_key(api_key)
    return user


async def get_current_user_or_api_key(
    token_user: Optional[dict] = Depends(get_current_user),
    api_key_user: Optional[dict] = Depends(get_api_key_user)
) -> dict:
    """Get user from token or API key"""
    if token_user:
        return token_user
    elif api_key_user:
        return api_key_user
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )


# Auth API endpoints (to be included in a router)
from fastapi import APIRouter

auth_router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@auth_router.post("/register", response_model=UserResponse)
async def register(user_data: UserCreate):
    """Register new user"""
    try:
        user = await auth_service.create_user(user_data)
        return UserResponse(**user)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@auth_router.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_session)):
    """Login and get access token"""
    # Create auth service with database connection
    auth_with_db = AuthService(db)
    user = await auth_with_db.authenticate_user(
        form_data.username, 
        form_data.password
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token = auth_with_db.create_access_token(
        data={"sub": user["username"], "user_id": user["id"]}
    )
    refresh_token = auth_with_db.create_refresh_token(
        data={"sub": user["username"], "user_id": user["id"]}
    )
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token
    )


@auth_router.post("/refresh", response_model=Token)
async def refresh_token(refresh_token: str):
    """Refresh access token"""
    payload = auth_service.decode_token(refresh_token)
    
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
        
    # Create new access token
    access_token = auth_service.create_access_token(
        data={"sub": payload["sub"], "user_id": payload["user_id"]}
    )
    
    return Token(access_token=access_token)


@auth_router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user info"""
    return UserResponse(**current_user)


@auth_router.post("/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: dict = Depends(get_current_user)
):
    """Change password"""
    success = await auth_service.change_password(
        current_user["id"],
        password_data.old_password,
        password_data.new_password
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid old password"
        )
        
    return {"message": "Password changed successfully"}


@auth_router.post("/api-key")
async def create_api_key(
    name: str,
    current_user: dict = Depends(get_current_user)
):
    """Create API key"""
    api_key = auth_service.create_api_key(current_user["id"], name)
    
    return {
        "api_key": api_key,
        "name": name,
        "message": "Store this key securely, it won't be shown again"
    }


# Example usage
async def main():
    """Example usage"""
    # Create auth service
    auth = AuthService()
    
    # Create user
    user_data = UserCreate(
        username="john_doe",
        email="john@example.com",
        password="secure_password",
        is_admin=False
    )
    
    # In production, would use database
    # user = await auth.create_user(user_data)
    # print(f"Created user: {user}")
    
    # Authenticate
    user = await auth.authenticate_user("admin", "admin")
    if user:
        print(f"Authenticated: {user['username']}")
        
        # Create tokens
        access_token = auth.create_access_token(
            data={"sub": user["username"], "user_id": user["id"]}
        )
        print(f"Access token: {access_token[:20]}...")
        
        # Decode token
        payload = auth.decode_token(access_token)
        print(f"Token payload: {payload}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())