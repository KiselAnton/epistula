"""Lecture Notes API endpoints.

Allows students to create personal notes for lectures. Notes are private
to the student who created them. Professors/admins cannot read them.
"""
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from utils.database import get_db
from utils.models import UniversityDB, UserDB
from middleware.auth import get_current_user


router = APIRouter(prefix="/api/v1", tags=["lecture-notes"])


class LectureNoteUpsert(BaseModel):
    content: str = Field(min_length=1)


class LectureNoteResponse(BaseModel):
    id: int
    lecture_id: int
    student_id: int
    content: str
    created_at: datetime
    updated_at: datetime


class MyLectureNoteItem(BaseModel):
    id: int
    lecture_id: int
    subject_id: int
    title: str
    subject_code: Optional[str] = None
    content: str
    updated_at: datetime


def _get_schema(db: Session, university_id: int) -> str:
    uni = db.query(UniversityDB).filter(UniversityDB.id == university_id).first()
    if not uni:
        raise HTTPException(status_code=404, detail="University not found")
    return uni.schema_name


def _ensure_notes_table(db: Session, schema: str) -> None:
    db.execute(text(f"""
        CREATE TABLE IF NOT EXISTS {schema}.lecture_notes (
            id SERIAL PRIMARY KEY,
            lecture_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
            UNIQUE(lecture_id, student_id)
        );
    """))
    db.commit()


def _ensure_student_in_subject(db: Session, schema: str, subject_id: int, student_id: int) -> None:
    row = db.execute(text(f"""
        SELECT 1 FROM {schema}.subject_students ss
        WHERE ss.subject_id = :subject_id AND ss.student_id = :student_id
    """), {"subject_id": subject_id, "student_id": student_id}).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enrolled in subject")


def _lecture_belongs_to_subject(db: Session, schema: str, lecture_id: int, subject_id: int) -> None:
    row = db.execute(text(f"""
        SELECT 1 FROM {schema}.lectures WHERE id = :lecture_id AND subject_id = :subject_id
    """), {"lecture_id": lecture_id, "subject_id": subject_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Lecture not found")


@router.get("/subjects/{university_id}/{faculty_id}/{subject_id}/lectures/{lecture_id}/notes", response_model=LectureNoteResponse)
def get_my_lecture_note(
    university_id: int,
    faculty_id: int,  # kept for path parity; not used here
    subject_id: int,
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    if current_user.is_root:
        # For privacy, even root cannot read student notes via this endpoint
        raise HTTPException(status_code=403, detail="Forbidden")

    schema = _get_schema(db, university_id)
    _ensure_notes_table(db, schema)

    # Validate lecture and enrollment
    _lecture_belongs_to_subject(db, schema, lecture_id, subject_id)
    _ensure_student_in_subject(db, schema, subject_id, current_user.id)

    row = db.execute(text(f"""
        SELECT id, lecture_id, student_id, content, created_at, updated_at
        FROM {schema}.lecture_notes
        WHERE lecture_id = :lecture_id AND student_id = :student_id
    """), {"lecture_id": lecture_id, "student_id": current_user.id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Note not found")

    return LectureNoteResponse(
        id=row[0], lecture_id=row[1], student_id=row[2], content=row[3], created_at=row[4], updated_at=row[5]
    )


@router.post("/subjects/{university_id}/{faculty_id}/{subject_id}/lectures/{lecture_id}/notes", response_model=LectureNoteResponse, status_code=status.HTTP_201_CREATED)
def upsert_my_lecture_note(
    university_id: int,
    faculty_id: int,  # kept for path parity; not used here
    subject_id: int,
    lecture_id: int,
    payload: LectureNoteUpsert,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    if current_user.is_root:
        raise HTTPException(status_code=403, detail="Forbidden")

    schema = _get_schema(db, university_id)
    _ensure_notes_table(db, schema)

    # Validate lecture and enrollment
    _lecture_belongs_to_subject(db, schema, lecture_id, subject_id)
    _ensure_student_in_subject(db, schema, subject_id, current_user.id)

    # Upsert note
    existing = db.execute(text(f"""
        SELECT id FROM {schema}.lecture_notes
        WHERE lecture_id = :lecture_id AND student_id = :student_id
    """), {"lecture_id": lecture_id, "student_id": current_user.id}).fetchone()

    if existing:
        row = db.execute(text(f"""
            UPDATE {schema}.lecture_notes
            SET content = :content, updated_at = NOW()
            WHERE id = :id
            RETURNING id, lecture_id, student_id, content, created_at, updated_at
        """), {"id": existing[0], "content": payload.content}).fetchone()
    else:
        row = db.execute(text(f"""
            INSERT INTO {schema}.lecture_notes (lecture_id, student_id, content)
            VALUES (:lecture_id, :student_id, :content)
            RETURNING id, lecture_id, student_id, content, created_at, updated_at
        """), {"lecture_id": lecture_id, "student_id": current_user.id, "content": payload.content}).fetchone()

    db.commit()
    if row is None:
        # Fallback: fetch the updated/inserted row
        row = db.execute(text(f"""
            SELECT id, lecture_id, student_id, content, created_at, updated_at
            FROM {schema}.lecture_notes
            WHERE lecture_id = :lecture_id AND student_id = :student_id
        """), {"lecture_id": lecture_id, "student_id": current_user.id}).fetchone()
    return LectureNoteResponse(
        id=row[0], lecture_id=row[1], student_id=row[2], content=row[3], created_at=row[4], updated_at=row[5]
    )


@router.get("/universities/{university_id}/my/notes", response_model=List[MyLectureNoteItem])
def list_my_notes(
    university_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    if current_user.is_root:
        raise HTTPException(status_code=403, detail="Forbidden")

    schema = _get_schema(db, university_id)
    _ensure_notes_table(db, schema)

    # Join notes with lectures and subjects for metadata
    result = db.execute(text(f"""
        SELECT ln.id, ln.lecture_id, l.subject_id, l.title, s.code, ln.content, ln.updated_at
        FROM {schema}.lecture_notes ln
        JOIN {schema}.lectures l ON l.id = ln.lecture_id
        JOIN {schema}.subjects s ON s.id = l.subject_id
        WHERE ln.student_id = :student_id
        ORDER BY ln.updated_at DESC
    """), {"student_id": current_user.id})

    items: List[MyLectureNoteItem] = []
    for row in result:
        items.append(MyLectureNoteItem(
            id=row[0], lecture_id=row[1], subject_id=row[2], title=row[3], subject_code=row[4], content=row[5], updated_at=row[6]
        ))
    return items
