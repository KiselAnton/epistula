"""Faculty Students API endpoints for Epistula.

Manage student assignments to faculties (similar to faculty_professors).
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

router = APIRouter(prefix="/api/v1/faculties", tags=["faculty-students"])


class FacultyStudentAssign(BaseModel):
    student_id: int


class FacultyStudent(BaseModel):
    id: int
    student_id: int
    student_name: str
    student_email: str
    assigned_at: datetime
    assigned_by: int
    is_active: bool


@router.get("/{university_id}/{faculty_id}/students", response_model=List[FacultyStudent])
def list_faculty_students(
    university_id: int,
    faculty_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
) -> List[FacultyStudent]:
    # Verify university
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"University with ID {university_id} not found")
    schema_name = uni.schema_name

    # Verify faculty
    res = db.execute(text(f"SELECT id FROM {schema_name}.faculties WHERE id = :fid"), {"fid": faculty_id})
    if not res.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Faculty with ID {faculty_id} not found")

    query = text(f"""
        SELECT fs.id, fs.student_id, u.name, u.email, fs.assigned_at, fs.assigned_by, fs.is_active
        FROM {schema_name}.faculty_students fs
        JOIN public.users u ON fs.student_id = u.id
        WHERE fs.faculty_id = :fid
        ORDER BY u.name ASC
    """)
    rows = db.execute(query, {"fid": faculty_id})
    out: List[FacultyStudent] = []
    for r in rows:
        out.append(FacultyStudent(
            id=r[0], student_id=r[1], student_name=r[2], student_email=r[3], assigned_at=r[4], assigned_by=r[5], is_active=r[6]
        ))
    return out


@router.post("/{university_id}/{faculty_id}/students", response_model=FacultyStudent, status_code=status.HTTP_201_CREATED)
def assign_student_to_faculty(
    university_id: int,
    faculty_id: int,
    payload: FacultyStudentAssign,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
) -> FacultyStudent:
    # Permissions: root or uni_admin
    if not current_user.is_root:
        check_admin = text("""
            SELECT 1 FROM public.user_university_roles
            WHERE user_id = :uid AND university_id = :univid AND role = 'uni_admin' AND is_active = TRUE
        """)
        if not db.execute(check_admin, {"uid": current_user.id, "univid": university_id}).fetchone():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only root or university admins can assign students")

    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"University with ID {university_id} not found")
    schema_name = uni.schema_name

    # Verify faculty
    if not db.execute(text(f"SELECT 1 FROM {schema_name}.faculties WHERE id = :fid"), {"fid": faculty_id}).fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Faculty with ID {faculty_id} not found")

    # Verify user is active student in this university
    check_student = text("""
        SELECT u.name, u.email
        FROM public.users u
        JOIN public.user_university_roles uur ON u.id = uur.user_id
        WHERE u.id = :sid AND uur.university_id = :univid AND uur.role = 'student' AND uur.is_active = TRUE
    """)
    row = db.execute(check_student, {"sid": payload.student_id, "univid": university_id}).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"User {payload.student_id} is not an active student in this university")
    student_name, student_email = row

    # Prevent duplicates
    if db.execute(text(f"SELECT 1 FROM {schema_name}.faculty_students WHERE faculty_id = :fid AND student_id = :sid"), {"fid": faculty_id, "sid": payload.student_id}).fetchone():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student is already assigned to this faculty")

    ins = text(f"""
        INSERT INTO {schema_name}.faculty_students (faculty_id, student_id, assigned_by, is_active)
        VALUES (:fid, :sid, :ab, TRUE)
        RETURNING id, student_id, assigned_at, assigned_by, is_active
    """)
    r = db.execute(ins, {"fid": faculty_id, "sid": payload.student_id, "ab": current_user.id}).fetchone()
    db.commit()
    return FacultyStudent(id=r[0], student_id=r[1], student_name=student_name, student_email=student_email, assigned_at=r[2], assigned_by=r[3], is_active=r[4])


@router.delete("/{university_id}/{faculty_id}/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_student_from_faculty(
    university_id: int,
    faculty_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    # Permissions
    if not current_user.is_root:
        check_admin = text("""
            SELECT 1 FROM public.user_university_roles
            WHERE user_id = :uid AND university_id = :univid AND role = 'uni_admin' AND is_active = TRUE
        """)
        if not db.execute(check_admin, {"uid": current_user.id, "univid": university_id}).fetchone():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only root or university admins can remove students")

    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"University with ID {university_id} not found")
    schema_name = uni.schema_name

    if not db.execute(text(f"SELECT 1 FROM {schema_name}.faculty_students WHERE faculty_id = :fid AND student_id = :sid"), {"fid": faculty_id, "sid": student_id}).fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student assignment not found")

    db.execute(text(f"DELETE FROM {schema_name}.faculty_students WHERE faculty_id = :fid AND student_id = :sid"), {"fid": faculty_id, "sid": student_id})
    db.commit()
    return None
