from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Dict, Optional
import hashlib
import secrets
from datetime import datetime

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
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return hash_password(plain_password) == hashed_password


def generate_token() -> str:
    """Generate a secure random token"""
    return secrets.token_urlsafe(32)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Get the current authenticated user from token"""
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
    """Dependency to check if user has required role"""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden. Required roles: {[r.value for r in allowed_roles]}"
            )
        return current_user
    return role_checker


@router.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
async def register_user(user_data: UserCreate):
    """
    Register a new user.
    
    - **email**: User's email address (must be unique)
    - **name**: User's full name
    - **password**: User's password (min 8 characters)
    - **role**: User role (student, teacher, or admin)
    """
    # Check if user already exists
    for user in users_db.values():
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
async def login_user(credentials: UserLogin):
    """
    Login user and receive authentication token.
    
    - **email**: User's email address
    - **password**: User's password
    """
    # Find user by email
    user = None
    for uid, u in users_db.items():
        if isinstance(u, (User, Student, Teacher, Admin)) and u.email == credentials.email:
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
    if not stored_hash or not verify_password(credentials.password, stored_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Generate token
    token = generate_token()
    tokens_db[token] = user_id
    
    return TokenResponse(access_token=token, user=user)


@router.get("/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current user information.
    Requires authentication.
    """
    return current_user


@router.patch("/me", response_model=User)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    Update current user's profile.
    Users can change their name and password.
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
async def list_users(current_user: User = Depends(require_role(UserRole.ADMIN))):
    """
    List all users.
    Admin only.
    """
    return [u for uid, u in users_db.items() if isinstance(u, (User, Student, Teacher, Admin))]


@router.get("/{user_id}", response_model=User)
async def get_user(
    user_id: str,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.TEACHER))
):
    """
    Get user by ID.
    Admin and Teacher only.
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
):
    """
    Update any user's profile.
    Admin only - can change names and reset passwords.
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
):
    """
    Assign or change a user's role.
    Admin only.
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
async def get_my_permissions(current_user: User = Depends(get_current_user)):
    """
    Get current user's permissions based on their role.
    """
    permissions = RolePermissions.get_permissions(current_user.role)
    return [p.value for p in permissions]
