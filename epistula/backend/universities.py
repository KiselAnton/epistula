"""Universities API endpoints for Epistula.

Provides endpoints to list and create universities. Creation is restricted
to root users. University creation uses the database function
`create_university(name, code, description, created_by)` which creates
both the registry row and the dedicated schema (uni_<id>).
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db
from models import University, UniversityCreate, UniversityDB
from auth_utils import get_current_user
from models import UserDB

router = APIRouter(prefix="/api/v1/universities", tags=["universities"])


@router.get("/", response_model=List[University])
def list_universities(db: Session = Depends(get_db)) -> List[University]:
    """List all universities."""
    items = db.query(UniversityDB).order_by(UniversityDB.id.asc()).all()
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

    # Call DB function to insert and create schema
    res = db.execute(
        text("SELECT create_university(:name, :code, :description, :created_by) AS id"),
        {
            "name": payload.name,
            "code": payload.code,
            "description": payload.description,
            "created_by": current_user.id,
        },
    )
    row = res.fetchone()
    if not row or row[0] is None:
        raise HTTPException(status_code=500, detail="Failed to create university")

    uni_id = int(row[0])

    # Fetch and return created university
    uni = db.query(UniversityDB).filter(UniversityDB.id == uni_id).first()
    if not uni:
        # Fallback in extremely rare case
        raise HTTPException(status_code=500, detail="University created but not found")

    return uni
