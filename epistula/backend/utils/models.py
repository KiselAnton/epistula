"""Data models for Epistula application.

This module contains:
- Pydantic models for API request/response validation
- SQLAlchemy ORM models for database operations
- Enums and permissions
"""

from enum import Enum as PyEnum
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.sql import func
from utils.database import Base


# ============================================================================
# Enums
# ============================================================================

class UserRole(str, PyEnum):
    """User role enumeration - matches database enum"""
    ROOT = "root"
    UNI_ADMIN = "uni_admin"
    PROFESSOR = "professor"
    STUDENT = "student"


class Permission(str, PyEnum):
    """Permission types for different roles"""
    # Student permissions
    VIEW_SUBJECTS = "view_subjects"
    REQUEST_SUBJECT_SIGNUP = "request_subject_signup"
    VIEW_LECTURES = "view_lectures"
    EDIT_NOTES = "edit_notes"
    VIEW_AI_PAGES = "view_ai_pages"
    CHANGE_OWN_PROFILE = "change_own_profile"

    # Teacher permissions
    CREATE_SUBJECTS = "create_subjects"
    CREATE_LECTURE_PAGES = "create_lecture_pages"
    SIGNUP_STUDENTS = "signup_students"
    MANAGE_SIGNUP_REQUESTS = "manage_signup_requests"
    EDIT_AI_PAGES = "edit_ai_pages"

    # Admin permissions
    MANAGE_ALL_USERS = "manage_all_users"
    VIEW_ALL = "view_all"
    RESET_PASSWORDS = "reset_passwords"


class RolePermissions:
    """Mapping of roles to their permissions"""

    STUDENT_PERMISSIONS = [
        Permission.VIEW_SUBJECTS,
        Permission.REQUEST_SUBJECT_SIGNUP,
        Permission.VIEW_LECTURES,
        Permission.EDIT_NOTES,
        Permission.VIEW_AI_PAGES,
        Permission.CHANGE_OWN_PROFILE,
    ]

    TEACHER_PERMISSIONS = [
        Permission.CREATE_SUBJECTS,
        Permission.CREATE_LECTURE_PAGES,
        Permission.SIGNUP_STUDENTS,
        Permission.MANAGE_SIGNUP_REQUESTS,
        Permission.EDIT_AI_PAGES,
        Permission.CHANGE_OWN_PROFILE,
        Permission.VIEW_SUBJECTS,
        Permission.VIEW_LECTURES,
        Permission.VIEW_AI_PAGES,
    ]

    ADMIN_PERMISSIONS = TEACHER_PERMISSIONS + [
        Permission.MANAGE_ALL_USERS,
        Permission.VIEW_ALL,
        Permission.RESET_PASSWORDS,
    ]

    # Root has at least all admin permissions; can be extended later
    ROOT_PERMISSIONS = ADMIN_PERMISSIONS

    @classmethod
    def get_permissions(cls, role: UserRole) -> List[Permission]:
        """Get permissions for a given role"""
        if role == UserRole.STUDENT:
            return cls.STUDENT_PERMISSIONS
        elif role == UserRole.PROFESSOR:
            return cls.TEACHER_PERMISSIONS
        elif role == UserRole.UNI_ADMIN:
            return cls.ADMIN_PERMISSIONS
        elif role == UserRole.ROOT:
            return cls.ROOT_PERMISSIONS
        return []


class UserBase(BaseModel):
    """Base user model with common attributes"""
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=100)
    role: UserRole


class UserCreate(UserBase):
    """Model for user creation"""
    password: str = Field(..., min_length=8, max_length=100)


class UserLogin(BaseModel):
    """Model for user login"""
    email: str  # Accept any string for login to avoid validation errors
    password: str


class UserUpdate(BaseModel):
    """Model for user updates"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    password: Optional[str] = Field(None, min_length=8, max_length=100)


class UniversityAccess(BaseModel):
    """University access information for a user"""
    university_id: int
    university_name: str
    university_code: str
    role: UserRole
    is_active: bool = True  # User's active status in this university
    logo_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class User(UserBase):
    """Complete user model"""
    id: str
    created_at: datetime
    updated_at: datetime
    is_active: bool = True
    universities: List[int] = []  # List of university IDs user has access to
    university_access: List[UniversityAccess] = []  # Detailed access info with roles
    primary_university_id: Optional[int] = None  # Main university for the user

    model_config = ConfigDict(from_attributes=True)


# Note: Student, Teacher, Admin, Root Pydantic models removed
# These will be replaced with proper role-based user context
# For now, User model with UserRole enum is sufficient


class TokenResponse(BaseModel):
    """Model for authentication token response"""
    access_token: str
    token_type: str = "bearer"
    user: User


# ============================================================================
# SQLAlchemy ORM Models
# ============================================================================

class UserDB(Base):
    """SQLAlchemy ORM model for users table"""
    __tablename__ = "users"
    __table_args__ = {"schema": "public"}
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_root = Column(Boolean, default=False, nullable=False)


class UniversityDB(Base):
    """SQLAlchemy ORM model for universities table"""
    __tablename__ = "universities"
    __table_args__ = {"schema": "public"}
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False, index=True)
    schema_name = Column(String(63), unique=True, nullable=False, index=True)
    description = Column(Text)
    logo_url = Column(String(500))  # URL or path to logo image
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)


class UserUniversityRoleDB(Base):
    """SQLAlchemy ORM model for user_university_roles table"""
    __tablename__ = "user_university_roles"
    __table_args__ = {"schema": "public"}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("public.users.id", ondelete="CASCADE"), nullable=False, index=True)
    university_id = Column(Integer, ForeignKey("public.universities.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(Enum("root", "uni_admin", "professor", "student", name="user_role", schema="public"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by = Column(Integer, ForeignKey("public.users.id", ondelete="SET NULL"))


# ============================================================================
# Pydantic Models for Universities
# ============================================================================

class UniversityBase(BaseModel):
    """Base university model"""
    name: str = Field(..., min_length=1, max_length=255)
    code: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None


class UniversityCreate(UniversityBase):
    """Model for university creation"""
    pass


class University(UniversityBase):
    """Complete university model"""
    id: int
    schema_name: str
    logo_url: Optional[str] = None
    created_at: datetime
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Faculty Models
# ============================================================================

class FacultyDB(Base):
    """SQLAlchemy ORM model for faculties table.
    
    Faculties are stored in each university's schema (uni_<id>).
    """
    __tablename__ = "faculties"
    # Note: __table_args__ with schema will be set dynamically when querying
    
    id = Column(Integer, primary_key=True, index=True)
    university_id = Column(Integer, nullable=False, index=True)  # Reference to public.universities
    name = Column(String(255), nullable=False)
    short_name = Column(String(50), nullable=False)
    code = Column(String(50), nullable=False, index=True)
    description = Column(Text)
    logo_url = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)


class FacultyBase(BaseModel):
    """Base faculty model"""
    name: str = Field(..., min_length=1, max_length=255)
    short_name: str = Field(..., min_length=1, max_length=50)
    code: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None


class FacultyCreate(FacultyBase):
    """Model for faculty creation"""
    pass


class Faculty(FacultyBase):
    """Complete faculty model"""
    id: int
    university_id: int
    logo_url: Optional[str] = None
    created_at: datetime
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)
