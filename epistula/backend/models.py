from enum import Enum
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


class UserRole(str, Enum):
    """User role enumeration"""
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"
    ROOT = "root"  # Super administrator (login restricted to local machine)


class Permission(str, Enum):
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
        elif role == UserRole.TEACHER:
            return cls.TEACHER_PERMISSIONS
        elif role == UserRole.ADMIN:
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
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """Model for user updates"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    password: Optional[str] = Field(None, min_length=8, max_length=100)


class User(UserBase):
    """Complete user model"""
    id: str
    created_at: datetime
    updated_at: datetime
    is_active: bool = True

    class Config:
        from_attributes = True


class Student(User):
    """Student user model with student-specific attributes"""
    role: UserRole = UserRole.STUDENT
    workspace_id: Optional[str] = None
    enrolled_subjects: List[str] = Field(default_factory=list)  # List of subject IDs
    pending_requests: List[str] = Field(default_factory=list)  # List of subject IDs

    def get_permissions(self) -> List[Permission]:
        return RolePermissions.STUDENT_PERMISSIONS


class Teacher(User):
    """Teacher user model with teacher-specific attributes"""
    role: UserRole = UserRole.TEACHER
    created_subjects: List[str] = Field(default_factory=list)  # List of subject IDs

    def get_permissions(self) -> List[Permission]:
        return RolePermissions.TEACHER_PERMISSIONS


class Admin(User):
    """Admin user model with admin-specific attributes"""
    role: UserRole = UserRole.ADMIN

    def get_permissions(self) -> List[Permission]:
        return RolePermissions.ADMIN_PERMISSIONS


class Root(User):
    """Root user model with super administrator privileges.

    Note: Authorization for this user is further restricted in the login flow
    to only allow authentication from the local machine.
    """
    role: UserRole = UserRole.ROOT

    def get_permissions(self) -> List[Permission]:
        return RolePermissions.ROOT_PERMISSIONS


class TokenResponse(BaseModel):
    """Model for authentication token response"""
    access_token: str
    token_type: str = "bearer"
    user: User
