"""API endpoints for data export and import between schemas."""

from __future__ import annotations

from typing import List, Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel
import logging

from utils.database import get_db
from utils.models import UserDB
from middleware.auth import get_current_user
from utils.data_transfer import (
    export_entity,
    export_faculty_with_relations,
    import_entity,
    import_faculty_with_relations,
    ENTITY_TYPES
)
from utils.data_transfer_versioning import (
    CURRENT_FORMAT_VERSION,
    MIN_SUPPORTED_IMPORT_VERSION,
    compare_versions,
    migrate_entities,
)
from sqlalchemy import text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/data-transfer", tags=["data-transfer"])


# ============================================================================
# Pydantic Models
# ============================================================================

class ExportRequest(BaseModel):
    """Request to export entities"""
    entity_type: str
    entity_ids: Optional[List[int]] = None
    from_temp: bool = False  # Export from temp schema if True


class ExportResponse(BaseModel):
    """Response with exported data"""
    format_version: Optional[str] = None
    app_version: Optional[str] = None
    entity_type: str
    source_schema: str
    count: int
    exported_at: str
    data: List[dict]
    columns: List[str]


class ImportRequest(BaseModel):
    """Request to import entities"""
    entity_type: str
    data: List[dict]
    strategy: Literal['replace', 'merge', 'skip_existing'] = 'merge'
    to_temp: bool = False  # Import to temp schema if True
    # Optional metadata if provided by export file
    format_version: Optional[str] = None
    source_app_version: Optional[str] = None


class ImportResponse(BaseModel):
    """Response with import results"""
    entity_type: str
    target_schema: str
    strategy: str
    imported: int
    updated: int
    skipped: int
    errors: List[str]
    total_processed: int


# ============================================================================
# Helper Functions
# ============================================================================

def _is_root(user: UserDB) -> bool:
    return bool(getattr(user, "is_root", False))


def _is_uni_admin(db: Session, user_id: int, university_id: int) -> bool:
    row = db.execute(
        text(
            """
            SELECT 1
            FROM public.user_university_roles
            WHERE user_id = :uid AND university_id = :unid AND role = 'uni_admin'
            LIMIT 1
            """
        ),
        {"uid": user_id, "unid": university_id},
    ).fetchone()
    return row is not None


def _ensure_can_manage(db: Session, user: UserDB, university_id: int) -> None:
    if _is_root(user):
        return
    if _is_uni_admin(db, user.id, university_id):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")


def _get_schema_name(db: Session, university_id: int, use_temp: bool = False) -> str:
    """Get the schema name for a university (production or temp)."""
    result = db.execute(
        text("SELECT schema_name FROM public.universities WHERE id = :id"),
        {"id": university_id}
    ).fetchone()
    
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="University not found")
    
    schema_name = result[0]
    if use_temp:
        schema_name = f"{schema_name}_temp"
        
        # Verify temp schema exists
        exists = db.execute(
            text("SELECT schema_name FROM information_schema.schemata WHERE schema_name = :name"),
            {"name": schema_name}
        ).fetchone()
        
        if not exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Temporary schema does not exist. Please restore a backup to temp first."
            )
    
    return schema_name


# ============================================================================
# Export Endpoints
# ============================================================================

@router.post("/{university_id}/export", response_model=ExportResponse)
def export_entities(
    university_id: int,
    request: ExportRequest,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Export entities from a university schema (production or temp).
    
    Args:
        university_id: University ID
        request: Export request with entity_type, entity_ids, from_temp flag
        
    Returns:
        Exported data as JSON
    """
    logger.info(f"[EXPORT] User {current_user.email} exporting {request.entity_type} from university {university_id}")
    _ensure_can_manage(db, current_user, university_id)
    
    if request.entity_type not in ENTITY_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid entity_type. Must be one of: {', '.join(ENTITY_TYPES)}"
        )
    
    try:
        schema_name = _get_schema_name(db, university_id, use_temp=request.from_temp)
        result = export_entity(db, schema_name, request.entity_type, request.entity_ids)
        logger.info(f"[EXPORT] Successfully exported {result['count']} {request.entity_type}")
        return result
    except HTTPException as e:
        # Propagate HTTP errors (e.g., 404 for missing temp schema)
        raise e
    except Exception as e:
        logger.error(f"[EXPORT] Export failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Export failed: {str(e)}"
        )


@router.get("/{university_id}/export/faculty/{faculty_id}")
def export_faculty_full(
    university_id: int,
    faculty_id: int,
    from_temp: bool = False,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Export a faculty with all its related data (subjects, professors, students, lectures, etc.).
    
    This is useful for copying an entire faculty structure from temp to production.
    """
    logger.info(f"[EXPORT] User {current_user.email} exporting full faculty {faculty_id} from university {university_id}")
    _ensure_can_manage(db, current_user, university_id)
    
    try:
        schema_name = _get_schema_name(db, university_id, use_temp=from_temp)
        result = export_faculty_with_relations(db, schema_name, faculty_id)
        logger.info(f"[EXPORT] Successfully exported faculty {faculty_id} with all relations")
        return result
    except ValueError as e:
        logger.error(f"[EXPORT] Faculty not found: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"[EXPORT] Export failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Export failed: {str(e)}"
        )


# ============================================================================
# Import Endpoints
# ============================================================================

@router.post("/{university_id}/import", response_model=ImportResponse)
def import_entities(
    university_id: int,
    request: ImportRequest,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Import entities into a university schema (production or temp).
    
    Args:
        university_id: University ID
        request: Import request with entity_type, data, strategy, to_temp flag
        
    Returns:
        Import results
    """
    logger.info(f"[IMPORT] User {current_user.email} importing {len(request.data)} {request.entity_type} to university {university_id}")
    _ensure_can_manage(db, current_user, university_id)
    
    if request.entity_type not in ENTITY_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid entity_type. Must be one of: {', '.join(ENTITY_TYPES)}"
        )
    
    try:
        schema_name = _get_schema_name(db, university_id, use_temp=request.to_temp)
        # Handle format versioning and migrations
        incoming_version = request.format_version or CURRENT_FORMAT_VERSION
        # Reject too-new formats explicitly
        if compare_versions(incoming_version, CURRENT_FORMAT_VERSION) > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Export format version {incoming_version} is newer than this server supports "
                    f"(current {CURRENT_FORMAT_VERSION}). Please upgrade Epistula."
                )
            )

        # Migrate older data up to current format if needed
        migrated_data = migrate_entities(request.entity_type, request.data, incoming_version, CURRENT_FORMAT_VERSION)

        result = import_entity(
            db, schema_name, request.entity_type,
            migrated_data, strategy=request.strategy
        )
        logger.info(f"[IMPORT] Import completed: {result['imported']} imported, {result['updated']} updated")
        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"[IMPORT] Import failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {str(e)}"
        )


@router.post("/{university_id}/import/faculty")
def import_faculty_full(
    university_id: int,
    faculty_data: dict = Body(...),
    strategy: Literal['replace', 'merge', 'skip_existing'] = 'merge',
    to_temp: bool = False,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Import a faculty with all its related data (subjects, professors, students, lectures, etc.).
    
    This is useful for copying an entire faculty structure between schemas.
    """
    logger.info(f"[IMPORT] User {current_user.email} importing full faculty to university {university_id}")
    _ensure_can_manage(db, current_user, university_id)
    
    try:
        schema_name = _get_schema_name(db, university_id, use_temp=to_temp)
        result = import_faculty_with_relations(db, schema_name, faculty_data, strategy=strategy)
        logger.info(f"[IMPORT] Successfully imported faculty with all relations")
        return result
    except Exception as e:
        logger.error(f"[IMPORT] Import failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {str(e)}"
        )


# ============================================================================
# List Available Entities
# ============================================================================

@router.get("/{university_id}/entities")
def list_available_entities(
    university_id: int,
    from_temp: bool = False,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """List all available entities in a schema with counts.
    
    Useful for showing what data is available for export.
    """
    logger.info(f"[LIST] User {current_user.email} listing entities for university {university_id}")
    _ensure_can_manage(db, current_user, university_id)
    
    try:
        schema_name = _get_schema_name(db, university_id, use_temp=from_temp)
        
        entity_counts = {}
        for entity_type in ENTITY_TYPES:
            try:
                count = db.execute(
                    text(f"SELECT COUNT(*) FROM {schema_name}.{entity_type}")
                ).scalar()
                entity_counts[entity_type] = count or 0
            except Exception as e:
                logger.warning(f"[LIST] Could not count {entity_type}: {e}")
                entity_counts[entity_type] = 0
        
        return {
            "university_id": university_id,
            "schema_name": schema_name,
            "is_temp": from_temp,
            "entities": entity_counts,
            "total_entities": sum(entity_counts.values())
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"[LIST] Failed to list entities: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list entities: {str(e)}"
        )
