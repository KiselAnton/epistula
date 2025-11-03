"""Authentication utilities for Epistula.

This module provides:
- Password hashing and verification using bcrypt
- JWT token generation and validation
- Current user extraction from tokens
"""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import os

from utils.database import get_db
from utils.models import UserDB, User

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
    # Convert password to bytes, hash it, and return as string
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.
    
    Args:
        plain_password: Plain text password to verify
        hashed_password: Hashed password from database
        
    Returns:
        True if password matches, False otherwise
    """
    # Convert both to bytes for comparison
    password_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)


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
    # Case-insensitive email lookup
    user = db.query(UserDB).filter(UserDB.email.ilike(email)).first()
    
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
    
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Convert string user_id back to int
    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
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


def db_user_to_pydantic(db_user: UserDB, db: Session = None) -> User:
    """
    Convert a SQLAlchemy UserDB model to a Pydantic User model.
    
    Args:
        db_user: SQLAlchemy UserDB object
        db: Optional database session to fetch university roles
        
    Returns:
        Pydantic User object
    """
    from utils.models import UserRole, UserUniversityRoleDB, UniversityAccess
    from sqlalchemy import text
    
    # Determine role and universities
    role = UserRole.ROOT if db_user.is_root else UserRole.STUDENT
    universities = []
    university_access = []
    primary_university_id = None
    
    # Fetch university roles if db session provided
    if db:
        user_roles = db.query(UserUniversityRoleDB).filter(
            UserUniversityRoleDB.user_id == db_user.id
        ).all()
        
        if user_roles:
            # Determine highest role across all universities
            role_priority = {
                UserRole.ROOT: 4,
                UserRole.UNI_ADMIN: 3,
                UserRole.PROFESSOR: 2,
                UserRole.STUDENT: 1,
            }
            
            highest_role = UserRole.STUDENT
            
            # Build detailed university access list
            for ur in user_roles:
                # Fetch university details (only active, non-temp universities)
                uni_query = text("""
                    SELECT id, name, code, schema_name, is_active, logo_url
                    FROM public.universities
                    WHERE id = :uni_id
                    AND is_active = TRUE
                    AND schema_name NOT LIKE '%_temp'
                """)
                result = db.execute(uni_query, {"uni_id": ur.university_id}).fetchone()
                
                if result and ur.is_active:  # Only include if both university and user role are active
                    try:
                        ur_role = UserRole(ur.role)
                        university_access.append(UniversityAccess(
                            university_id=result[0],
                            university_name=result[1],
                            university_code=result[2],
                            role=ur_role,
                            is_active=ur.is_active,
                            logo_url=result[5]
                        ))
                        
                        # Track highest role
                        if role_priority.get(ur_role, 0) > role_priority.get(highest_role, 0):
                            highest_role = ur_role
                    except (ValueError, KeyError):
                        pass
            
            # Set universities list (legacy field for backward compatibility)
            universities = [ua.university_id for ua in university_access]
            
            # Set primary university (first active university)
            primary_university_id = universities[0] if universities else None
            
            # Use highest role if not root
            role = highest_role if not db_user.is_root else UserRole.ROOT
    
    return User(
        id=str(db_user.id),
        email=db_user.email,
        name=db_user.name,
        role=role,
        created_at=db_user.created_at,
        updated_at=db_user.updated_at,
        is_active=db_user.is_active,
        universities=universities,
        university_access=university_access,
        primary_university_id=primary_university_id,
    )
