"""User management endpoints for universities.

This module provides CRUD operations for managing users within universities,
including creating administrators, professors, and students.
"""

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.orm import Session

from middleware.auth import get_current_user, hash_password
from utils.database import get_db
from utils.models import UserRole, UserDB
from utils.minio_client import upload_file, delete_file
from minio.error import S3Error


router = APIRouter(prefix="/api/v1", tags=["users"])


# ============================================================================
# Pydantic Models
# ============================================================================

class UserCreate(BaseModel):
    """Request model for creating a new user"""
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: UserRole
    faculty_id: Optional[int] = None  # Required for students


class UserUpdate(BaseModel):
    """Request model for updating a user"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    password: Optional[str] = Field(None, min_length=6)
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    """Response model for user data"""
    id: int
    email: str
    name: str
    role: UserRole
    faculty_id: Optional[int] = None
    is_active: bool
    created_at: datetime


class UserListResponse(BaseModel):
    """Response model for user listing"""
    users: List[UserResponse]
    total: int


class SubjectItem(BaseModel):
    """Subject listing item for teaching/enrolled subjects by user"""
    id: int
    name: str
    code: str
    faculty_id: int
    faculty_name: Optional[str] = None
    # For professors
    can_edit: Optional[bool] = None
    assigned_at: Optional[datetime] = None
    # For students
    enrolled_at: Optional[datetime] = None
    status: Optional[str] = None


# ============================================================================
# Helper Functions
# ============================================================================

def validate_university_access(user: UserDB, university_id: int, db: Session) -> bool:
    """Validate that user has access to the university.
    
    Args:
        user: Current user from auth
        university_id: University ID to check
        db: Database session
        
    Returns:
        True if user has access
        
    Raises:
        HTTPException: If access denied
    """
    # Root user has access to everything
    if user.is_root:
        return True
    
    # Check if user has uni_admin role for this university
    result = db.execute(text("""
        SELECT 1 FROM public.user_university_roles
        WHERE user_id = :user_id 
        AND university_id = :university_id 
        AND role = 'uni_admin'
        AND is_active = TRUE
    """), {"user_id": user.id, "university_id": university_id})
    
    if not result.fetchone():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to manage users in this university"
        )
    
    return True


def get_university_schema(university_id: int, db: Session) -> str:
    """Get the schema name for a university.
    
    Args:
        university_id: University ID
        db: Database session
        
    Returns:
        Schema name (e.g., 'uni_1')
        
    Raises:
        HTTPException: If university not found
    """
    result = db.execute(text("""
        SELECT schema_name FROM public.universities 
        WHERE id = :university_id AND is_active = TRUE
    """), {"university_id": university_id})
    
    row = result.fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="University not found"
        )
    
    return row[0]


def ensure_user_profiles_table(schema_name: str, db: Session) -> None:
    """Ensure per-university user_profiles table exists."""
    db.execute(text(f"""
        CREATE TABLE IF NOT EXISTS {schema_name}.user_profiles (
            user_id INTEGER PRIMARY KEY,
            working_hours TEXT NULL,
            room VARCHAR(100) NULL,
            bio TEXT NULL,
            speciality VARCHAR(200) NULL,
            program VARCHAR(200) NULL,
            major VARCHAR(200) NULL,
            profile_image_url VARCHAR(500) NULL,
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        )
    """))
    db.commit()


# ============================================================================
# Endpoints
# ============================================================================

@router.post(
    "/universities/{university_id}/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED
)
def create_user(
    university_id: int,
    user_data: UserCreate,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new user in a university.
    
    Creates a user account and assigns them to the university with the specified role.
    For students, a faculty_id must be provided.
    
    Args:
        university_id: University ID
        user_data: User creation data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Created user data
        
    Raises:
        HTTPException: If validation fails or user creation fails
    """
    # Validate access
    validate_university_access(current_user, university_id, db)
    
    # Get university schema
    schema_name = get_university_schema(university_id, db)
    
    try:
        # Validate role-specific requirements
        if user_data.role == UserRole.STUDENT and not user_data.faculty_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Students must be assigned to a faculty"
            )
        
        # Validate faculty exists if provided
        if user_data.faculty_id:
            result = db.execute(text(f"""
                SELECT id FROM {schema_name}.faculties
                WHERE id = :faculty_id AND is_active = TRUE
            """), {"faculty_id": user_data.faculty_id})
            
            if not result.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Faculty not found"
                )
        
        # Check if email already exists
        result = db.execute(text("""
            SELECT id FROM public.users WHERE email = :email
        """), {"email": user_data.email})
        
        existing_user = result.fetchone()
        
        if existing_user:
            # User exists, check if already has role in this university
            user_id = existing_user[0]
            result = db.execute(text("""
                SELECT 1 FROM public.user_university_roles
                WHERE user_id = :user_id 
                AND university_id = :university_id 
                AND role = :role
            """), {
                "user_id": user_id,
                "university_id": university_id,
                "role": user_data.role.value
            })
            
            if result.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User already has this role in the university"
                )
        else:
            # Create new user
            password_hash = hash_password(user_data.password)
            
            result = db.execute(text("""
                INSERT INTO public.users (email, password_hash, name, is_active, is_root)
                VALUES (:email, :password_hash, :name, TRUE, FALSE)
                RETURNING id
            """), {
                "email": user_data.email,
                "password_hash": password_hash,
                "name": user_data.name
            })
            
            user_id = result.fetchone()[0]
        
        # Create user-university-role mapping
        result = db.execute(text("""
            INSERT INTO public.user_university_roles 
            (user_id, university_id, role, faculty_id, created_by, is_active)
            VALUES (:user_id, :university_id, :role, :faculty_id, :created_by, TRUE)
            RETURNING id, created_at
        """), {
            "user_id": user_id,
            "university_id": university_id,
            "role": user_data.role.value,
            "faculty_id": user_data.faculty_id,
            "created_by": current_user.id
        })
        
        mapping_result = result.fetchone()
        created_at = mapping_result[1]
        
        # If the created role is a student and a faculty_id is provided,
        # also auto-assign the student into that faculty's roster table.
        if user_data.role == UserRole.STUDENT and user_data.faculty_id:
            # Prevent duplicate assignment (unique constraint also protects this)
            exists = db.execute(text(f"""
                SELECT 1 FROM {schema_name}.faculty_students
                WHERE faculty_id = :faculty_id AND student_id = :student_id
            """), {"faculty_id": user_data.faculty_id, "student_id": user_id}).fetchone()
            if not exists:
                db.execute(text(f"""
                    INSERT INTO {schema_name}.faculty_students (faculty_id, student_id, assigned_by, is_active)
                    VALUES (:faculty_id, :student_id, :assigned_by, TRUE)
                """), {
                    "faculty_id": user_data.faculty_id,
                    "student_id": user_id,
                    "assigned_by": current_user.id
                })

        db.commit()
        
        return UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            role=user_data.role,
            faculty_id=user_data.faculty_id,
            is_active=True,
            created_at=created_at
        )
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )


@router.get(
    "/universities/{university_id}/users",
    response_model=UserListResponse
)
def list_users(
    university_id: int,
    role: Optional[str] = None,
    q: Optional[str] = None,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all users in a university, optionally filtered by role.
    
    Args:
        university_id: University ID
        role: Optional role filter (uni_admin, professor, student)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        List of users with their roles
    """
    # Validate access
    validate_university_access(current_user, university_id, db)
    
    try:
        # Build query with optional role and search filters
        # Note: We fetch ALL users (active and inactive) to allow management
        query = """
            SELECT 
                u.id, u.email, u.name, u.is_active,
                uur.role, uur.faculty_id, uur.created_at, uur.is_active as role_is_active
            FROM public.users u
            JOIN public.user_university_roles uur ON u.id = uur.user_id
            WHERE uur.university_id = :university_id
        """
        params = {"university_id": university_id}
        
        if role:
            # Validate role
            try:
                UserRole(role)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid role: {role}"
                )
            query += " AND uur.role = :role"
            params["role"] = role

        # Optional case-insensitive search by name or email
        if q:
            query += " AND (u.name ILIKE :pattern OR u.email ILIKE :pattern)"
            params["pattern"] = f"%{q}%"

        query += " ORDER BY u.created_at DESC"
        
        result = db.execute(text(query), params)
        rows = result.fetchall()
        
        users = []
        for row in rows:
            users.append(UserResponse(
                id=row[0],
                email=row[1],
                name=row[2],
                is_active=row[7],  # Use role_is_active from user_university_roles
                role=UserRole(row[4]),
                faculty_id=row[5],
                created_at=row[6]
            ))
        
        return UserListResponse(
            users=users,
            total=len(users)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list users: {str(e)}"
        )


@router.patch(
    "/universities/{university_id}/users/{user_id}",
    response_model=UserResponse
)
def update_user(
    university_id: int,
    user_id: int,
    update_data: UserUpdate,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user details (name, password, or status).
    
    Args:
        university_id: University ID
        user_id: User ID to update
        update_data: Fields to update (name, password, is_active)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Updated user data
    """
    # Validate access
    validate_university_access(current_user, university_id, db)
    
    try:
        # Check if user exists in this university
        result = db.execute(text("""
            SELECT u.email, u.name, uur.role, uur.faculty_id, uur.created_at, uur.is_active
            FROM public.users u
            JOIN public.user_university_roles uur ON u.id = uur.user_id
            WHERE u.id = :user_id AND uur.university_id = :university_id
        """), {"user_id": user_id, "university_id": university_id})
        
        row = result.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found in this university"
            )
        
        email, name, role, faculty_id, created_at, is_active = row
        
        # Update user details in users table if name or password provided
        if update_data.name or update_data.password:
            update_fields = []
            update_params = {"user_id": user_id}
            
            if update_data.name:
                update_fields.append("name = :name")
                update_params["name"] = update_data.name
                name = update_data.name
            
            if update_data.password:
                update_fields.append("password_hash = :password_hash")
                update_params["password_hash"] = hash_password(update_data.password)
            
            if update_fields:
                query = f"""
                    UPDATE public.users
                    SET {', '.join(update_fields)}
                    WHERE id = :user_id
                """
                db.execute(text(query), update_params)
        
        # Update status in user_university_roles table if provided
        if update_data.is_active is not None:
            db.execute(text("""
                UPDATE public.user_university_roles
                SET is_active = :is_active
                WHERE user_id = :user_id AND university_id = :university_id
            """), {
                "is_active": update_data.is_active,
                "user_id": user_id,
                "university_id": university_id
            })
            is_active = update_data.is_active
        
        db.commit()
        
        return UserResponse(
            id=user_id,
            email=email,
            name=name,
            role=UserRole(role),
            faculty_id=faculty_id,
            is_active=is_active,
            created_at=created_at
        )
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user: {str(e)}"
        )


@router.delete(
    "/universities/{university_id}/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_user(
    university_id: int,
    user_id: int,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a user from a university (soft delete by deactivating).
    
    Args:
        university_id: University ID
        user_id: User ID to remove
        current_user: Current authenticated user
        db: Database session
    """
    # Validate access
    validate_university_access(current_user, university_id, db)
    
    try:
        # Check if user exists in this university
        result = db.execute(text("""
            SELECT 1 FROM public.user_university_roles
            WHERE user_id = :user_id AND university_id = :university_id
        """), {"user_id": user_id, "university_id": university_id})
        
        if not result.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found in this university"
            )
        
        # Soft delete by deactivating
        db.execute(text("""
            UPDATE public.user_university_roles
            SET is_active = FALSE
            WHERE user_id = :user_id AND university_id = :university_id
        """), {"user_id": user_id, "university_id": university_id})
        
        db.commit()
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete user: {str(e)}"
        )


@router.get(
    "/universities/{university_id}/users/{user_id}",
    response_model=UserResponse
)
def get_user(
    university_id: int,
    user_id: int,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single user's details within a university.
    
    Returns the user's name, email, role within the university, faculty_id (if any),
    role active status, and the assignment creation time.
    """
    # Validate access
    validate_university_access(current_user, university_id, db)

    try:
        result = db.execute(text("""
            SELECT u.id, u.email, u.name,
                   uur.role, uur.faculty_id, uur.created_at, uur.is_active
            FROM public.users u
            JOIN public.user_university_roles uur ON u.id = uur.user_id
            WHERE u.id = :user_id AND uur.university_id = :university_id
        """), {"user_id": user_id, "university_id": university_id})

        row = result.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found in this university"
            )

        return UserResponse(
            id=row[0],
            email=row[1],
            name=row[2],
            role=UserRole(row[3]),
            faculty_id=row[4],
            created_at=row[5],
            is_active=row[6],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user: {str(e)}"
        )


@router.get(
    "/universities/{university_id}/users/{user_id}/teaching-subjects",
    response_model=List[SubjectItem]
)
def list_teaching_subjects(
    university_id: int,
    user_id: int,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List subjects taught by a professor within a university.

    Only returns subjects where the user is assigned as a professor via subject_professors.
    If the user does not have an active professor role in this university, returns an empty list.
    """
    # Validate access: allow root/uni_admin OR the user themselves
    try:
        validate_university_access(current_user, university_id, db)
    except HTTPException:
        if current_user.id != user_id:
            raise

    # Get schema for this university
    schema_name = get_university_schema(university_id, db)

    # Ensure the target user has an active professor role in this university
    role_row = db.execute(text("""
        SELECT 1 FROM public.user_university_roles
        WHERE user_id = :user_id AND university_id = :university_id
          AND role = 'professor' AND is_active = TRUE
    """), {"user_id": user_id, "university_id": university_id}).fetchone()

    if not role_row:
        return []

    # Fetch subjects taught by the professor
    rows = db.execute(text(f"""
        SELECT s.id, s.name, s.code, s.faculty_id, f.name AS faculty_name,
               sp.assigned_at, sp.is_active
        FROM {schema_name}.subject_professors sp
        JOIN {schema_name}.subjects s ON sp.subject_id = s.id
        JOIN {schema_name}.faculties f ON s.faculty_id = f.id
        WHERE sp.professor_id = :user_id
        ORDER BY f.name ASC, s.name ASC
    """), {"user_id": user_id}).fetchall()

    subjects: List[SubjectItem] = []
    for r in rows:
        subjects.append(SubjectItem(
            id=r[0],
            name=r[1],
            code=r[2],
            faculty_id=r[3],
            faculty_name=r[4],
            assigned_at=r[5],
            can_edit=True  # Professors assigned to a subject can edit it
        ))

    return subjects


@router.get(
    "/universities/{university_id}/users/{user_id}/profile",
    response_model=dict
)
def get_user_profile(
    university_id: int,
    user_id: int,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get an extended profile for a user in a university.

    Allows root/uni_admin or the user themselves.
    """
    # Allow root/uni_admin or self
    try:
        validate_university_access(current_user, university_id, db)
    except HTTPException:
        if current_user.id != user_id:
            raise

    schema_name = get_university_schema(university_id, db)
    ensure_user_profiles_table(schema_name, db)

    row = db.execute(text(f"""
        SELECT user_id, working_hours, room, bio, speciality, program, major, profile_image_url, updated_at
        FROM {schema_name}.user_profiles WHERE user_id = :uid
    """), {"uid": user_id}).fetchone()

    if not row:
        # Return empty profile if none exists yet
        return {
            "user_id": user_id,
            "working_hours": None,
            "room": None,
            "bio": None,
            "speciality": None,
            "program": None,
            "major": None,
            "profile_image_url": None,
            "updated_at": None,
        }

    return {
        "user_id": row[0],
        "working_hours": row[1],
        "room": row[2],
        "bio": row[3],
        "speciality": row[4],
        "program": row[5],
        "major": row[6],
        "profile_image_url": row[7],
        "updated_at": row[8].isoformat() if row[8] else None,
    }


@router.patch(
    "/universities/{university_id}/users/{user_id}/profile",
    response_model=dict
)
def update_user_profile(
    university_id: int,
    user_id: int,
    payload: dict,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create or update a user's extended profile.

    Allows root/uni_admin or the user themselves.
    """
    # Allow root/uni_admin or self
    try:
        validate_university_access(current_user, university_id, db)
    except HTTPException:
        if current_user.id != user_id:
            raise

    schema_name = get_university_schema(university_id, db)
    ensure_user_profiles_table(schema_name, db)

    fields = {
        "working_hours": payload.get("working_hours"),
        "room": payload.get("room"),
        "bio": payload.get("bio"),
        "speciality": payload.get("speciality"),
        "program": payload.get("program"),
        "major": payload.get("major"),
    }

    # Upsert logic
    set_clause = ", ".join([f"{k} = :{k}" for k in fields.keys()])
    params = {**fields, "uid": user_id}
    try:
        # Try update first
        res = db.execute(text(f"""
            UPDATE {schema_name}.user_profiles
            SET {set_clause}, updated_at = NOW()
            WHERE user_id = :uid
            RETURNING user_id
        """), params).fetchone()
        if not res:
            # Insert
            insert_cols = ", ".join(["user_id"] + list(fields.keys()))
            insert_vals = ", ".join([":uid"] + [f":{k}" for k in fields.keys()])
            db.execute(text(f"""
                INSERT INTO {schema_name}.user_profiles ({insert_cols})
                VALUES ({insert_vals})
            """), params)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")

    # Return updated
    return get_user_profile(university_id, user_id, current_user, db)


@router.post(
    "/universities/{university_id}/users/{user_id}/profile-image",
    response_model=dict
)
async def upload_profile_image(
    university_id: int,
    user_id: int,
    file: UploadFile = File(...),
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload or replace a user's profile image in a university.

    Allows root/uni_admin or the user themselves.
    """
    try:
        validate_university_access(current_user, university_id, db)
    except HTTPException:
        if current_user.id != user_id:
            raise

    schema_name = get_university_schema(university_id, db)
    ensure_user_profiles_table(schema_name, db)

    allowed = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, WebP")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB")
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}.get(file.content_type, "jpg")
    object_name = f"avatars/u{user_id}-uni{university_id}.{ext}"

    # Fetch old url
    row = db.execute(text(f"SELECT profile_image_url FROM {schema_name}.user_profiles WHERE user_id = :uid"), {"uid": user_id}).fetchone()
    old_url = row[0] if row else None
    try:
        if old_url:
            try:
                delete_file(old_url.replace("/storage/", ""))
            except S3Error:
                pass
        image_url = upload_file(file_data=content, object_name=object_name, content_type=file.content_type)
        # Upsert url
        updated = db.execute(text(f"""
            UPDATE {schema_name}.user_profiles
            SET profile_image_url = :url, updated_at = NOW()
            WHERE user_id = :uid
            RETURNING user_id
        """), {"url": image_url, "uid": user_id}).fetchone()
        if not updated:
            db.execute(text(f"""
                INSERT INTO {schema_name}.user_profiles(user_id, profile_image_url)
                VALUES(:uid, :url)
            """), {"uid": user_id, "url": image_url})
        db.commit()
        return get_user_profile(university_id, user_id, current_user, db)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to upload profile image: {str(e)}")


@router.delete(
    "/universities/{university_id}/users/{user_id}/profile-image",
    response_model=dict
)
def delete_profile_image(
    university_id: int,
    user_id: int,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a user's profile image in a university.

    Allows root/uni_admin or the user themselves.
    """
    try:
        validate_university_access(current_user, university_id, db)
    except HTTPException:
        if current_user.id != user_id:
            raise

    schema_name = get_university_schema(university_id, db)
    ensure_user_profiles_table(schema_name, db)

    row = db.execute(text(f"SELECT profile_image_url FROM {schema_name}.user_profiles WHERE user_id = :uid"), {"uid": user_id}).fetchone()
    if not row or not row[0]:
        return get_user_profile(university_id, user_id, current_user, db)
    url = row[0]
    try:
        try:
            delete_file(url.replace("/storage/", ""))
        except S3Error:
            pass
        db.execute(text(f"UPDATE {schema_name}.user_profiles SET profile_image_url = NULL, updated_at = NOW() WHERE user_id = :uid"), {"uid": user_id})
        db.commit()
        return get_user_profile(university_id, user_id, current_user, db)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete profile image: {str(e)}")


@router.get(
    "/universities/{university_id}/users/{user_id}/enrolled-subjects",
    response_model=List[SubjectItem]
)
def list_enrolled_subjects(
    university_id: int,
    user_id: int,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List subjects a student is enrolled in within a university.

    Only returns subjects where the user is enrolled via subject_students.
    If the user does not have an active student role in this university, returns an empty list.
    """
    # Validate access: allow root/uni_admin OR the user themselves
    try:
        validate_university_access(current_user, university_id, db)
    except HTTPException:
        if current_user.id != user_id:
            raise

    # Get schema for this university
    schema_name = get_university_schema(university_id, db)

    # Ensure the target user has an active student role in this university
    role_row = db.execute(text("""
        SELECT 1 FROM public.user_university_roles
        WHERE user_id = :user_id AND university_id = :university_id
          AND role = 'student' AND is_active = TRUE
    """), {"user_id": user_id, "university_id": university_id}).fetchone()

    if not role_row:
        return []

    # Fetch subjects the student is enrolled in
    rows = db.execute(text(f"""
        SELECT s.id, s.name, s.code, s.faculty_id, f.name AS faculty_name,
               ss.enrolled_at, ss.status
        FROM {schema_name}.subject_students ss
        JOIN {schema_name}.subjects s ON ss.subject_id = s.id
        JOIN {schema_name}.faculties f ON s.faculty_id = f.id
        WHERE ss.student_id = :user_id
        ORDER BY f.name ASC, s.name ASC
    """), {"user_id": user_id}).fetchall()

    subjects: List[SubjectItem] = []
    for r in rows:
        subjects.append(SubjectItem(
            id=r[0],
            name=r[1],
            code=r[2],
            faculty_id=r[3],
            faculty_name=r[4],
            enrolled_at=r[5],
            status=r[6]
        ))

    return subjects
