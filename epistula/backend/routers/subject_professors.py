"""Subject Professors API endpoints for Epistula.

Manages professor assignments to subjects within faculties.
Only professors assigned to a faculty can be assigned to subjects in that faculty.
"""
from typing import List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from utils.database import get_db
from utils.models import UniversityDB, UserDB
from middleware.auth import get_current_user


router = APIRouter(prefix="/api/v1/subjects", tags=["subject-professors"])


# ============================================================================
# Pydantic Models
# ============================================================================

class SubjectProfessorAssign(BaseModel):
    """Request model for assigning a professor to a subject"""
    professor_id: int


class SubjectProfessor(BaseModel):
    """Response model for subject professor assignment"""
    id: int
    professor_id: int
    professor_name: str
    professor_email: str
    assigned_at: datetime
    is_active: bool


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/{university_id}/{faculty_id}/{subject_id}/professors", response_model=List[SubjectProfessor])
def list_subject_professors(
    university_id: int,
    faculty_id: int,
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
) -> List[SubjectProfessor]:
    """List all professors assigned to a subject."""
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
    
    # Get assigned professors
    query = text(f"""
        SELECT 
            sp.id, sp.professor_id, u.name, u.email,
            sp.assigned_at, sp.is_active
        FROM {schema_name}.subject_professors sp
        JOIN public.users u ON sp.professor_id = u.id
        WHERE sp.subject_id = :subject_id
        ORDER BY u.name ASC
    """)
    
    result = db.execute(query, {"subject_id": subject_id})
    professors = []
    
    for row in result:
        professors.append(SubjectProfessor(
            id=row[0],
            professor_id=row[1],
            professor_name=row[2],
            professor_email=row[3],
            assigned_at=row[4],
            is_active=row[5]
        ))
    
    return professors


@router.post("/{university_id}/{faculty_id}/{subject_id}/professors", response_model=SubjectProfessor, status_code=status.HTTP_201_CREATED)
def assign_professor_to_subject(
    university_id: int,
    faculty_id: int,
    subject_id: int,
    payload: SubjectProfessorAssign,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
) -> SubjectProfessor:
    """Assign a professor to a subject.
    
    The professor must be assigned to the faculty first.
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
    
    # Check if professor is assigned to the faculty
    faculty_check = text(f"""
        SELECT id FROM {schema_name}.faculty_professors
        WHERE faculty_id = :faculty_id AND professor_id = :professor_id AND is_active = TRUE
    """)
    result = db.execute(faculty_check, {"faculty_id": faculty_id, "professor_id": payload.professor_id})
    if not result.fetchone():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Professor must be assigned to the faculty before being assigned to subjects"
        )
    
    # Check if already assigned
    exists_query = text(f"""
        SELECT id FROM {schema_name}.subject_professors
        WHERE subject_id = :subject_id AND professor_id = :professor_id
    """)
    result = db.execute(exists_query, {"subject_id": subject_id, "professor_id": payload.professor_id})
    if result.fetchone():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Professor is already assigned to this subject"
        )
    
    # Assign professor
    insert_query = text(f"""
        INSERT INTO {schema_name}.subject_professors (subject_id, professor_id, assigned_at, is_active)
        VALUES (:subject_id, :professor_id, NOW(), TRUE)
        RETURNING id, assigned_at
    """)
    result = db.execute(insert_query, {
        "subject_id": subject_id,
        "professor_id": payload.professor_id
    })
    db.commit()
    
    row = result.fetchone()
    
    # Get professor details
    prof_query = text("""
        SELECT name, email FROM public.users WHERE id = :professor_id
    """)
    prof_result = db.execute(prof_query, {"professor_id": payload.professor_id})
    prof_row = prof_result.fetchone()
    
    return SubjectProfessor(
        id=row[0],
        professor_id=payload.professor_id,
        professor_name=prof_row[0],
        professor_email=prof_row[1],
        assigned_at=row[1],
        is_active=True
    )


@router.delete("/{university_id}/{faculty_id}/{subject_id}/professors/{professor_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_professor_from_subject(
    university_id: int,
    faculty_id: int,
    subject_id: int,
    professor_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Remove a professor from a subject."""
    # Get university and schema
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found"
        )
    
    schema_name = uni.schema_name
    
    # Delete assignment
    delete_query = text(f"""
        DELETE FROM {schema_name}.subject_professors
        WHERE subject_id = :subject_id AND professor_id = :professor_id
    """)
    result = db.execute(delete_query, {"subject_id": subject_id, "professor_id": professor_id})
    db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Professor assignment not found"
        )
    
    return None
