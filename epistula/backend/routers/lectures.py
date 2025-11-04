"""Lectures API endpoints for Epistula.

Manages lectures within subjects. Lectures can contain content (files, links, text).
"""
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import text
from sqlalchemy.orm import Session

from utils.database import get_db
from utils.models import UniversityDB, UserDB
from middleware.auth import get_current_user


router = APIRouter(prefix="/api/v1/subjects", tags=["lectures"])


# ============================================================================
# Pydantic Models
# ============================================================================

class LectureCreate(BaseModel):
    """Request model for creating a lecture"""
    title: str
    description: Optional[str] = None
    # The current schema doesn't support scheduling/duration yet; kept for API compatibility
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    content: Optional[str] = None  # Markdown content
    lecture_number: Optional[int] = None


class LectureUpdate(BaseModel):
    """Request model for updating a lecture"""
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    is_active: Optional[bool] = None
    
    @field_validator("title")
    @classmethod
    def validate_title(cls, v):
        if v is not None and not v.strip():
            raise ValueError("Title cannot be empty or whitespace-only")
        return v


class Lecture(BaseModel):
    """Response model for lecture"""
    id: int
    subject_id: int
    title: str
    description: Optional[str]
    scheduled_at: Optional[datetime]
    duration_minutes: Optional[int]
    created_at: datetime
    created_by: int
    is_active: bool
    lecture_number: Optional[int] = None
    content: Optional[str] = None  # Latest content if available


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/{university_id}/{faculty_id}/{subject_id}/lectures", response_model=List[Lecture])
def list_lectures(
    university_id: int,
    faculty_id: int,
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
) -> List[Lecture]:
    """List all lectures for a subject."""
    # Get university and schema
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found"
        )
    
    schema_name = uni.schema_name
    
    # Check if subject exists and professor has access
    check_query = text(f"""
        SELECT id FROM {schema_name}.subjects 
        WHERE id = :subject_id AND faculty_id = :faculty_id
    """)
    result = db.execute(check_query, {"subject_id": subject_id, "faculty_id": faculty_id})
    if not result.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subject with ID {subject_id} not found"
        )
    
    # Check if professor has access to this faculty
    if not current_user.is_root:
        user_role = db.execute(text("""
            SELECT role FROM public.user_university_roles
            WHERE user_id = :user_id AND university_id = :university_id AND is_active = TRUE
        """), {"user_id": current_user.id, "university_id": university_id}).fetchone()
        
        # If user is a professor, verify they're assigned to this faculty
        if user_role and user_role[0] == 'professor':
            faculty_access = db.execute(text(f"""
                SELECT 1 FROM {schema_name}.faculty_professors
                WHERE professor_id = :professor_id 
                    AND faculty_id = :faculty_id 
                    AND is_active = TRUE
            """), {"professor_id": current_user.id, "faculty_id": faculty_id}).fetchone()
            
            if not faculty_access:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have access to this faculty"
                )
    
    # Determine visibility: admins/root and assigned professors see all; others only published
    show_all = False
    if current_user.is_root:
        show_all = True
    else:
        admin_row = db.execute(text("""
            SELECT 1 FROM public.user_university_roles
            WHERE user_id = :user_id AND university_id = :university_id
              AND role = 'uni_admin' AND is_active = TRUE
        """), {"user_id": current_user.id, "university_id": university_id}).fetchone()
        if admin_row:
            show_all = True
        else:
            prof_row = db.execute(text(f"""
                SELECT 1 FROM {schema_name}.subject_professors
                WHERE subject_id = :subject_id AND professor_id = :user_id AND is_active = TRUE
            """), {"subject_id": subject_id, "user_id": current_user.id}).fetchone()
            if prof_row:
                show_all = True

    # Get lectures (schema uses order_number & is_published instead of schedule/duration)
    base_sql = f"""
        SELECT 
            id, subject_id, title, description,
            created_at, created_by, is_published, order_number
        FROM {schema_name}.lectures
        WHERE subject_id = :subject_id
    """
    if not show_all:
        base_sql += " AND is_published = TRUE"
    base_sql += " ORDER BY order_number ASC, created_at DESC"

    result = db.execute(text(base_sql), {"subject_id": subject_id})
    lectures = []
    
    for row in result:
        lectures.append(Lecture(
            id=row[0],
            subject_id=row[1],
            title=row[2],
            description=row[3],
            scheduled_at=None,
            duration_minutes=None,
            created_at=row[4],
            created_by=row[5],
            is_active=bool(row[6]),
            lecture_number=row[7]
        ))
    
    return lectures


@router.post("/{university_id}/{faculty_id}/{subject_id}/lectures", response_model=Lecture, status_code=status.HTTP_201_CREATED)
def create_lecture(
    university_id: int,
    faculty_id: int,
    subject_id: int,
    payload: LectureCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
) -> Lecture:
    """Create a new lecture for a subject.
    
    Only professors assigned to the subject can create lectures.
    """
    # Get university and schema
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found"
        )
    
    schema_name = uni.schema_name
    
    # Check if subject exists
    check_query = text(f"""
        SELECT id FROM {schema_name}.subjects 
        WHERE id = :subject_id AND faculty_id = :faculty_id
    """)
    result = db.execute(check_query, {"subject_id": subject_id, "faculty_id": faculty_id})
    if not result.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subject with ID {subject_id} not found"
        )
    
    # Check if user is a professor assigned to this subject (or is root)
    if not current_user.is_root:
        prof_check = text(f"""
            SELECT id FROM {schema_name}.subject_professors
            WHERE subject_id = :subject_id AND professor_id = :user_id AND is_active = TRUE
        """)
        result = db.execute(prof_check, {"subject_id": subject_id, "user_id": current_user.id})
        if not result.fetchone():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only professors assigned to this subject can create lectures"
            )
    
    # Determine lecture number (order_number) if not provided
    lecture_num = payload.lecture_number
    if lecture_num is None:
        count_query = text(f"""
            SELECT COALESCE(MAX(order_number), 0) + 1
            FROM {schema_name}.lectures
            WHERE subject_id = :subject_id
        """)
        count_result = db.execute(count_query, {"subject_id": subject_id})
        lecture_num = count_result.scalar() or 1

    # Title: trim and validate (reject whitespace-only)
    raw_title = payload.title if payload and payload.title is not None else None
    title = raw_title.strip() if isinstance(raw_title, str) else None
    if not title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title cannot be empty"
        )

    # Normalize optional description
    description = payload.description.strip() if isinstance(payload.description, str) else payload.description

    # Create lecture (schema fields)
    insert_query = text(f"""
        INSERT INTO {schema_name}.lectures 
        (subject_id, title, description, order_number, created_by, is_published)
        VALUES (:subject_id, :title, :description, :order_number, :user_id, FALSE)
        RETURNING id, created_at, created_by, is_published
    """)
    result = db.execute(insert_query, {
        "subject_id": subject_id,
        "title": title,
        "description": description,
        "order_number": lecture_num,
        "user_id": current_user.id
    })
    
    row = result.fetchone()
    lecture_id = row[0]
    created_at = row[1]
    is_published = bool(row[3])
    
    # If content is provided, create lecture_content entry
    if payload.content:
        content_query = text(f"""
            INSERT INTO {schema_name}.lecture_content
            (lecture_id, content_type, content, version, created_by, created_at)
            VALUES (:lecture_id, 'markdown', :content, 1, :user_id, NOW())
        """)
        db.execute(content_query, {
            "lecture_id": lecture_id,
            "content": payload.content,
            "user_id": current_user.id
        })
    
    db.commit()
    
    return Lecture(
        id=lecture_id,
        subject_id=subject_id,
        title=title,
    description=description,
        scheduled_at=None,
        duration_minutes=None,
        created_at=created_at,
        created_by=current_user.id,
        is_active=is_published,
        lecture_number=lecture_num,
        content=payload.content
    )


@router.patch("/{university_id}/{faculty_id}/{subject_id}/lectures/{lecture_id}", response_model=Lecture)
def update_lecture(
    university_id: int,
    faculty_id: int,
    subject_id: int,
    lecture_id: int,
    payload: LectureUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
) -> Lecture:
    """Update a lecture."""
    # Get university and schema
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found"
        )
    
    schema_name = uni.schema_name
    
    # Check if lecture exists
    check_query = text(f"""
        SELECT id FROM {schema_name}.lectures
        WHERE id = :lecture_id AND subject_id = :subject_id
    """)
    result = db.execute(check_query, {"lecture_id": lecture_id, "subject_id": subject_id})
    if not result.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lecture with ID {lecture_id} not found"
        )

    # Permissions: root or uni_admin or assigned professor can update
    if not current_user.is_root:
        is_admin = db.execute(text("""
            SELECT 1 FROM public.user_university_roles
            WHERE user_id = :user_id AND university_id = :university_id
              AND role = 'uni_admin' AND is_active = TRUE
        """), {"user_id": current_user.id, "university_id": university_id}).fetchone()
        if not is_admin:
            is_prof = db.execute(text(f"""
                SELECT 1 FROM {schema_name}.subject_professors
                WHERE subject_id = :subject_id AND professor_id = :user_id AND is_active = TRUE
            """), {"subject_id": subject_id, "user_id": current_user.id}).fetchone()
            if not is_prof:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not allowed to update lectures for this subject",
                )
    
    # Build update query dynamically based on provided fields (map is_active -> is_published)
    update_fields = []
    params = {"lecture_id": lecture_id, "subject_id": subject_id}
    
    if payload.title is not None:
        update_fields.append("title = :title")
        params["title"] = payload.title
    if payload.description is not None:
        update_fields.append("description = :description")
        params["description"] = payload.description
    # scheduled_at/duration are not supported by the current schema
    if payload.is_active is not None:
        update_fields.append("is_published = :is_published")
        params["is_published"] = payload.is_active
    
    if not update_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    update_query = text(f"""
        UPDATE {schema_name}.lectures
        SET {', '.join(update_fields)}
        WHERE id = :lecture_id AND subject_id = :subject_id
        RETURNING id, subject_id, title, description, created_at, created_by, is_published, order_number
    """)
    
    result = db.execute(update_query, params)
    db.commit()
    
    row = result.fetchone()
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lecture {lecture_id} not found in subject {subject_id}"
        )
    
    return Lecture(
        id=row[0],
        subject_id=row[1],
        title=row[2],
        description=row[3],
        scheduled_at=None,
        duration_minutes=None,
        created_at=row[4],
        created_by=row[5],
        is_active=bool(row[6]),
        lecture_number=row[7]
    )


@router.delete("/{university_id}/{faculty_id}/{subject_id}/lectures/{lecture_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lecture(
    university_id: int,
    faculty_id: int,
    subject_id: int,
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Delete a lecture and all its content."""
    # Get university and schema
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found"
        )
    
    schema_name = uni.schema_name
    
    # Permissions: root or uni_admin or assigned professor can delete
    if not current_user.is_root:
        is_admin = db.execute(text("""
            SELECT 1 FROM public.user_university_roles
            WHERE user_id = :user_id AND university_id = :university_id
              AND role = 'uni_admin' AND is_active = TRUE
        """), {"user_id": current_user.id, "university_id": university_id}).fetchone()
        if not is_admin:
            is_prof = db.execute(text(f"""
                SELECT 1 FROM {schema_name}.subject_professors
                WHERE subject_id = :subject_id AND professor_id = :user_id AND is_active = TRUE
            """), {"subject_id": subject_id, "user_id": current_user.id}).fetchone()
            if not is_prof:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not allowed to delete lectures for this subject",
                )

    # Delete lecture (CASCADE will delete content)
    delete_query = text(f"""
        DELETE FROM {schema_name}.lectures
        WHERE id = :lecture_id AND subject_id = :subject_id
    """)
    result = db.execute(delete_query, {"lecture_id": lecture_id, "subject_id": subject_id})
    db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lecture not found"
        )
    
    return None
