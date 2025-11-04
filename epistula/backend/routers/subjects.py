"""Subjects API endpoints for Epistula.

Provides endpoints to manage subjects within faculties.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from utils.database import get_db
from utils.models import UniversityDB, UserDB, UserUniversityRoleDB
from middleware.auth import get_current_user
from utils.minio_client import upload_file, delete_file
from minio.error import S3Error

router = APIRouter(prefix="/api/v1/subjects", tags=["subjects"])


@router.get("/{university_id}/{faculty_id}", response_model=List[dict])
def list_subjects(
    university_id: int,
    faculty_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
) -> List[dict]:
    """List all subjects for a faculty.
    
    Args:
        university_id: ID of the university
        faculty_id: ID of the faculty
    """
    # Check if university exists
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found"
        )
    
    schema_name = uni.schema_name
    # Ensure optional columns exist
    ensure_subject_logo_column(db, schema_name)
    
    # Check user role for this university
    user_role = db.query(UserUniversityRoleDB).filter(
        UserUniversityRoleDB.user_id == current_user.id,
        UserUniversityRoleDB.university_id == university_id
    ).first()
    
    # Professors should only see subjects in faculties they're assigned to
    if user_role and user_role.role == "professor":
        query = text(f"""
            SELECT 
                s.id,
                s.faculty_id,
                s.name,
                s.code,
                s.description,
                s.created_at,
                s.is_active,
                s.logo_url
            FROM {schema_name}.subjects s
            INNER JOIN {schema_name}.faculty_professors fp 
                ON s.faculty_id = fp.faculty_id
            WHERE s.faculty_id = :faculty_id
                AND fp.professor_id = :professor_id
                AND fp.is_active = TRUE
            ORDER BY s.code ASC
        """)
        result = db.execute(query, {"faculty_id": faculty_id, "professor_id": current_user.id})
    # Students should only see subjects they are enrolled to
    elif user_role and user_role.role == "student":
        query = text(f"""
            SELECT 
                s.id,
                s.faculty_id,
                s.name,
                s.code,
                s.description,
                s.created_at,
                s.is_active,
                s.logo_url
            FROM {schema_name}.subjects s
            JOIN {schema_name}.subject_students ss ON ss.subject_id = s.id
            WHERE s.faculty_id = :faculty_id
              AND ss.student_id = :student_id
            ORDER BY s.code ASC
        """)
        result = db.execute(query, {"faculty_id": faculty_id, "student_id": current_user.id})
    else:
        # Root and uni_admin can see all subjects
        query = text(f"""
            SELECT 
                s.id,
                s.faculty_id,
                s.name,
                s.code,
                s.description,
                s.created_at,
                s.is_active,
                s.logo_url
            FROM {schema_name}.subjects s
            WHERE s.faculty_id = :faculty_id
            ORDER BY s.code ASC
        """)
        result = db.execute(query, {"faculty_id": faculty_id})
    subjects = []
    
    for row in result:
        subjects.append({
            "id": row[0],
            "faculty_id": row[1],
            "name": row[2],
            "code": row[3],
            "description": row[4],
            "created_at": row[5].isoformat() if row[5] else None,
            "is_active": row[6],
            "logo_url": row[7]
        })
    
    return subjects


@router.post("/{university_id}/{faculty_id}", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_subject(
    university_id: int,
    faculty_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
) -> dict:
    """Create a new subject for a faculty.
    
    Args:
        university_id: ID of the university
        faculty_id: ID of the faculty
        payload: Subject data (name, code, description)
    """
    # Check permissions: root or university admin for this university
    if not current_user.is_root:
        is_admin = db.query(UserUniversityRoleDB).filter(
            UserUniversityRoleDB.user_id == current_user.id,
            UserUniversityRoleDB.university_id == university_id,
            UserUniversityRoleDB.role == "uni_admin",
        ).first()
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only root or university admins can create subjects"
            )
    
    # Check if university exists
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found"
        )
    
    schema_name = uni.schema_name
    ensure_subject_logo_column(db, schema_name)
    
    # Check if faculty exists
    faculty_check = text(f"""
        SELECT id FROM {schema_name}.faculties WHERE id = :faculty_id
    """)
    faculty_result = db.execute(faculty_check, {"faculty_id": faculty_id})
    if not faculty_result.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Faculty with ID {faculty_id} not found"
        )
    
    # Validate required fields
    name = payload.get("name", "").strip()
    code = payload.get("code", "").strip().upper()
    description = payload.get("description", "").strip() or None
    
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subject name is required"
        )
    
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subject code is required"
        )
    
    # Check if code already exists
    code_check = text(f"""
        SELECT id FROM {schema_name}.subjects WHERE code = :code
    """)
    code_result = db.execute(code_check, {"code": code})
    if code_result.fetchone():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Subject with code '{code}' already exists"
        )
    
    # Insert subject
    insert_query = text(f"""
        INSERT INTO {schema_name}.subjects 
        (faculty_id, name, code, description, created_by, is_active)
        VALUES (:faculty_id, :name, :code, :description, :created_by, TRUE)
        RETURNING id, faculty_id, name, code, description, created_at, is_active, logo_url
    """)
    
    result = db.execute(insert_query, {
        "faculty_id": faculty_id,
        "name": name,
        "code": code,
        "description": description,
        "created_by": current_user.id
    })
    
    row = result.fetchone()
    db.commit()
    
    return {
        "id": row[0],
        "faculty_id": row[1],
        "name": row[2],
        "code": row[3],
        "description": row[4],
        "created_at": row[5].isoformat() if row[5] else None,
        "is_active": row[6],
        "logo_url": row[7]
    }


@router.put("/{university_id}/{faculty_id}/{subject_id}", response_model=dict)
def update_subject(
    university_id: int,
    faculty_id: int,
    subject_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
) -> dict:
    """Update a subject.
    
    Args:
        university_id: ID of the university
        faculty_id: ID of the faculty
        subject_id: ID of the subject to update
        payload: Subject data (name, code, description, is_active)
    """
    # Check permissions: root OR uni_admin of the university OR professor assigned to this subject
    if not current_user.is_root:
        is_admin = db.query(UserUniversityRoleDB).filter(
            UserUniversityRoleDB.user_id == current_user.id,
            UserUniversityRoleDB.university_id == university_id,
            UserUniversityRoleDB.role == "uni_admin",
        ).first()
        if not is_admin:
            # We'll verify professor assignment after we resolve the university schema
            pass
    
    # Check if university exists
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found"
        )
    
    schema_name = uni.schema_name
    
    # If not root and not uni_admin, allow professors assigned to this subject to edit
    if not current_user.is_root:
        is_admin = db.query(UserUniversityRoleDB).filter(
            UserUniversityRoleDB.user_id == current_user.id,
            UserUniversityRoleDB.university_id == university_id,
            UserUniversityRoleDB.role == "uni_admin",
        ).first()
        if not is_admin:
            prof_check = text(f"""
                SELECT 1 FROM {schema_name}.subject_professors
                WHERE subject_id = :subject_id AND professor_id = :uid AND is_active = TRUE
            """)
            prof_ok = db.execute(prof_check, {"subject_id": subject_id, "uid": current_user.id}).fetchone()
            if not prof_ok:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only root, university admins, or assigned professors can update subjects"
                )
    ensure_subject_logo_column(db, schema_name)
    
    # Check if subject exists
    select_query = text(f"""
        SELECT id, name, code, description, is_active 
        FROM {schema_name}.subjects 
        WHERE id = :subject_id AND faculty_id = :faculty_id
    """)
    result = db.execute(select_query, {
        "subject_id": subject_id,
        "faculty_id": faculty_id
    })
    
    existing = result.fetchone()
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subject with ID {subject_id} not found in faculty {faculty_id}"
        )
    
    # Validate and prepare update fields
    name = payload.get("name", existing[1]).strip()
    code = payload.get("code", existing[2]).strip().upper()
    description = payload.get("description")
    is_active = payload.get("is_active", existing[4])
    
    # Handle description: empty string becomes None
    if description is not None:
        description = description.strip() if description else None
    else:
        description = existing[3]
    
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subject name is required"
        )
    
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subject code is required"
        )
    
    # Check if code is being changed and if new code already exists
    if code != existing[2]:
        code_check = text(f"""
            SELECT id FROM {schema_name}.subjects 
            WHERE code = :code AND id != :subject_id
        """)
        code_result = db.execute(code_check, {
            "code": code,
            "subject_id": subject_id
        })
        if code_result.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Subject with code '{code}' already exists"
            )
    
    # Update subject
    update_query = text(f"""
        UPDATE {schema_name}.subjects 
        SET name = :name,
            code = :code,
            description = :description,
            is_active = :is_active
        WHERE id = :subject_id
        RETURNING id, faculty_id, name, code, description, created_at, is_active, logo_url
    """)
    
    result = db.execute(update_query, {
        "name": name,
        "code": code,
        "description": description,
        "is_active": is_active,
        "subject_id": subject_id
    })
    
    row = result.fetchone()
    db.commit()
    
    return {
        "id": row[0],
        "faculty_id": row[1],
        "name": row[2],
        "code": row[3],
        "description": row[4],
        "created_at": row[5].isoformat() if row[5] else None,
        "is_active": row[6],
        "logo_url": row[7]
    }


def ensure_subject_logo_column(db: Session, schema_name: str):
    """Ensure subjects table has a logo_url column."""
    # Use literal schema name in SQL; can't use bind params in PL/pgSQL blocks for identifiers
    db.execute(text(f"""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = '{schema_name}' AND table_name = 'subjects' AND column_name = 'logo_url'
            ) THEN
                EXECUTE 'ALTER TABLE {schema_name}.subjects ADD COLUMN logo_url VARCHAR(500)';
            END IF;
        END$$;
    """))
    db.commit()


@router.post("/{university_id}/{faculty_id}/{subject_id}/logo", response_model=dict)
async def upload_subject_logo(
    university_id: int,
    faculty_id: int,
    subject_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
) -> dict:
    """Upload or replace a subject logo (root or uni_admin)."""
    if not current_user.is_root:
        # allow uni_admins
        admin = db.execute(text("""
            SELECT 1 FROM public.user_university_roles
            WHERE user_id = :uid AND university_id = :univid AND role = 'uni_admin' AND is_active = TRUE
        """), {"uid": current_user.id, "univid": university_id}).fetchone()
        if not admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only root or university admins can update subject logos")

    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(status_code=404, detail="University not found")
    schema_name = uni.schema_name

    # Validate subject exists
    subject_row = db.execute(text(f"SELECT id, logo_url FROM {schema_name}.subjects WHERE id = :sid AND faculty_id = :fid"), {"sid": subject_id, "fid": faculty_id}).fetchone()
    if not subject_row:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Ensure column exists
    ensure_subject_logo_column(db, schema_name)

    # Validate file
    allowed = ["image/jpeg", "image/png", "image/svg+xml", "image/webp"]
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, SVG, WebP")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB")
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/svg+xml": "svg", "image/webp": "webp"}.get(file.content_type, "jpg")
    object_name = f"logos/subject-{university_id}-{faculty_id}-{subject_id}.{ext}"

    try:
        # Delete old logo if exists
        if subject_row[1]:
            try:
                delete_file(subject_row[1].replace("/storage/", ""))
            except S3Error:
                pass
        logo_url = upload_file(file_data=content, object_name=object_name, content_type=file.content_type)
        updated = db.execute(text(f"""
            UPDATE {schema_name}.subjects
            SET logo_url = :logo
            WHERE id = :sid
            RETURNING id, faculty_id, name, code, description, created_at, is_active, logo_url
        """), {"logo": logo_url, "sid": subject_id}).fetchone()
        db.commit()
        return {
            "id": updated[0],
            "faculty_id": updated[1],
            "name": updated[2],
            "code": updated[3],
            "description": updated[4],
            "created_at": updated[5].isoformat() if updated[5] else None,
            "is_active": updated[6],
            "logo_url": updated[7],
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to upload logo: {str(e)}")


@router.delete("/{university_id}/{faculty_id}/{subject_id}/logo", response_model=dict)
async def delete_subject_logo(
    university_id: int,
    faculty_id: int,
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
) -> dict:
    """Remove subject logo (root or uni_admin)."""
    if not current_user.is_root:
        admin = db.execute(text("""
            SELECT 1 FROM public.user_university_roles
            WHERE user_id = :uid AND university_id = :univid AND role = 'uni_admin' AND is_active = TRUE
        """), {"uid": current_user.id, "univid": university_id}).fetchone()
        if not admin:
            raise HTTPException(status_code=403, detail="Only root or university admins can delete subject logos")

    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(status_code=404, detail="University not found")
    schema_name = uni.schema_name
    ensure_subject_logo_column(db, schema_name)

    row = db.execute(text(f"SELECT logo_url FROM {schema_name}.subjects WHERE id = :sid AND faculty_id = :fid"), {"sid": subject_id, "fid": faculty_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Subject not found")

    logo_url = row[0]
    if logo_url:
        try:
            delete_file(logo_url.replace("/storage/", ""))
        except S3Error:
            pass
    updated = db.execute(text(f"""
        UPDATE {schema_name}.subjects
        SET logo_url = NULL
        WHERE id = :sid
        RETURNING id, faculty_id, name, code, description, created_at, is_active, logo_url
    """), {"sid": subject_id}).fetchone()
    db.commit()
    return {
        "id": updated[0],
        "faculty_id": updated[1],
        "name": updated[2],
        "code": updated[3],
        "description": updated[4],
        "created_at": updated[5].isoformat() if updated[5] else None,
        "is_active": updated[6],
        "logo_url": updated[7],
    }


@router.delete("/{university_id}/{faculty_id}/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(
    university_id: int,
    faculty_id: int,
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Delete a subject.
    
    WARNING: This will also delete all lectures and content associated with the subject.
    
    Args:
        university_id: ID of the university
        faculty_id: ID of the faculty
        subject_id: ID of the subject to delete
    """
    # Check permissions: root or university admin for this university
    if not current_user.is_root:
        is_admin = db.query(UserUniversityRoleDB).filter(
            UserUniversityRoleDB.user_id == current_user.id,
            UserUniversityRoleDB.university_id == university_id,
            UserUniversityRoleDB.role == "uni_admin",
        ).first()
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only root or university admins can delete subjects"
            )
    
    # Check if university exists
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found"
        )
    
    schema_name = uni.schema_name
    
    # Check if subject exists
    select_query = text(f"""
        SELECT id FROM {schema_name}.subjects 
        WHERE id = :subject_id AND faculty_id = :faculty_id
    """)
    result = db.execute(select_query, {
        "subject_id": subject_id,
        "faculty_id": faculty_id
    })
    
    if not result.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subject with ID {subject_id} not found in faculty {faculty_id}"
        )
    
    # Delete subject (CASCADE will delete lectures, content, enrollments, etc.)
    delete_query = text(f"""
        DELETE FROM {schema_name}.subjects WHERE id = :subject_id
    """)
    db.execute(delete_query, {"subject_id": subject_id})
    db.commit()
    
    return None
