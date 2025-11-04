"""Faculties API endpoints for Epistula.

Provides endpoints to manage faculties within universities.
Faculties are stored in each university's dedicated schema (uni_<id>).
Only university admins and root users can create/manage faculties.
"""
from typing import List, Optional
from pydantic import ValidationError

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy import text, Table, MetaData
from sqlalchemy.orm import Session

from utils.database import get_db
from utils.models import Faculty, FacultyCreate, FacultyDB, UniversityDB, UserUniversityRoleDB
from middleware.auth import get_current_user
from utils.models import UserDB
from utils.minio_client import upload_file, delete_file
from minio.error import S3Error

router = APIRouter(prefix="/api/v1/faculties", tags=["faculties"])


def get_faculty_table(schema_name: str, metadata: MetaData):
    """Get faculty table for a specific university schema.
    
    Args:
        schema_name: University schema name (e.g., "uni_1")
        metadata: SQLAlchemy metadata
        
    Returns:
        Table: Faculty table for the schema
    """
    from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
    from sqlalchemy.sql import func
    
    return Table(
        'faculties',
        metadata,
        Column('id', Integer, primary_key=True),
        Column('university_id', Integer, nullable=False),
        Column('name', String(255), nullable=False),
        Column('short_name', String(50), nullable=False),
        Column('code', String(50), nullable=False),
        Column('description', Text),
        Column('logo_url', String(500)),
        Column('created_at', DateTime(timezone=True), server_default=func.now()),
        Column('is_active', Boolean, default=True),
        schema=schema_name,
        extend_existing=True
    )


@router.get("/{university_id}", response_model=List[Faculty])
def list_faculties(
    university_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
) -> List[Faculty]:
    """List all faculties for a university.
    
    Args:
        university_id: ID of the university
        
    Returns:
        List of faculties
    """
    # Check if university exists
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found"
        )
    
    # Query faculties from university schema
    schema_name = uni.schema_name
    
    # Check user role for this university
    user_role = db.query(UserUniversityRoleDB).filter(
        UserUniversityRoleDB.user_id == current_user.id,
        UserUniversityRoleDB.university_id == university_id
    ).first()
    
    # Professors should only see faculties they're assigned to
    if user_role and user_role.role == "professor":
        query = text(f"""
            SELECT f.id, f.university_id, f.name, f.short_name, f.code, f.description, 
                   f.logo_url, f.created_at, f.is_active
            FROM {schema_name}.faculties f
            INNER JOIN {schema_name}.faculty_professors fp 
                ON f.id = fp.faculty_id
            WHERE fp.professor_id = :professor_id 
                AND fp.is_active = TRUE
            ORDER BY f.name ASC
        """)
        result = db.execute(query, {"professor_id": current_user.id})
    # Students should only see faculties where they have at least one enrolled subject
    elif user_role and user_role.role == "student":
        query = text(f"""
            SELECT DISTINCT f.id, f.university_id, f.name, f.short_name, f.code, f.description,
                            f.logo_url, f.created_at, f.is_active
            FROM {schema_name}.faculties f
            JOIN {schema_name}.subjects s ON s.faculty_id = f.id
            JOIN {schema_name}.subject_students ss ON ss.subject_id = s.id
            WHERE ss.student_id = :student_id
            ORDER BY f.name ASC
        """)
        result = db.execute(query, {"student_id": current_user.id})
    else:
        # Root and uni_admin can see all faculties
        query = text(f"""
            SELECT id, university_id, name, short_name, code, description, 
                   logo_url, created_at, is_active
            FROM {schema_name}.faculties
            ORDER BY name ASC
        """)
        result = db.execute(query)
        result = db.execute(query)
    
    faculties: List[Faculty] = []

    # Support both real SQLAlchemy Result (iterable) and test doubles
    rows = result.fetchall() if hasattr(result, "fetchall") else list(result)

    for row in rows:
        # Defensive normalization to tolerate legacy/dirty data
        name = (row[2] or "").strip()
        short_name = (row[3] or "").strip()
        code = ((row[4] or "").strip()).upper()
        description = None
        if isinstance(row[5], str):
            desc_str = row[5].strip()
            description = desc_str if desc_str else None

        # Skip records that don't satisfy minimal invariants
        if not name or not short_name or not code:
            continue

        try:
            faculties.append(Faculty(
                id=row[0],
                university_id=row[1],
                name=name,
                short_name=short_name,
                code=code,
                description=description,
                logo_url=row[6],
                created_at=row[7],
                is_active=row[8]
            ))
        except ValidationError:
            # If any row still violates the schema, skip it to avoid 500s
            continue
    
    return faculties


@router.post("/{university_id}", response_model=Faculty, status_code=status.HTTP_201_CREATED)
def create_faculty(
    university_id: int,
    payload: FacultyCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
) -> Faculty:
    """Create a new faculty in a university.
    
    Args:
        university_id: ID of the university
        payload: Faculty creation data
        
    Returns:
        Created faculty
    """
    # Check permissions (root or university admin)
    if not current_user.is_root:
        # Check if user is admin of this university
        admin_check = db.execute(text("""
            SELECT 1 FROM public.user_university_roles
            WHERE user_id = :user_id AND university_id = :university_id
              AND role = 'uni_admin' AND is_active = TRUE
        """), {"user_id": current_user.id, "university_id": university_id}).fetchone()
        
        if not admin_check:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only root or university admins can create faculties"
            )
    
    # Check if university exists
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found"
        )
    
    schema_name = uni.schema_name
    
    # Normalize and validate inputs
    name = payload.name.strip()
    short_name = payload.short_name.strip()
    code = payload.code.strip().upper()
    description = payload.description.strip() if isinstance(payload.description, str) else payload.description

    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name cannot be empty")
    if not short_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Short name cannot be empty")
    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code cannot be empty")

    # Check if code already exists
    check_query = text(f"""
        SELECT COUNT(*) FROM {schema_name}.faculties WHERE code = :code
    """)
    result = db.execute(check_query, {"code": code})
    if result.scalar() > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Faculty with code '{code}' already exists"
        )
    
    # Insert faculty
    insert_query = text(f"""
        INSERT INTO {schema_name}.faculties 
        (university_id, name, short_name, code, description, is_active)
        VALUES (:university_id, :name, :short_name, :code, :description, true)
        RETURNING id, university_id, name, short_name, code, description, 
                  logo_url, created_at, is_active
    """)
    
    result = db.execute(insert_query, {
        "university_id": university_id,
        "name": name,
        "short_name": short_name,
        "code": code,
        "description": description
    })
    
    db.commit()
    row = result.fetchone()
    
    return Faculty(
        id=row[0],
        university_id=row[1],
        name=row[2],
        short_name=row[3],
        code=row[4],
        description=row[5],
        logo_url=row[6],
        created_at=row[7],
        is_active=row[8]
    )


@router.delete("/{university_id}/{faculty_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_faculty(
    university_id: int,
    faculty_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Delete a faculty.
    
    Args:
        university_id: ID of the university
        faculty_id: ID of the faculty to delete
    """
    # Check permissions (root or university admin)
    if not current_user.is_root:
        # Check if user is admin of this university
        admin_check = db.execute(text("""
            SELECT 1 FROM public.user_university_roles
            WHERE user_id = :user_id AND university_id = :university_id
              AND role = 'uni_admin' AND is_active = TRUE
        """), {"user_id": current_user.id, "university_id": university_id}).fetchone()
        
        if not admin_check:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only root or university admins can delete faculties"
            )
    
    # Check if university exists
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found"
        )
    
    schema_name = uni.schema_name
    
    # Check if faculty exists and get logo_url for deletion
    select_query = text(f"""
        SELECT logo_url FROM {schema_name}.faculties WHERE id = :faculty_id
    """)
    result = db.execute(select_query, {"faculty_id": faculty_id})
    row = result.fetchone()
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Faculty with ID {faculty_id} not found"
        )
    
    # Delete logo from MinIO if exists
    if row[0]:
        object_name = row[0].replace("/storage/", "")
        try:
            delete_file(object_name)
        except S3Error:
            pass  # Ignore if file doesn't exist
    
    # Delete faculty
    delete_query = text(f"""
        DELETE FROM {schema_name}.faculties WHERE id = :faculty_id
    """)
    db.execute(delete_query, {"faculty_id": faculty_id})
    db.commit()
    
    return None


class FacultyUpdatePayload(FacultyCreate):
    """Update payload for faculty fields.
    Allows partial updates for name, short_name, code, and description.
    """
    name: Optional[str] = None
    short_name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[Optional[str]] = None


@router.patch("/{university_id}/{faculty_id}", response_model=Faculty)
def update_faculty(
    university_id: int,
    faculty_id: int,
    payload: FacultyUpdatePayload,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
) -> Faculty:
    """Update a faculty's basic fields.

    Requires root or administrator of the university.
    """
    # Permissions: root or uni admin
    if not current_user.is_root:
        is_admin = db.query(UserUniversityRoleDB).filter(
            UserUniversityRoleDB.user_id == current_user.id,
            UserUniversityRoleDB.university_id == university_id,
            UserUniversityRoleDB.role == "uni_admin",
        ).first()
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only root or university admins can update faculties",
            )

    # Ensure university exists
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found",
        )

    schema_name = uni.schema_name

    # Validate faculty exists
    select_query = text(f"""
        SELECT id, university_id, name, short_name, code, description,
               logo_url, created_at, is_active
        FROM {schema_name}.faculties
        WHERE id = :faculty_id
    """)
    res = db.execute(select_query, {"faculty_id": faculty_id})
    row = res.fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Faculty with ID {faculty_id} not found",
        )

    # Normalize inputs and collect updates only for provided fields
    updates = []
    params: dict = {"faculty_id": faculty_id}

    # Start from current values to compare and validate
    current_name, current_short, current_code, current_desc = row[2], row[3], row[4], row[5]

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name cannot be empty")
        if name != current_name:
            updates.append("name = :name")
            params["name"] = name

    if payload.short_name is not None:
        short_name = payload.short_name.strip()
        if not short_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Short name cannot be empty")
        if short_name != current_short:
            updates.append("short_name = :short_name")
            params["short_name"] = short_name

    if payload.code is not None:
        code = payload.code.strip().upper()
        if not code:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code cannot be empty")
        if code != current_code:
            # Ensure uniqueness when code is changing
            dup_check = text(f"SELECT id FROM {schema_name}.faculties WHERE code = :code AND id <> :id LIMIT 1")
            dup = db.execute(dup_check, {"code": code, "id": faculty_id}).fetchone()
            if dup:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Faculty with code '{code}' already exists")
            updates.append("code = :code")
            params["code"] = code

    if payload.description is not None:
        description = None
        if isinstance(payload.description, str):
            d = payload.description.strip()
            description = d if d else None
        # Only push update if actually changes
        if description != current_desc:
            updates.append("description = :description")
            params["description"] = description

    if not updates:
        # Nothing to update; return current row
        return Faculty(
            id=row[0],
            university_id=row[1],
            name=row[2],
            short_name=row[3],
            code=row[4],
            description=row[5],
            logo_url=row[6],
            created_at=row[7],
            is_active=row[8],
        )

    update_query = text(f"""
        UPDATE {schema_name}.faculties
        SET {', '.join(updates)}
        WHERE id = :faculty_id
        RETURNING id, university_id, name, short_name, code, description,
                  logo_url, created_at, is_active
    """)
    result = db.execute(update_query, params)
    db.commit()
    updated = result.fetchone()

    return Faculty(
        id=updated[0],
        university_id=updated[1],
        name=updated[2],
        short_name=updated[3],
        code=updated[4],
        description=updated[5],
        logo_url=updated[6],
        created_at=updated[7],
        is_active=updated[8],
    )


@router.post("/{university_id}/{faculty_id}/logo", response_model=Faculty)
async def upload_faculty_logo(
    university_id: int,
    faculty_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
) -> Faculty:
    """Upload a logo for a faculty.
    
    Args:
        university_id: ID of the university
        faculty_id: ID of the faculty
        file: Logo file
        
    Returns:
        Updated faculty
    """
    # Check permissions
    if not current_user.is_root:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only root or university admins can update faculty logos"
        )
    
    # Check if university exists
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found"
        )
    
    schema_name = uni.schema_name
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/svg+xml", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Allowed: JPEG, PNG, SVG, WebP"
        )
    
    # Validate file size (5MB max)
    max_size = 5 * 1024 * 1024
    file_content = await file.read()
    if len(file_content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 5MB"
        )
    
    # Determine file extension
    extension_map = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/svg+xml": "svg",
        "image/webp": "webp",
    }
    ext = extension_map.get(file.content_type, "jpg")
    
    # Generate object name for MinIO
    object_name = f"logos/faculty-{university_id}-{faculty_id}.{ext}"
    
    try:
        # Get old logo URL for deletion
        select_query = text(f"""
            SELECT logo_url FROM {schema_name}.faculties WHERE id = :faculty_id
        """)
        result = db.execute(select_query, {"faculty_id": faculty_id})
        row = result.fetchone()
        
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Faculty with ID {faculty_id} not found"
            )
        
        # Delete old logo if exists
        if row[0]:
            old_object_name = row[0].replace("/storage/", "")
            try:
                delete_file(old_object_name)
            except S3Error:
                pass
        
        # Upload to MinIO
        logo_url = upload_file(
            file_data=file_content,
            object_name=object_name,
            content_type=file.content_type
        )
        
        # Update faculty record
        update_query = text(f"""
            UPDATE {schema_name}.faculties 
            SET logo_url = :logo_url
            WHERE id = :faculty_id
            RETURNING id, university_id, name, short_name, code, description,
                      logo_url, created_at, is_active
        """)
        
        result = db.execute(update_query, {
            "logo_url": logo_url,
            "faculty_id": faculty_id
        })
        db.commit()
        
        row = result.fetchone()
        
        return Faculty(
            id=row[0],
            university_id=row[1],
            name=row[2],
            short_name=row[3],
            code=row[4],
            description=row[5],
            logo_url=row[6],
            created_at=row[7],
            is_active=row[8]
        )
        
    except S3Error as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload logo: {str(e)}"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error: {str(e)}"
        )


@router.delete("/{university_id}/{faculty_id}/logo", response_model=Faculty)
async def delete_faculty_logo(
    university_id: int,
    faculty_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
) -> Faculty:
    """Delete a faculty's logo.
    
    Removes the logo file from MinIO storage and clears the logo_url field.
    
    - Requires authenticated root or university admin
    - Returns the updated Faculty
    """
    # Verify user is root or admin of this university
    if not current_user.is_root:
        is_admin = db.query(UserUniversityRoleDB).filter(
            UserUniversityRoleDB.user_id == current_user.id,
            UserUniversityRoleDB.university_id == university_id,
            UserUniversityRoleDB.role == "uni_admin"
        ).first()
        
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only root or university admins can delete faculty logos"
            )
    
    # Get university schema
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found"
        )
    
    schema_name = uni.schema_name
    
    try:
        # Get faculty and its logo
        select_query = text(f"""
            SELECT id, university_id, name, short_name, code, description,
                   logo_url, created_at, is_active
            FROM {schema_name}.faculties
            WHERE id = :faculty_id
        """)
        
        result = db.execute(select_query, {"faculty_id": faculty_id})
        row = result.fetchone()
        
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Faculty with ID {faculty_id} not found"
            )
        
        logo_url = row[6]
        
        if not logo_url:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Faculty has no logo to delete"
            )
        
        # Delete from MinIO
        object_name = logo_url.replace("/storage/", "")
        try:
            delete_file(object_name)
        except S3Error:
            pass  # Ignore errors if file doesn't exist
        
        # Clear logo_url in database
        update_query = text(f"""
            UPDATE {schema_name}.faculties
            SET logo_url = NULL
            WHERE id = :faculty_id
            RETURNING id, university_id, name, short_name, code, description,
                      logo_url, created_at, is_active
        """)
        
        result = db.execute(update_query, {"faculty_id": faculty_id})
        db.commit()
        
        row = result.fetchone()
        
        return Faculty(
            id=row[0],
            university_id=row[1],
            name=row[2],
            short_name=row[3],
            code=row[4],
            description=row[5],
            logo_url=row[6],
            created_at=row[7],
            is_active=row[8]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete logo: {str(e)}"
        )

