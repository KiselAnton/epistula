"""Faculty Professors API endpoints for Epistula.

Provides endpoints to manage professor assignments to faculties.
This allows administrators to assign professors to faculties,
enabling them to create and manage subjects within those faculties.
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


router = APIRouter(prefix="/api/v1/faculties", tags=["faculty-professors"])


# ============================================================================
# Pydantic Models
# ============================================================================

class FacultyProfessorAssign(BaseModel):
    """Request model for assigning a professor to a faculty"""
    professor_id: int


class FacultyProfessor(BaseModel):
    """Response model for faculty professor assignment"""
    id: int
    professor_id: int
    professor_name: str
    professor_email: str
    assigned_at: datetime
    assigned_by: int
    is_active: bool


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/{university_id}/{faculty_id}/professors", response_model=List[FacultyProfessor])
def list_faculty_professors(
    university_id: int,
    faculty_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
) -> List[FacultyProfessor]:
    """List all professors assigned to a faculty.
    
    Args:
        university_id: ID of the university
        faculty_id: ID of the faculty
        
    Returns:
        List of assigned professors
    """
    # Check if university exists
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found"
        )
    
    schema_name = uni.schema_name
    
    # Check if faculty exists
    check_query = text(f"""
        SELECT id FROM {schema_name}.faculties WHERE id = :faculty_id
    """)
    result = db.execute(check_query, {"faculty_id": faculty_id})
    if not result.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Faculty with ID {faculty_id} not found"
        )
    
    # Get all professors assigned to this faculty
    query = text(f"""
        SELECT 
            fp.id, fp.professor_id, u.name, u.email,
            fp.assigned_at, fp.assigned_by, fp.is_active
        FROM {schema_name}.faculty_professors fp
        JOIN public.users u ON fp.professor_id = u.id
        WHERE fp.faculty_id = :faculty_id
        ORDER BY u.name ASC
    """)
    
    print(f"DEBUG: Executing query for university {university_id}, faculty {faculty_id}, schema {schema_name}")
    result = db.execute(query, {"faculty_id": faculty_id})
    professors = []
    
    for row in result:
        print(f"DEBUG: Found professor - ID: {row[0]}, Name: {row[2]}, Email: {row[3]}")
        professors.append(FacultyProfessor(
            id=row[0],
            professor_id=row[1],
            professor_name=row[2],
            professor_email=row[3],
            assigned_at=row[4],
            assigned_by=row[5],
            is_active=row[6]
        ))
    
    print(f"DEBUG: Returning {len(professors)} professors")
    return professors


@router.post("/{university_id}/{faculty_id}/professors", response_model=FacultyProfessor, status_code=status.HTTP_201_CREATED)
def assign_professor_to_faculty(
    university_id: int,
    faculty_id: int,
    payload: FacultyProfessorAssign,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
) -> FacultyProfessor:
    """Assign a professor to a faculty.
    
    Professors must already exist as users with the 'professor' role in the university.
    Only university admins and root users can assign professors.
    
    Args:
        university_id: ID of the university
        faculty_id: ID of the faculty
        payload: Professor assignment data
        
    Returns:
        Created assignment
    """
    # Check permissions (root or university admin)
    if not current_user.is_root:
        check_admin = text("""
            SELECT 1 FROM public.user_university_roles
            WHERE user_id = :user_id 
            AND university_id = :university_id 
            AND role = 'uni_admin'
            AND is_active = TRUE
        """)
        result = db.execute(check_admin, {
            "user_id": current_user.id,
            "university_id": university_id
        })
        if not result.fetchone():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only root or university admins can assign professors"
            )
    
    # Check if university exists
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found"
        )
    
    schema_name = uni.schema_name
    
    # Check if faculty exists
    check_query = text(f"""
        SELECT id FROM {schema_name}.faculties WHERE id = :faculty_id
    """)
    result = db.execute(check_query, {"faculty_id": faculty_id})
    if not result.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Faculty with ID {faculty_id} not found"
        )
    
    # Check if user is a professor in this university
    check_professor = text("""
        SELECT u.name, u.email
        FROM public.users u
        JOIN public.user_university_roles uur ON u.id = uur.user_id
        WHERE u.id = :professor_id 
        AND uur.university_id = :university_id 
        AND uur.role = 'professor'
        AND uur.is_active = TRUE
    """)
    result = db.execute(check_professor, {
        "professor_id": payload.professor_id,
        "university_id": university_id
    })
    prof_row = result.fetchone()
    
    if not prof_row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User {payload.professor_id} is not an active professor in this university"
        )
    
    prof_name, prof_email = prof_row
    
    # Check if already assigned
    check_existing = text(f"""
        SELECT id FROM {schema_name}.faculty_professors
        WHERE faculty_id = :faculty_id AND professor_id = :professor_id
    """)
    result = db.execute(check_existing, {
        "faculty_id": faculty_id,
        "professor_id": payload.professor_id
    })
    if result.fetchone():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Professor is already assigned to this faculty"
        )
    
    # Insert assignment
    insert_query = text(f"""
        INSERT INTO {schema_name}.faculty_professors 
        (faculty_id, professor_id, assigned_by, is_active)
        VALUES (:faculty_id, :professor_id, :assigned_by, true)
        RETURNING id, professor_id, assigned_at, assigned_by, is_active
    """)
    
    result = db.execute(insert_query, {
        "faculty_id": faculty_id,
        "professor_id": payload.professor_id,
        "assigned_by": current_user.id
    })
    
    db.commit()
    row = result.fetchone()
    
    return FacultyProfessor(
        id=row[0],
        professor_id=row[1],
        professor_name=prof_name,
        professor_email=prof_email,
        assigned_at=row[2],
        assigned_by=row[3],
        is_active=row[4]
    )


@router.delete("/{university_id}/{faculty_id}/professors/{professor_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_professor_from_faculty(
    university_id: int,
    faculty_id: int,
    professor_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Remove a professor from a faculty.
    
    This removes the professor's assignment to the faculty.
    Only university admins and root users can remove professor assignments.
    
    Args:
        university_id: ID of the university
        faculty_id: ID of the faculty
        professor_id: ID of the professor to remove
    """
    # Check permissions
    if not current_user.is_root:
        check_admin = text("""
            SELECT 1 FROM public.user_university_roles
            WHERE user_id = :user_id 
            AND university_id = :university_id 
            AND role = 'uni_admin'
            AND is_active = TRUE
        """)
        result = db.execute(check_admin, {
            "user_id": current_user.id,
            "university_id": university_id
        })
        if not result.fetchone():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only root or university admins can remove professors"
            )
    
    # Check if university exists
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"University with ID {university_id} not found"
        )
    
    schema_name = uni.schema_name
    
    # Check if assignment exists
    check_query = text(f"""
        SELECT id FROM {schema_name}.faculty_professors
        WHERE faculty_id = :faculty_id AND professor_id = :professor_id
    """)
    result = db.execute(check_query, {
        "faculty_id": faculty_id,
        "professor_id": professor_id
    })
    if not result.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Professor assignment not found"
        )
    
    # Delete assignment
    delete_query = text(f"""
        DELETE FROM {schema_name}.faculty_professors
        WHERE faculty_id = :faculty_id AND professor_id = :professor_id
    """)
    db.execute(delete_query, {
        "faculty_id": faculty_id,
        "professor_id": professor_id
    })
    db.commit()
    
    return None
