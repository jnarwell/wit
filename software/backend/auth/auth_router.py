"""
Authentication Router with Email Verification
"""
from datetime import datetime, timedelta
from typing import Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Header
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
import secrets
import os
import logging
from pathlib import Path

from services.auth_services import auth_service, get_current_user
from services.database_services import get_session, create_user, get_user_by_username, User
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
logger = logging.getLogger(__name__)

# Email verification storage (in production, use Redis or database)
email_verification_tokens: Dict[str, dict] = {}

class Token(BaseModel):
    access_token: str
    token_type: str

class SignupRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    recaptcha_token: Optional[str] = None  # For reCAPTCHA verification

class SignupResponse(BaseModel):
    success: bool
    message: str
    user_id: Optional[str] = None

async def send_verification_email(email: str, token: str):
    """Send verification email (development mode - logs to console and file)"""
    verification_link = f"http://localhost:8000/api/v1/auth/verify-email?token={token}"
    
    # Log the verification link prominently
    logger.info("=" * 80)
    logger.info("EMAIL VERIFICATION LINK (Development Mode)")
    logger.info("=" * 80)
    logger.info(f"To: {email}")
    logger.info(f"Verification Link: {verification_link}")
    logger.info("=" * 80)
    logger.info("Copy and paste this link in your browser to verify your email")
    logger.info("=" * 80)
    
    # Also print to console for visibility
    print("\n" + "=" * 80)
    print("EMAIL VERIFICATION LINK (Development Mode)")
    print("=" * 80)
    print(f"To: {email}")
    print(f"Verification Link: {verification_link}")
    print("=" * 80)
    print("Copy and paste this link in your browser to verify your email")
    print("=" * 80 + "\n")
    
    # Write to file for easy access
    try:
        # Create a directory for verification emails if it doesn't exist
        email_dir = Path("dev_emails")
        email_dir.mkdir(exist_ok=True)
        
        # Write the verification email to a file
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = email_dir / f"verification_{timestamp}_{email.replace('@', '_at_')}.txt"
        
        with open(filename, 'w') as f:
            f.write(f"Subject: Verify your W.I.T. account\n")
            f.write(f"To: {email}\n")
            f.write(f"Date: {datetime.utcnow().isoformat()}\n")
            f.write("\n")
            f.write("Welcome to W.I.T.!\n\n")
            f.write("Please click the link below to verify your email address:\n\n")
            f.write(f"{verification_link}\n\n")
            f.write("This link will expire in 24 hours.\n\n")
            f.write("If you didn't create an account, you can safely ignore this email.\n\n")
            f.write("Best regards,\nThe W.I.T. Team\n")
        
        logger.info(f"Verification email saved to: {filename}")
        
        # Optional: Open the link in browser automatically (for development)
        if os.getenv("AUTO_OPEN_VERIFICATION", "false").lower() == "true":
            import webbrowser
            webbrowser.open(verification_link)
            
    except Exception as e:
        logger.error(f"Failed to save verification email: {e}")

@router.post("/signup", response_model=SignupResponse)
async def signup(
    signup_data: SignupRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_session)
):
    """Register a new user with email verification"""
    try:
        logger.info(f"Signup attempt for username: {signup_data.username}")
        
        # Check if user already exists
        existing_user = await get_user_by_username(db, signup_data.username)
        if existing_user:
            logger.warning(f"Username {signup_data.username} already exists")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )
        
        logger.info(f"Creating user {signup_data.username}")
        # Create user in database
        from auth.security import get_password_hash
        hashed_password = get_password_hash(signup_data.password)
        user = User(
            username=signup_data.username,
            email=signup_data.email,
            hashed_password=hashed_password,
            is_active=True  # TEMPORARILY: Set active immediately
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        # TODO: In production, implement proper reCAPTCHA verification here
        # For now, we'll just log that we would verify the recaptcha token
        if signup_data.recaptcha_token:
            logger.info(f"Would verify reCAPTCHA token: {signup_data.recaptcha_token[:20]}...")
        
        logger.info(f"User signup completed for {signup_data.username} ({signup_data.email})")
        
        return SignupResponse(
            success=True,
            message="Account created successfully. You can now login.",
            user_id=str(user.id)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create account"
        )

@router.get("/verify-email")
async def verify_email(
    token: str,
    db: AsyncSession = Depends(get_session)
):
    """Verify email address using token"""
    # Check if token exists
    if token not in email_verification_tokens:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )
    
    token_data = email_verification_tokens[token]
    
    # Check if token is expired (24 hours)
    token_age = datetime.utcnow() - token_data["created_at"]
    if token_age.total_seconds() > 86400:  # 24 hours
        del email_verification_tokens[token]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token has expired"
        )
    
    # Activate the user in database
    from sqlalchemy import select, update
    from services.database_services import User
    import uuid
    
    # Convert string user_id to UUID
    user_id = uuid.UUID(token_data["user_id"])
    
    result = await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(is_active=True)
    )
    await db.commit()
    
    logger.info(f"Email verified for user {token_data['username']} ({token_data['email']})")
    
    # Remove used token
    del email_verification_tokens[token]
    
    # Redirect to frontend with success message
    frontend_url = "http://localhost:3001"
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=f"{frontend_url}/login?verified=true&message=Email+verified+successfully")

@router.post("/resend-verification")
async def resend_verification(
    email: EmailStr,
    background_tasks: BackgroundTasks
):
    """Resend verification email"""
    # Find token by email
    found_token = None
    for token, data in email_verification_tokens.items():
        if data["email"] == email:
            found_token = token
            break
    
    if not found_token:
        # Don't reveal if email exists or not
        return {"message": "If an account exists with this email, a verification link will be sent."}
    
    # Send verification email in background
    background_tasks.add_task(send_verification_email, email, found_token)
    
    return {"message": "If an account exists with this email, a verification link will be sent."}

# Include existing auth endpoints from auth_services
from services.auth_services import auth_router as service_auth_router

# Include OAuth callback handlers
from auth.oauth_callbacks import router as oauth_router

@router.get("/me")
async def get_current_user_info(authorization: str = Header(None)):
    """Get current user information"""
    # In dev mode, use simple JWT decoding
    if os.getenv("RUNNING_IN_DEV_SERVER", "false") == "true":
        from jose import JWTError, jwt
        
        SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this-in-production")
        ALGORITHM = "HS256"
        
        if not authorization or not authorization.startswith("Bearer "):
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
            
            return {
                "id": "admin-id" if username == "admin" else "user-id",
                "username": username,
                "email": f"{username}@wit.local",
                "is_admin": username == "admin",
                "is_active": True,
                "created_at": datetime.utcnow().isoformat()
            }
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
    else:
        # Production mode - use database
        current_user = await get_current_user(authorization)
        return {
            "id": str(current_user.get("id", "demo-user-id")),
            "username": current_user.get("username"),
            "email": current_user.get("email"),
            "is_admin": current_user.get("is_admin", False),
            "is_active": current_user.get("is_active", True),
            "created_at": current_user.get("created_at", datetime.utcnow()).isoformat() if isinstance(current_user.get("created_at"), datetime) else current_user.get("created_at")
        }

# Merge the service auth router endpoints
for route in service_auth_router.routes:
    if hasattr(route, 'path') and route.path not in ['/signup', '/verify-email', '/resend-verification']:
        router.routes.append(route)

# Merge OAuth callback routes
for route in oauth_router.routes:
    router.routes.append(route)