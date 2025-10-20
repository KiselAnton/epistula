"""Authentication and user management module for Epistula ISO.

This module provides user authentication, role-based access control,
and user management endpoints for the Epistula ISO application.
"""

from datetime import datetime
from typing import Dict, Optional
import hashlib
import secrets

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from models import (
    UserCreate, UserLogin, UserUpdate, User, Student, Teacher, Admin,
    UserRole, TokenResponse, RolePermissions
)

# Create router
router = APIRouter(prefix="/api/v1/users", tags=["users"])
security = HTTPBearer()

# In-memory storage (replace with database in production)
users_db: Dict[str, User] = {}
tokens_db: Dict[str, str] = {}  # token -> user_id


def hash_password(password: str) -> str:
    """Hash password using SHA-256.

    Args:
        password: Plain text password to hash.

    Returns:
        str: Hexadecimal digest of hashed password.
    """
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against its hash.

    Args:
        plain_password: Plain text password to verify.
        hashed_password: Hashed password to compare against.

    Returns:
        bool: True if password matches hash, False otherwise.
    """
    return hash_password(plain_password) == hashed_password


def generate_token() -> str:
    """Generate secure random token.

    Returns:
        str: URL-safe random token.
    """
    return secrets.token_urlsafe(32)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    """Get current authenticated user from token.

    Args:
        credentials: HTTP Bearer authentication credentials.

    Returns:
        User: Authenticated user object.

    Raises:
        HTTPException: If token is invalid or user not found.
    """
    token = credentials.credentials
    user_id = tokens_db.get(token)

    if not user_id or user_id not in users_db:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return users_db[user_id]


def require_role(*allowed_roles: UserRole):
    """Create dependency to check if user has required role.

    Args:
        *allowed_roles: Variable length list of allowed user roles.

    Returns:
        Callable: Role checker dependency function.
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        """Check if current user has required role.

        Args:
            current_user: Current authenticated user.

        Returns:
            User: Current user if authorized.

        Raises:
            HTTPException: If user role not in allowed roles.
        """
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access forbidden. Required roles: "
                    f"{[r.value for r in allowed_roles]}"
                )
            )
        return current_user
    return role_checker


@router.post(
    "/register", response_model=User, status_code=status.HTTP_201_CREATED
)
async def register_user(user_data: UserCreate) -> User:
    """Register new user.

    Args:
        user_data: User registration data.

    Returns:
        User: Created user object.

    Raises:
        HTTPException: If email already registered or invalid role.
    """
    # Check if user already exists
    for user in users_db.values():
        if isinstance(user, (User, Student, Teacher, Admin)):
            if user.email == user_data.email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )

    # Generate user ID
    user_id = f"user_{len(users_db) + 1}"

    # Hash password
    hashed_pw = hash_password(user_data.password)

    # Create user based on role
    now = datetime.now()
    user_dict = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "role": user_data.role,
        "created_at": now,
        "updated_at": now,
        "is_active": True
    }

    if user_data.role == UserRole.STUDENT:
        user = Student(**user_dict)
    elif user_data.role == UserRole.TEACHER:
        user = Teacher(**user_dict)
    elif user_data.role == UserRole.ADMIN:
        user = Admin(**user_dict)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role"
        )

    # Store user and password hash
    users_db[user_id] = user
    users_db[f"{user_id}_pw"] = hashed_pw

    return user


@router.post("/login", response_model=TokenResponse)
async def login_user(credentials: UserLogin) -> TokenResponse:
    """Login user and receive authentication token.

    Args:
        credentials: User login credentials.

    Returns:
        TokenResponse: Authentication token and user data.

    Raises:
        HTTPException: If credentials are incorrect.
    """
    # Find user by email
    user = None
    user_id = None
    for uid, u in users_db.items():
        if isinstance(u, (User, Student, Teacher, Admin)):
            if u.email == credentials.email:
                user = u
                user_id = uid
                break

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Verify password
    stored_hash = users_db.get(f"{user_id}_pw")
    if not stored_hash or not verify_password(
        credentials.password, stored_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Generate token
    token = generate_token()
    tokens_db[token] = user_id

    return TokenResponse(access_token=token, user=user)


@router.get("/me", response_model=User)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current user information.

    Args:
        current_user: Current authenticated user.

    Returns:
        User: Current user data.
    """
    return current_user


@router.patch("/me", response_model=User)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user)
) -> User:
    """Update current user profile.

    Args:
        user_update: User update data.
        current_user: Current authenticated user.

    Returns:
        User: Updated user data.
    """
    if user_update.name:
        current_user.name = user_update.name

    if user_update.password:
        # Hash and update password
        hashed_pw = hash_password(user_update.password)
        users_db[f"{current_user.id}_pw"] = hashed_pw

    current_user.updated_at = datetime.now()
    users_db[current_user.id] = current_user

    return current_user


@router.get("/", response_model=list[User])
async def list_users(
    current_user: User = Depends(require_role(UserRole.ADMIN))
) -> list[User]:
    """List all users.

    Args:
        current_user: Current authenticated admin user.

    Returns:
        list[User]: List of all users.
    """
    return [
        u for uid, u in users_db.items()
        if isinstance(u, (User, Student, Teacher, Admin))
    ]


@router.get("/{user_id}", response_model=User)
async def get_user(
    user_id: str,
    current_user: User = Depends(
        require_role(UserRole.ADMIN, UserRole.TEACHER)
    )
) -> User:
    """Get user by ID.

    Args:
        user_id: Target user ID.
        current_user: Current authenticated user (admin or teacher).

    Returns:
        User: Requested user data.

    Raises:
        HTTPException: If user not found.
    """
    if user_id not in users_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    user = users_db[user_id]
    if not isinstance(user, (User, Student, Teacher, Admin)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return user


@router.patch("/{user_id}", response_model=User)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_user: User = Depends(require_role(UserRole.ADMIN))
) -> User:
    """Update any user profile.

    Args:
        user_id: Target user ID.
        user_update: User update data.
        current_user: Current authenticated admin user.

    Returns:
        User: Updated user data.

    Raises:
        HTTPException: If user not found.
    """
    if user_id not in users_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    user = users_db[user_id]
    if not isinstance(user, (User, Student, Teacher, Admin)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user_update.name:
        user.name = user_update.name

    if user_update.password:
        # Hash and update password (password reset)
        hashed_pw = hash_password(user_update.password)
        users_db[f"{user_id}_pw"] = hashed_pw

    user.updated_at = datetime.now()
    users_db[user_id] = user

    return user


@router.post("/assign-role/{user_id}", response_model=User)
async def assign_role(
    user_id: str,
    role: UserRole,
    current_user: User = Depends(require_role(UserRole.ADMIN))
) -> User:
    """Assign or change user role.

    Args:
        user_id: Target user ID.
        role: New role to assign.
        current_user: Current authenticated admin user.

    Returns:
        User: User with updated role.

    Raises:
        HTTPException: If user not found or invalid role.
    """
    if user_id not in users_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    old_user = users_db[user_id]
    if not isinstance(old_user, (User, Student, Teacher, Admin)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Create new user object with updated role
    user_dict = {
        "id": old_user.id,
        "email": old_user.email,
        "name": old_user.name,
        "role": role,
        "created_at": old_user.created_at,
        "updated_at": datetime.now(),
        "is_active": old_user.is_active
    }

    if role == UserRole.STUDENT:
        new_user = Student(**user_dict)
    elif role == UserRole.TEACHER:
        new_user = Teacher(**user_dict)
    elif role == UserRole.ADMIN:
        new_user = Admin(**user_dict)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role"
        )

    users_db[user_id] = new_user

    return new_user


@router.get("/permissions/me", response_model=list[str])
async def get_my_permissions(
    current_user: User = Depends(get_current_user)
) -> list[str]:
    """Get current user permissions based on their role.

    Args:
        current_user: Current authenticated user.

    Returns:
        list[str]: List of permission strings.
    """
    permissions = RolePermissions.get_permissions(current_user.role)
    return [p.value for p in permissions]
