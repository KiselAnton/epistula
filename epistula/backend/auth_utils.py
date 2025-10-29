"""Authentication utilities for Epistula.

This module provides:
- Password hashing and verification using bcrypt
- JWT token generation and validation
- Current user extraction from tokens
"""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import os

from database import get_db
from models import UserDB, User

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT configuration
SECRET_KEY = os.getenv("SECRET_KEY", "dev_secret_key_change_in_production_12345678901234567890")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# HTTP Bearer security scheme
security = HTTPBearer()


# ============================================================================
# Password Hashing Functions
# ============================================================================

def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.
    
    Args:
        password: Plain text password
        
    Returns:
        Hashed password string
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.
    
    Args:
        plain_password: Plain text password to verify
        hashed_password: Hashed password from database
        
    Returns:
        True if password matches, False otherwise
    """
    return pwd_context.verify(plain_password, hashed_password)


# ============================================================================
# JWT Token Functions
# ============================================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.
    
    Args:
        data: Payload data to encode in the token
        expires_delta: Optional expiration time delta
        
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    return encoded_jwt


def decode_access_token(token: str) -> dict:
    """
    Decode and validate a JWT access token.
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded token payload
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ============================================================================
# User Authentication Functions
# ============================================================================

def authenticate_user(db: Session, email: str, password: str) -> Optional[UserDB]:
    """
    Authenticate a user by email and password.
    
    Args:
        db: Database session
        email: User email
        password: Plain text password
        
    Returns:
        UserDB object if authentication successful, None otherwise
    """
    user = db.query(UserDB).filter(UserDB.email == email).first()
    
    if not user:
        return None
    
    if not user.is_active:
        return None
    
    if not verify_password(password, user.password_hash):
        return None
    
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> UserDB:
    """
    Get the current authenticated user from JWT token.
    
    This is a FastAPI dependency that extracts and validates the JWT token
    from the Authorization header, then retrieves the user from the database.
    
    Args:
        credentials: HTTP Bearer credentials from request header
        db: Database session
        
    Returns:
        UserDB object for the authenticated user
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    token = credentials.credentials
    payload = decode_access_token(token)
    
    user_id: int = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )
    
    return user


def db_user_to_pydantic(db_user: UserDB) -> User:
    """
    Convert a SQLAlchemy UserDB model to a Pydantic User model.
    
    Args:
        db_user: SQLAlchemy UserDB object
        
    Returns:
        Pydantic User object
    """
    # Determine role based on is_root flag
    # For now, we'll use a simple mapping
    # Later we'll query user_university_roles for university-specific roles
    from models import UserRole
    
    if db_user.is_root:
        role = UserRole.ROOT
    else:
        # Default role - in production this should be determined by context
        role = UserRole.STUDENT
    
    return User(
        id=str(db_user.id),
        email=db_user.email,
        name=db_user.name,
        role=role,
        created_at=db_user.created_at,
        updated_at=db_user.updated_at,
        is_active=db_user.is_active,
    )
