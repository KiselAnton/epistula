"""Authentication and user management module for Epistula ISO.

This module provides user authentication, role-based access control,
and user management endpoints for the Epistula ISO application.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session

from models import UserLogin, User, TokenResponse, UserDB
from database import get_db
from auth_utils import (
    authenticate_user,
    create_access_token,
    get_current_user,
    db_user_to_pydantic,
)

# Create router
router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: UserLogin,
    db: Session = Depends(get_db)
) -> TokenResponse:
    """
    Authenticate user and generate JWT token.
    
    Args:
        credentials: User login credentials (email and password)
        db: Database session
        
    Returns:
        TokenResponse with access token and user data
        
    Raises:
        HTTPException: If credentials are invalid
    """
    # Authenticate user
    db_user = authenticate_user(db, credentials.email, credentials.password)
    
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create JWT token with user ID as subject
    access_token = create_access_token(data={"sub": db_user.id})
    
    # Convert DB user to Pydantic model
    user = db_user_to_pydantic(db_user)
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user
    )


@router.get("/me", response_model=User)
async def get_me(
    current_user: UserDB = Depends(get_current_user)
) -> User:
    """
    Get current authenticated user information.
    
    Args:
        current_user: Current authenticated user from JWT token
        
    Returns:
        Current user data
    """
    return db_user_to_pydantic(current_user)


@router.post("/logout")
async def logout(
    current_user: UserDB = Depends(get_current_user)
) -> dict:
    """
    Logout current user.
    
    Note: Since we're using stateless JWT tokens, this endpoint primarily
    serves as a confirmation. The client should discard the token.
    In a production system with token blacklisting, we would add the
    token to a blacklist here.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Success message
    """
    return {"message": "Successfully logged out"}
