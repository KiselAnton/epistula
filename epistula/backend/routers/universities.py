"""Universities API endpoints for Epistula.

Provides endpoints to list and create universities. Creation is restricted
to root users. University creation uses the database function
`create_university(name, code, description, created_by)` which creates
both the registry row and the dedicated schema (uni_<id>).
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from utils.database import get_db
from utils.models import University, UniversityCreate, UniversityDB, UserUniversityRoleDB
from pydantic import Field
from middleware.auth import get_current_user
from utils.models import UserDB
from utils.minio_client import upload_file, delete_file
from minio.error import S3Error

router = APIRouter(prefix="/api/v1/universities", tags=["universities"])


@router.get("/", response_model=List[University])
def list_universities(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
) -> List[University]:
    """List universities.

    - Root: returns all (active and inactive)
    - Non-root professors/admins: returns all (active and inactive)
    - Students: returns only active universities
    """
    # Root sees all
    if current_user.is_root:
        items = db.query(UniversityDB).order_by(UniversityDB.id.asc()).all()
        return items

    # Determine user's universities and role categories
    user_uni_rows = db.query(UserUniversityRoleDB.university_id, UserUniversityRoleDB.role).filter(
        UserUniversityRoleDB.user_id == current_user.id
    ).all()

    user_uni_ids = {int(r[0]) for r in user_uni_rows} if user_uni_rows else set()
    has_non_student_role = any((str(r[1]) in ("uni_admin", "professor")) for r in user_uni_rows)

    if not has_non_student_role:
        # Students: only active universities
        items = db.query(UniversityDB).filter(UniversityDB.is_active == True).order_by(UniversityDB.id.asc()).all()
        return items

    # Professors/Admins: show active unis plus any uni they belong to, plus their temp entries
    # Fetch production schemas for user's universities
    if user_uni_ids:
        prod_rows = db.query(UniversityDB.id, UniversityDB.schema_name).filter(UniversityDB.id.in_(user_uni_ids)).all()
        temp_schema_names = {f"{row[1]}_temp" for row in prod_rows}
    else:
        temp_schema_names = set()

    # Query: active OR id in user's unis OR schema_name in temp_schema_names
    from sqlalchemy import or_
    clauses = [UniversityDB.is_active == True]
    if user_uni_ids:
        clauses.append(UniversityDB.id.in_(list(user_uni_ids)))
    if temp_schema_names:
        clauses.append(UniversityDB.schema_name.in_(list(temp_schema_names)))

    items = db.query(UniversityDB).filter(or_(*clauses)).order_by(UniversityDB.id.asc()).all()
    return items


@router.post("/", response_model=University, status_code=status.HTTP_201_CREATED)
def create_university(
    payload: UniversityCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
) -> University:
    """Create a new university (root only).

    - Requires authenticated root user
    - Calls SQL function create_university(name, code, description, created_by)
    - Returns the created University
    """
    if not current_user.is_root:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only root can create universities")

    # Normalize and validate inputs
    trimmed_name = payload.name.strip()
    trimmed_code = payload.code.strip()
    if not trimmed_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name cannot be empty")
    if not trimmed_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code cannot be empty")

    normalized_code = trimmed_code.upper()
    normalized_description = (
        payload.description.strip() if isinstance(payload.description, str) else payload.description
    )

    # Call DB function to insert and create schema
    res = db.execute(
        text("SELECT create_university(:name, :code, :description, :created_by) AS id"),
        {
            "name": trimmed_name,
            "code": normalized_code,
            "description": normalized_description,
            "created_by": current_user.id,
        },
    )
    row = res.fetchone()
    if not row or row[0] is None:
        raise HTTPException(status_code=500, detail="Failed to create university")

    uni_id = int(row[0])
    
    # Commit the transaction
    db.commit()

    # Fetch and return created university
    uni = db.query(UniversityDB).filter(UniversityDB.id == uni_id).first()
    if not uni:
        # Fallback in extremely rare case
        raise HTTPException(status_code=500, detail="University created but not found")

    return uni


class UniversityUpdatePayload(UniversityCreate):
    """Update payload for university fields.
    Inherit fields (name, code, description) and allow partial updates.
    """
    # Enforce that if provided, name/code are non-empty strings
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    code: Optional[str] = Field(default=None, min_length=1, max_length=50)
    description: Optional[Optional[str]] = None


@router.patch("/{university_id}", response_model=University)
def update_university(
    university_id: int,
    payload: UniversityUpdatePayload,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
) -> University:
    """Update a university's basic fields (root only).

    Supports partial updates for name, code, and description.
    """
    # Allow root or university admins for this specific university
    if not current_user.is_root:
        is_admin = db.query(UserUniversityRoleDB).filter(
            UserUniversityRoleDB.user_id == current_user.id,
            UserUniversityRoleDB.university_id == university_id,
            UserUniversityRoleDB.role == "uni_admin",
        ).first()
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only root or university admins can update universities",
            )

    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found",
        )

    changed = False
    if payload.name is not None:
        trimmed_name = payload.name.strip()
        if not trimmed_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name cannot be empty")
        uni.name = trimmed_name
        changed = True
    if payload.code is not None:
        trimmed_code = payload.code.strip()
        if not trimmed_code:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code cannot be empty")
        # enforce uppercase code
        uni.code = trimmed_code.upper()
        changed = True
    if payload.description is not None:
        uni.description = payload.description
        changed = True

    if changed:
        db.commit()
        db.refresh(uni)

    return uni


@router.delete("/{university_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_university(
    university_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Delete a university (root only).
    
    WARNING: This permanently deletes:
    - The university record and logo
    - The entire university schema and all data within it
    - All faculties, their logos, and content
    - All users, courses, and content associated with the university
    
    This action CANNOT be undone!
    
    - Requires authenticated root user
    - Returns 204 No Content on success
    - Returns 404 if university not found
    """
    if not current_user.is_root:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Only root can delete universities"
        )
    
    # Check if university exists
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found"
        )
    
    schema_name = uni.schema_name
    
    try:
        # Best-effort cleanup of objects stored in MinIO. For temp universities
        # or partially-initialized schemas, the schema/tables may not exist yet.
        # Guard these queries so deletion never fails due to missing objects.

        # 1) Check whether the schema exists
        schema_exists = db.execute(
            text(
                """
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.schemata
                    WHERE schema_name = :schema_name
                )
                """
            ),
            {"schema_name": schema_name},
        ).scalar()

        # 2) If schema exists, check whether faculties table exists before querying
        faculties_table_exists = False
        if schema_exists:
            faculties_table_exists = db.execute(
                text(
                    """
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_schema = :schema_name AND table_name = 'faculties'
                    )
                    """
                ),
                {"schema_name": schema_name},
            ).scalar()

        # 3) Delete all faculty logos from MinIO if the table exists
        if faculties_table_exists:
            faculty_logos_query = text(
                f"""
                SELECT logo_url FROM {schema_name}.faculties WHERE logo_url IS NOT NULL
                """
            )
            faculty_logos = db.execute(faculty_logos_query).fetchall()
            for (logo_url,) in faculty_logos:
                if logo_url:
                    object_name = logo_url.replace("/storage/", "")
                    try:
                        delete_file(object_name)
                    except S3Error:
                        # Ignore if file doesn't exist or storage is unavailable
                        pass

        # 4) Delete university logo from MinIO (if present)
        if uni.logo_url:
            object_name = uni.logo_url.replace("/storage/", "")
            try:
                delete_file(object_name)
            except S3Error:
                # Ignore if file doesn't exist or storage is unavailable
                pass

        # 5) Drop the university schema and all of its contents
        # CASCADE will drop all tables in the schema. Using IF EXISTS keeps this
        # safe for temp/partial schemas that may not have been fully created.
        db.execute(text(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE"))

        # 6) Delete the university record itself
        db.delete(uni)

        # Commit the transaction
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete university: {str(e)}"
        )
    
    return None


@router.post("/{university_id}/logo", response_model=University)
async def upload_university_logo(
    university_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
) -> University:
    """Upload a logo for a university (root only).
    
    Accepts image files (JPEG, PNG, SVG) up to 5MB.
    Saves the file to uploads/logos/{university_id}.{ext}
    Updates the university's logo_url field.
    
    - Requires authenticated root user
    - Returns the updated University
    """
    # Allow root or university admins to manage logos
    if not current_user.is_root:
        is_admin = db.query(UserUniversityRoleDB).filter(
            UserUniversityRoleDB.user_id == current_user.id,
            UserUniversityRoleDB.university_id == university_id,
            UserUniversityRoleDB.role == "uni_admin",
        ).first()
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only root or university admins can update university logos"
            )
    
    # Check if university exists
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found"
        )
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/svg+xml", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: JPEG, PNG, SVG, WebP"
        )
    
    # Validate file size (5MB max)
    max_size = 5 * 1024 * 1024  # 5MB in bytes
    file_content = await file.read()
    if len(file_content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is 5MB"
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
    object_name = f"logos/university-{university_id}.{ext}"
    
    try:
        # Delete old logo if exists
        if uni.logo_url:
            old_object_name = uni.logo_url.replace("/storage/", "")
            try:
                delete_file(old_object_name)
            except S3Error:
                pass  # Ignore errors if old file doesn't exist
        
        # Upload to MinIO
        logo_url = upload_file(
            file_data=file_content,
            object_name=object_name,
            content_type=file.content_type
        )
        
        # Update university record
        uni.logo_url = logo_url
        db.commit()
        db.refresh(uni)
        
        return uni
    except S3Error as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload logo to storage: {str(e)}"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save logo: {str(e)}"
        )


@router.delete("/{university_id}/logo", response_model=University)
async def delete_university_logo(
    university_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
) -> University:
    """Delete a university's logo (root or university admin).
    
    Removes the logo file from MinIO storage and clears the logo_url field.
    
    - Requires authenticated root or university admin user
    - Returns the updated University
    """
    if not current_user.is_root:
        is_admin = db.query(UserUniversityRoleDB).filter(
            UserUniversityRoleDB.user_id == current_user.id,
            UserUniversityRoleDB.university_id == university_id,
            UserUniversityRoleDB.role == "uni_admin",
        ).first()
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only root or university admins can delete university logos"
            )
    
    # Check if university exists
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found"
        )
    
    if not uni.logo_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="University has no logo to delete"
        )
    
    try:
        # Delete from MinIO
        object_name = uni.logo_url.replace("/storage/", "")
        try:
            delete_file(object_name)
        except S3Error:
            pass  # Ignore errors if file doesn't exist
        
        # Clear logo_url in database
        uni.logo_url = None
        db.commit()
        db.refresh(uni)
        
        return uni
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete logo: {str(e)}"
        )

