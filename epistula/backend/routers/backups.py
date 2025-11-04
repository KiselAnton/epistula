from __future__ import annotations

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging

from utils.database import get_db
from utils.models import UserDB
from middleware.auth import get_current_user
from utils.backups import list_backups, restore_university, upload_to_minio, promote_temp_to_production, delete_temp_schema, delete_backup_file
from sqlalchemy import text
from pathlib import Path
from pydantic import BaseModel


# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s [%(name)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

router = APIRouter(prefix="/api/v1/backups", tags=["backups"])


# ============================================================================
# Pydantic Models
# ============================================================================

class BackupInfo(BaseModel):
    """Information about a backup"""
    name: str
    size_bytes: int
    created_at: str
    in_minio: bool
    university_id: int
    university_name: str
    title: str | None = None
    description: str | None = None


class UniversityBackupList(BaseModel):
    """Backups for a single university"""
    university_id: int
    university_name: str
    backups: List[BackupInfo]


class AllBackupsResponse(BaseModel):
    """All backups grouped by university (root admin only)"""
    universities: List[UniversityBackupList]
    total_backup_count: int
    

class EnsureTempRegistryResponse(BaseModel):
    """Response for ensuring temp university registry entry."""
    university_id: int
    temp_university_id: int | None
    message: str


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


@router.get("/all", response_model=AllBackupsResponse)
def get_all_backups(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """List all backups for all universities (root admin only)."""
    logger.info(f"[GET /all] User {current_user.email} (ID: {current_user.id}) requesting all backups")
    
    if not _is_root(current_user):
        logger.warning(f"[GET /all] Access denied - User {current_user.email} is not root")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Only root administrators can view all backups"
        )
    
    logger.debug("[GET /all] Fetching all active universities")
    # Get all active universities
    universities_data = db.execute(
        text("SELECT id, name FROM public.universities WHERE is_active = TRUE ORDER BY id")
    ).fetchall()
    
    logger.info(f"[GET /all] Found {len(universities_data)} active universities")
    
    university_backups = []
    total_count = 0
    
    for uni_id, uni_name in universities_data:
        logger.debug(f"[GET /all] Listing backups for university {uni_id} ({uni_name})")
        entries = list_backups(uni_id)
        backup_infos = [
            BackupInfo(
                name=e.name,
                size_bytes=e.size_bytes,
                created_at=e.created_at.isoformat(),
                in_minio=e.in_minio,
                university_id=uni_id,
                university_name=uni_name
            )
            for e in entries
        ]
        
        if backup_infos:  # Only include universities that have backups
            university_backups.append(
                UniversityBackupList(
                    university_id=uni_id,
                    university_name=uni_name,
                    backups=backup_infos
                )
            )
            total_count += len(backup_infos)
            logger.debug(f"[GET /all] University {uni_id} has {len(backup_infos)} backups")
    
    logger.info(f"[GET /all] Returning {total_count} total backups across {len(university_backups)} universities")
    return AllBackupsResponse(
        universities=university_backups,
        total_backup_count=total_count
    )


@router.get("/{university_id}")
def get_university_backups(
    university_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    logger.info(f"[GET /{university_id}] User {current_user.email} requesting backups for university {university_id}")
    _ensure_can_manage(db, current_user, university_id)
    
    # Get university name
    uni_result = db.execute(
        text("SELECT name FROM public.universities WHERE id = :id"),
        {"id": university_id}
    ).fetchone()
    
    if not uni_result:
        logger.error(f"[GET /{university_id}] University not found")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="University not found")
    
    logger.debug(f"[GET /{university_id}] Listing backups for {uni_result[0]}")
    entries = list_backups(university_id)
    logger.info(f"[GET /{university_id}] Found {len(entries)} backups")
    
    return {
        "university_id": university_id,
        "university_name": uni_result[0],
        "backups": [
            {
                "name": e.name,
                "size_bytes": e.size_bytes,
                "created_at": e.created_at.isoformat(),
                "in_minio": e.in_minio,
                "title": e.title,
                "description": e.description,
            }
            for e in entries
        ],
    }


@router.post("/{university_id}/{backup_name}/restore")
def restore_university_backup(
    university_id: int,
    backup_name: str,
    to_temp: bool = False,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Restore a university from backup.
    
    Args:
        to_temp: If True, restore to <schema>_temp for validation before promoting to production
    """
    restore_type = "temporary" if to_temp else "production"
    logger.info(f"[POST /{university_id}/{backup_name}/restore] User {current_user.email} initiating {restore_type} restore")
    _ensure_can_manage(db, current_user, university_id)
    
    try:
        logger.warning(f"[RESTORE] Starting {restore_type} restore of university {university_id} from {backup_name}")
        result = restore_university(db, university_id, backup_name, to_temp=to_temp)
        logger.info(f"[RESTORE] Successfully restored university {university_id} to {result['schema_name']}")
        return {
            "message": f"Restore to {'temporary schema' if to_temp else 'production'} completed",
            "university_id": university_id,
            "backup": backup_name,
            **result
        }
    except FileNotFoundError as e:
        logger.error(f"[RESTORE] Backup file not found: {backup_name} for university {university_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backup not found")
    except Exception as e:
        logger.error(f"[RESTORE] Failed to restore university {university_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{university_id}/{backup_name}/upload-to-minio")
def upload_backup_to_minio_endpoint(
    university_id: int,
    backup_name: str,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Upload a local backup to MinIO storage for redundancy."""
    logger.info(f"[POST /{university_id}/{backup_name}/upload-to-minio] User {current_user.email} uploading to MinIO")
    _ensure_can_manage(db, current_user, university_id)
    
    # Find the backup file
    from utils.backups import _ensure_uni_dir
    uni_dir = _ensure_uni_dir(university_id)
    backup_path = uni_dir / backup_name
    
    if not backup_path.exists():
        logger.error(f"[UPLOAD-MINIO] Backup file not found: {backup_path}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backup file not found")
    
    logger.debug(f"[UPLOAD-MINIO] Uploading {backup_path} (size: {backup_path.stat().st_size} bytes)")
    success = upload_to_minio(backup_path, university_id)
    
    if success:
        logger.info(f"[UPLOAD-MINIO] Successfully uploaded {backup_name} to MinIO")
        return {"message": "Backup uploaded to MinIO successfully", "filename": backup_name}
    else:
        logger.error(f"[UPLOAD-MINIO] Failed to upload {backup_name} to MinIO")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload backup to MinIO"
        )


# =============================
# Backup metadata (title/notes)
# =============================

class BackupMetaPayload(BaseModel):
    title: str | None = None
    description: str | None = None


class BulkDeletePayload(BaseModel):
    filenames: List[str]
    delete_from_minio: bool = True


@router.get("/{university_id}/{backup_name}/meta")
def get_backup_meta(
    university_id: int,
    backup_name: str,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Get editable metadata for a backup (title/description)."""
    _ensure_can_manage(db, current_user, university_id)

    # Verify the file exists locally (to avoid orphaned metadata display)
    from utils.backups import _ensure_uni_dir
    backup_path = _ensure_uni_dir(university_id) / backup_name
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail="Backup not found")

    row = db.execute(
        text(
            "SELECT title, description FROM public.university_backups_meta WHERE university_id = :uid AND filename = :fn"
        ),
        {"uid": university_id, "fn": backup_name},
    ).fetchone()
    if not row:
        return {"title": None, "description": None}
    return {"title": row[0], "description": row[1]}


@router.put("/{university_id}/{backup_name}/meta")
def upsert_backup_meta(
    university_id: int,
    backup_name: str,
    payload: BackupMetaPayload,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Create or update metadata for a backup (title/description)."""
    _ensure_can_manage(db, current_user, university_id)

    # Verify the backup exists (local file check)
    from utils.backups import _ensure_uni_dir
    backup_path = _ensure_uni_dir(university_id) / backup_name
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail="Backup not found")

    try:
        # Upsert behavior
        db.execute(
            text(
                """
                INSERT INTO public.university_backups_meta (university_id, filename, title, description, created_by)
                VALUES (:uid, :fn, :title, :desc, :created_by)
                ON CONFLICT (university_id, filename)
                DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, updated_at = now()
                """
            ),
            {
                "uid": university_id,
                "fn": backup_name,
                "title": payload.title,
                "desc": payload.description,
                "created_by": getattr(current_user, "id", None),
            },
        )
        db.commit()
        return {"message": "Backup metadata saved", "title": payload.title, "description": payload.description}
    except Exception as e:
        logger.error(f"[META] Failed to save metadata for {backup_name}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to save backup metadata")


@router.post("/{university_id}/create")
def create_backup_now(
    university_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Create a backup immediately for a university (root or uni_admin)."""
    logger.info(f"[POST /{university_id}/create] User {current_user.email} creating immediate backup")
    _ensure_can_manage(db, current_user, university_id)
    
    # Verify university exists
    uni_result = db.execute(
        text("SELECT name FROM public.universities WHERE id = :id"),
        {"id": university_id}
    ).fetchone()
    
    if not uni_result:
        logger.error(f"[CREATE-BACKUP] University {university_id} not found")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="University not found")
    
    try:
        from utils.backups import backup_university
        from datetime import datetime, timezone
        
        # Create backup with manual label
        label = f"manual_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
        logger.info(f"[CREATE-BACKUP] Creating backup for university {university_id} ({uni_result[0]}) with label: {label}")
        
        backup_path = backup_university(db, university_id, label=label)
        file_size = backup_path.stat().st_size
        
        logger.info(f"[CREATE-BACKUP] Successfully created backup {backup_path.name} (size: {file_size} bytes)")
        
        return {
            "message": f"Backup created successfully for {uni_result[0]}",
            "filename": backup_path.name,
            "university_id": university_id,
            "size_bytes": file_size
        }
    except Exception as e:
        logger.error(f"[CREATE-BACKUP] Failed to create backup for university {university_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Backup creation failed: {str(e)}"
        )


@router.post("/{university_id}/promote-temp")
def promote_temp_to_production_endpoint(
    university_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Promote temporary schema to production (swap schemas safely)."""
    logger.info(f"[POST /{university_id}/promote-temp] User {current_user.email} promoting temp to production")
    _ensure_can_manage(db, current_user, university_id)
    
    try:
        result = promote_temp_to_production(db, university_id)
        logger.info(f"[PROMOTE] Successfully promoted temp schema for university {university_id}")
        return result
    except ValueError as e:
        logger.error(f"[PROMOTE] Validation error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"[PROMOTE] Failed to promote temp schema for university {university_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Promotion failed: {str(e)}"
        )


@router.delete("/{university_id}/temp-schema")
def delete_temp_schema_endpoint(
    university_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Delete temporary schema (if validation shows it's not needed)."""
    logger.info(f"[DELETE /{university_id}/temp-schema] User {current_user.email} deleting temp schema")
    _ensure_can_manage(db, current_user, university_id)
    
    try:
        result = delete_temp_schema(db, university_id)
        logger.info(f"[CLEANUP] Successfully deleted temp schema for university {university_id}")
        return result
    except Exception as e:
        logger.error(f"[CLEANUP] Failed to delete temp schema for university {university_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cleanup failed: {str(e)}"
        )


@router.get("/{university_id}/temp-status")
def get_temp_schema_status(
    university_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Check if a temporary schema exists for this university."""
    logger.info(f"[GET /{university_id}/temp-status] User {current_user.email} checking temp schema status")
    _ensure_can_manage(db, current_user, university_id)
    
    # Get university info
    uni_result = db.execute(
        text("SELECT schema_name, name FROM public.universities WHERE id = :id"),
        {"id": university_id}
    ).fetchone()
    
    if not uni_result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="University not found")
    
    production_schema = uni_result[0]
    temp_schema = f"{production_schema}_temp"
    
    # Check if temp schema exists
    result = db.execute(
        text("SELECT schema_name FROM information_schema.schemata WHERE schema_name = :name"),
        {"name": temp_schema}
    ).fetchone()
    
    has_temp = result is not None
    temp_university_id = None
    
    # If temp exists, get some basic stats
    temp_info = None
    if has_temp:
        # Try to find registry entry for temp university
        try:
            row = db.execute(
                text("SELECT id FROM public.universities WHERE schema_name = :sname"),
                {"sname": temp_schema},
            ).fetchone()
            if row:
                temp_university_id = int(row[0])
        except Exception:
            temp_university_id = None
        # Count faculties and users in temp schema
        try:
            faculty_count = db.execute(
                text(f"SELECT COUNT(*) FROM {temp_schema}.faculties")
            ).scalar() or 0
            
            user_count = db.execute(
                text(f"SELECT COUNT(*) FROM {temp_schema}.users")
            ).scalar() or 0
            
            temp_info = {
                "faculty_count": faculty_count,
                "user_count": user_count,
            }
        except Exception as e:
            logger.warning(f"[TEMP-STATUS] Could not get temp schema stats: {e}")
            temp_info = {"error": "Could not retrieve stats"}
    
    return {
        "university_id": university_id,
        "university_name": uni_result[1],
        "production_schema": production_schema,
        "temp_schema": temp_schema,
        "temp_university_id": temp_university_id,
        "has_temp_schema": has_temp,
        "temp_info": temp_info
    }


@router.post("/{university_id}/ensure-temp-registry", response_model=EnsureTempRegistryResponse)
def ensure_temp_university_registry(
    university_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Ensure a deactivated temp university row exists for the current temp schema.

    Idempotent: updates existing temp entry or creates a new one. Requires root or uni_admin.
    """
    _ensure_can_manage(db, current_user, university_id)

    # Determine production and temp schema
    uni = db.execute(
        text("SELECT schema_name FROM public.universities WHERE id = :id"),
        {"id": university_id},
    ).fetchone()
    if not uni:
        raise HTTPException(status_code=404, detail="University not found")
    production_schema = uni[0]
    temp_schema = f"{production_schema}_temp"

    # Verify temp schema exists
    exists = db.execute(
        text("SELECT 1 FROM information_schema.schemata WHERE schema_name = :name"),
        {"name": temp_schema},
    ).fetchone()
    if not exists:
        raise HTTPException(status_code=400, detail="Temporary schema does not exist")

    # Ensure registry row
    from utils.backups import _ensure_temp_university_entry
    try:
        temp_id = _ensure_temp_university_entry(db, university_id)
        return EnsureTempRegistryResponse(
            university_id=university_id,
            temp_university_id=temp_id,
            message="Temp university registry ensured",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to ensure temp university entry: {e}")


 


@router.delete("/{university_id}/{backup_name}")
def delete_backup_endpoint(
    university_id: int,
    backup_name: str,
    delete_from_minio: bool = True,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Delete a specific backup for a university (local file and optionally MinIO).

    Requires root or uni_admin access for the university.
    """
    logger.info(f"[DELETE /{university_id}/{backup_name}] User {current_user.email} deleting backup (minio={delete_from_minio})")
    _ensure_can_manage(db, current_user, university_id)

    # Basic naming convention guard: only allow compressed SQL backups
    if not backup_name.endswith(".sql.gz"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid backup filename")

    try:
        result = delete_backup_file(university_id, backup_name, delete_from_minio=delete_from_minio)
        # If local wasn't deleted (race), still return 200 with details; client can inspect flags
        return {
            "message": "Backup deletion attempted",
            **result,
        }
    except FileNotFoundError:
        logger.warning(f"[DELETE] Backup not found for deletion: uni={university_id} name={backup_name}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backup not found")
    except Exception as e:
        logger.error(f"[DELETE] Failed to delete backup {backup_name} for uni {university_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete("/{university_id}/manage/delete-all")
def delete_all_backups_endpoint(
    university_id: int,
    delete_from_minio: bool = True,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Delete all backups for a university.

    Returns a summary and per-file results. Requires root or uni_admin.
    """
    _ensure_can_manage(db, current_user, university_id)

    entries = list_backups(university_id)
    results = []
    errors = 0
    for e in entries:
        try:
            res = delete_backup_file(university_id, e.name, delete_from_minio=delete_from_minio)
            results.append(res)
        except Exception as ex:
            errors += 1
            results.append({
                "filename": e.name,
                "error": str(ex),
                "deleted_local": False,
                "deleted_minio": False,
            })
    return {
        "university_id": university_id,
        "requested": len(entries),
        "errors": errors,
        "results": results,
    }


@router.delete("/{university_id}/manage/bulk-delete")
def bulk_delete_backups_endpoint(
    university_id: int,
    payload: BulkDeletePayload,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Delete selected backups for a university given a list of filenames."""
    _ensure_can_manage(db, current_user, university_id)

    results = []
    errors = 0
    for name in payload.filenames:
        if not str(name).endswith(".sql.gz"):
            results.append({
                "filename": name,
                "error": "Invalid backup filename",
                "deleted_local": False,
                "deleted_minio": False,
            })
            errors += 1
            continue
        try:
            res = delete_backup_file(university_id, name, delete_from_minio=payload.delete_from_minio)
            results.append(res)
        except FileNotFoundError:
            results.append({
                "filename": name,
                "error": "Backup not found",
                "deleted_local": False,
                "deleted_minio": False,
            })
            errors += 1
        except Exception as ex:
            results.append({
                "filename": name,
                "error": str(ex),
                "deleted_local": False,
                "deleted_minio": False,
            })
            errors += 1
    return {
        "university_id": university_id,
        "requested": len(payload.filenames),
        "errors": errors,
        "results": results,
    }
