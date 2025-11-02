"""Subject Students API endpoints for Epistula.

Manages student enrollments in subjects within faculties.
Only students assigned to a faculty can enroll in subjects of that faculty.
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


router = APIRouter(prefix="/api/v1/subjects", tags=["subject-students"])


# ============================================================================
# Pydantic Models
# ============================================================================

class SubjectStudentEnroll(BaseModel):
    """Request model for enrolling a student in a subject"""
    student_id: int


class SubjectStudent(BaseModel):
    """Response model for subject student enrollment"""
    id: int
    student_id: int
    student_name: str
    student_email: str
    enrolled_at: datetime
    status: str


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/{university_id}/{faculty_id}/{subject_id}/students", response_model=List[SubjectStudent])
def list_subject_students(
    university_id: int,
    faculty_id: int,
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
) -> List[SubjectStudent]:
    """List all students enrolled in a subject."""
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
    
    # Get enrolled students
    query = text(f"""
        SELECT 
            ss.id, ss.student_id, u.name, u.email,
            ss.enrolled_at, ss.status
        FROM {schema_name}.subject_students ss
        JOIN public.users u ON ss.student_id = u.id
        WHERE ss.subject_id = :subject_id
        ORDER BY u.name ASC
    """)
    
    result = db.execute(query, {"subject_id": subject_id})
    students = []
    
    for row in result:
        students.append(SubjectStudent(
            id=row[0],
            student_id=row[1],
            student_name=row[2],
            student_email=row[3],
            enrolled_at=row[4],
            status=row[5]
        ))
    
    return students


@router.post("/{university_id}/{faculty_id}/{subject_id}/students", response_model=SubjectStudent, status_code=status.HTTP_201_CREATED)
def enroll_student_in_subject(
    university_id: int,
    faculty_id: int,
    subject_id: int,
    payload: SubjectStudentEnroll,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
) -> SubjectStudent:
    """Enroll a student in a subject.
    
    The student must be assigned to the faculty first.
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
    
    # Check if student is assigned to the faculty
    faculty_check = text(f"""
        SELECT id FROM {schema_name}.faculty_students
        WHERE faculty_id = :faculty_id AND student_id = :student_id AND is_active = TRUE
    """)
    result = db.execute(faculty_check, {"faculty_id": faculty_id, "student_id": payload.student_id})
    if not result.fetchone():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student must be assigned to the faculty before enrolling in subjects"
        )
    
    # Check if already enrolled
    exists_query = text(f"""
        SELECT id FROM {schema_name}.subject_students
        WHERE subject_id = :subject_id AND student_id = :student_id
    """)
    result = db.execute(exists_query, {"subject_id": subject_id, "student_id": payload.student_id})
    if result.fetchone():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student is already enrolled in this subject"
        )
    
    # Enroll student
    insert_query = text(f"""
        INSERT INTO {schema_name}.subject_students (subject_id, student_id, enrolled_at, enrolled_by, status)
        VALUES (:subject_id, :student_id, NOW(), :user_id, 'active')
        RETURNING id, enrolled_at
    """)
    result = db.execute(insert_query, {
        "subject_id": subject_id,
        "student_id": payload.student_id,
        "user_id": current_user.id
    })
    db.commit()
    
    row = result.fetchone()
    
    # Get student details
    student_query = text("""
        SELECT name, email FROM public.users WHERE id = :student_id
    """)
    student_result = db.execute(student_query, {"student_id": payload.student_id})
    student_row = student_result.fetchone()
    
    return SubjectStudent(
        id=row[0],
        student_id=payload.student_id,
        student_name=student_row[0],
        student_email=student_row[1],
        enrolled_at=row[1],
        status='active'
    )


@router.delete("/{university_id}/{faculty_id}/{subject_id}/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def unenroll_student_from_subject(
    university_id: int,
    faculty_id: int,
    subject_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Remove a student from a subject."""
    # Get university and schema
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found"
        )
    
    schema_name = uni.schema_name
    
    # Delete enrollment
    delete_query = text(f"""
        DELETE FROM {schema_name}.subject_students
        WHERE subject_id = :subject_id AND student_id = :student_id
    """)
    result = db.execute(delete_query, {"subject_id": subject_id, "student_id": student_id})
    db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student enrollment not found"
        )
    
    return None
