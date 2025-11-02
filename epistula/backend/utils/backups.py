"""Backup and restore utilities for per-university PostgreSQL schemas.

This module provides:
- Daily per-university backups with 30-day retention
- Listing backups for a university
- Restoring a university from a selected backup (with pre-restore snapshot)

Backups are stored on a host-mounted path (default: /backups/database) and
organized per university: /backups/database/uni_<id>/<filename>.sql.gz

Filenames follow this convention by default:
  <schema>_<YYYYMMDD>.sql.gz            (daily scheduled)
  <schema>_prerestore_<ts>.sql.gz       (pre-restore snapshot)

Note: This module shells out to `pg_dump` and `psql` which must be available
in the backend container. Ensure the Dockerfile installs postgresql-client.
"""

from __future__ import annotations

import os
import subprocess
import gzip
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple
import logging

from sqlalchemy.orm import Session
from sqlalchemy import text

from utils.database import SessionLocal
from utils.minio_client import get_minio_client
from minio.error import S3Error


# Get MinIO client instance
minio_client = get_minio_client()

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s [%(name)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)


# Configuration ----------------------------------------------------------------

DB_HOST = os.getenv("DB_HOST", "database")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "epistula")
DB_USER = os.getenv("DB_USER", "epistula_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

BACKUPS_ROOT = Path(os.getenv("BACKUPS_DIR", "/backups/database"))
RETENTION_COUNT = int(os.getenv("BACKUPS_RETENTION_DAYS", "30"))
MINIO_BACKUP_BUCKET = "backups"
MINIO_ENABLED = os.getenv("ENABLE_MINIO_BACKUPS", "true").lower() == "true"


@dataclass
class BackupEntry:
    name: str
    path: Path
    size_bytes: int
    created_at: datetime
    in_minio: bool = False
    title: Optional[str] = None
    description: Optional[str] = None


def _ensure_minio_bucket():
    """Ensure the backups bucket exists in MinIO."""
    if not MINIO_ENABLED:
        return
    try:
        if not minio_client.bucket_exists(MINIO_BACKUP_BUCKET):
            minio_client.make_bucket(MINIO_BACKUP_BUCKET)
    except S3Error as e:
        print(f"[backups] Error ensuring MinIO bucket: {e}")


def _university_info(db: Session, university_id: int) -> Optional[dict]:
    row = db.execute(
        text("SELECT id, code, schema_name FROM public.universities WHERE id = :id"),
        {"id": university_id},
    ).fetchone()
    if not row:
        return None
    return {"id": row[0], "code": row[1], "schema_name": row[2]}


def _get_university_full_info(db: Session, university_id: int) -> Optional[Tuple[int, str, str, str]]:
    """Fetch id, name, code, schema_name for a university."""
    row = db.execute(
        text("SELECT id, name, code, schema_name FROM public.universities WHERE id = :id"),
        {"id": university_id},
    ).fetchone()
    if not row:
        return None
    return int(row[0]), str(row[1]), str(row[2]), str(row[3])


def _ensure_temp_university_entry(db: Session, university_id: int) -> Optional[int]:
    """Create or update a temp university row in public.universities.

    - name => "<name> (temp)"
    - code => "<code>_TEMP" (trimmed to 50 chars)
    - schema_name => production_schema + "_temp"
    - is_active => False

    Returns: temp university id (int) if created/updated, else None on error.
    """
    info = _get_university_full_info(db, university_id)
    if not info:
        return None
    _id, name, code, schema = info
    temp_name = f"{name} (temp)"
    temp_code_base = f"{code}_TEMP"
    # Ensure code within 50 chars
    temp_code = temp_code_base[:50]
    temp_schema = f"{schema}_temp"

    # Check if a university with this temp schema already exists
    existing = db.execute(
        text("SELECT id FROM public.universities WHERE schema_name = :schema_name"),
        {"schema_name": temp_schema},
    ).fetchone()

    if existing:
        temp_id = int(existing[0])
        # Update its fields to ensure consistency and keep it deactivated
        db.execute(
            text(
                """
                UPDATE public.universities
                SET name = :name,
                    code = :code,
                    is_active = FALSE
                WHERE id = :id
                """
            ),
            {"name": temp_name, "code": temp_code, "id": temp_id},
        )
        db.commit()
        return temp_id

    # Insert a new temp university entry
    res = db.execute(
        text(
            """
            INSERT INTO public.universities (name, code, schema_name, description, is_active)
            VALUES (:name, :code, :schema_name, :description, FALSE)
            RETURNING id
            """
        ),
        {
            "name": temp_name,
            "code": temp_code,
            "schema_name": temp_schema,
            "description": "Temporary restoration workspace for validation/export",
        },
    )
    row = res.fetchone()
    db.commit()
    return int(row[0]) if row and row[0] is not None else None


def _remove_temp_university_entry(db: Session, university_id: int) -> None:
    """Delete the temp university row (if any) associated with university_id's schema.

    This also cascades user_university_roles via FK on delete (if configured).
    """
    info = _get_university_full_info(db, university_id)
    if not info:
        return
    _, _, _, schema = info
    temp_schema = f"{schema}_temp"
    db.execute(text("DELETE FROM public.universities WHERE schema_name = :schema"), {"schema": temp_schema})
    db.commit()


def _ensure_uni_dir(university_id: int) -> Path:
    uni_dir = BACKUPS_ROOT / f"uni_{university_id}"
    uni_dir.mkdir(parents=True, exist_ok=True)
    return uni_dir


def list_backups(university_id: int) -> List[BackupEntry]:
    uni_dir = _ensure_uni_dir(university_id)
    entries: List[BackupEntry] = []
    # Load metadata for this university's backups (title/description)
    meta_map: dict[str, tuple[Optional[str], Optional[str]]] = {}
    try:
        with SessionLocal() as db:
            rows = db.execute(
                text(
                    """
                    SELECT filename, title, description
                    FROM public.university_backups_meta
                    WHERE university_id = :uid
                    """
                ),
                {"uid": university_id},
            ).fetchall()
            for fn, title, desc in rows:
                meta_map[str(fn)] = (title, desc)
    except Exception as e:
        logger.warning(f"[backups] Failed to fetch backup metadata for uni {university_id}: {e}")
    
    # Get MinIO backups list
    minio_backups = set()
    if MINIO_ENABLED:
        _ensure_minio_bucket()
        try:
            prefix = f"uni_{university_id}/"
            objects = minio_client.list_objects(MINIO_BACKUP_BUCKET, prefix=prefix, recursive=True)
            for obj in objects:
                # Extract just the filename from the path
                filename = obj.object_name.split('/')[-1]
                minio_backups.add(filename)
        except S3Error as e:
            print(f"[backups] Error listing MinIO backups: {e}")
    
    # List local backups
    for f in sorted(uni_dir.glob("*.sql.gz"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            stat = f.stat()
            title, desc = meta_map.get(f.name, (None, None))
            entries.append(
                BackupEntry(
                    name=f.name,
                    path=f,
                    size_bytes=stat.st_size,
                    created_at=datetime.fromtimestamp(stat.st_mtime),
                    in_minio=f.name in minio_backups,
                    title=title,
                    description=desc,
                )
            )
        except FileNotFoundError:
            # Race condition if file disappears; skip
            continue
    return entries


def delete_backup_file(university_id: int, backup_name: str, *, delete_from_minio: bool = True) -> dict:
    """Delete a specific backup file for a university.

    Args:
        university_id: Target university id
        backup_name: Filename of the backup (e.g., "uni_1_20240101.sql.gz")
        delete_from_minio: Also delete corresponding object in MinIO if enabled

    Returns:
        dict with details: {"university_id", "filename", "deleted_local", "deleted_minio"[, "minio_error"]}

    Raises:
        FileNotFoundError: if the local backup file does not exist
    """
    # Basic filename validation to avoid path traversal
    if "/" in backup_name or ".." in backup_name or backup_name.strip() == "":
        raise FileNotFoundError("Invalid backup name")

    uni_dir = _ensure_uni_dir(university_id)
    backup_path = uni_dir / backup_name

    if not backup_path.exists():
        raise FileNotFoundError("Backup file not found")

    # Try removing local file
    deleted_local = False
    try:
        backup_path.unlink(missing_ok=False)
        deleted_local = True
    except FileNotFoundError:
        # Race: file disappeared between check and unlink
        deleted_local = False
    except Exception as e:
        # Log but continue to attempt MinIO deletion if requested
        logger.warning(f"[DELETE] Failed to delete local backup {backup_name}: {e}")

    # Optionally remove from MinIO
    deleted_minio = False
    minio_error: Optional[str] = None
    if delete_from_minio and MINIO_ENABLED:
        _ensure_minio_bucket()
        try:
            object_name = f"uni_{university_id}/{backup_name}"
            minio_client.remove_object(MINIO_BACKUP_BUCKET, object_name)
            deleted_minio = True
        except S3Error as e:
            # If object does not exist, treat as not fatal
            minio_error = str(e)
            logger.warning(f"[DELETE] MinIO removal issue for {backup_name}: {e}")
        except Exception as e:
            minio_error = str(e)
            logger.warning(f"[DELETE] MinIO removal unexpected error for {backup_name}: {e}")

    result: dict = {
        "university_id": university_id,
        "filename": backup_name,
        "deleted_local": deleted_local,
        "deleted_minio": deleted_minio,
    }
    if minio_error:
        result["minio_error"] = minio_error

    # Best-effort delete metadata row
    try:
        with SessionLocal() as db:
            db.execute(
                text(
                    "DELETE FROM public.university_backups_meta WHERE university_id = :uid AND filename = :fn"
                ),
                {"uid": university_id, "fn": backup_name},
            )
            db.commit()
    except Exception as e:
        logger.warning(f"[DELETE] Failed to delete metadata for {backup_name}: {e}")
    return result


def _pg_env() -> dict:
    env = os.environ.copy()
    if DB_PASSWORD:
        env["PGPASSWORD"] = DB_PASSWORD
    return env


def upload_to_minio(backup_path: Path, university_id: int) -> bool:
    """Upload a backup file to MinIO storage.
    
    Args:
        backup_path: Path to the local backup file
        university_id: University ID for organizing in MinIO
        
    Returns:
        True if upload successful, False otherwise
    """
    if not MINIO_ENABLED:
        logger.debug("[MINIO] MinIO uploads disabled via ENABLE_MINIO_BACKUPS")
        return False
        
    _ensure_minio_bucket()
    try:
        object_name = f"uni_{university_id}/{backup_path.name}"
        logger.info(f"[MINIO] Uploading {backup_path.name} to MinIO as {object_name}")
        
        minio_client.fput_object(
            MINIO_BACKUP_BUCKET,
            object_name,
            str(backup_path),
            content_type="application/gzip"
        )
        logger.info(f"[MINIO] ✓ Successfully uploaded to MinIO: {object_name}")
        return True
    except S3Error as e:
        logger.error(f"[MINIO] ✗ Failed to upload to MinIO: {e}")
        return False


def backup_university(db: Session, university_id: int, *, label: Optional[str] = None) -> Path:
    """Create a backup for a single university schema.

    Args:
        db: SQLAlchemy session
        university_id: Target university id
        label: Optional label suffix for the filename (e.g., 'prerestore_YYYYMMDD_HHMMSS')

    Returns:
        Path to the created .sql.gz file
    """
    info = _university_info(db, university_id)
    if not info:
        raise ValueError("University not found")

    schema = info["schema_name"]
    today = datetime.utcnow().strftime("%Y%m%d")
    suffix = label if label else today
    outfile_dir = _ensure_uni_dir(university_id)
    outfile = outfile_dir / f"{schema}_{suffix}.sql.gz"

    # Dump only the target schema
    cmd = [
        "pg_dump",
        "-h",
        DB_HOST,
        "-p",
        str(DB_PORT),
        "-U",
        DB_USER,
        "-d",
        DB_NAME,
        "-n",
        schema,
    ]

    # Stream dump through gzip
    env = _pg_env()
    with subprocess.Popen(cmd, stdout=subprocess.PIPE, env=env) as proc, gzip.open(outfile, "wb") as gz:
        assert proc.stdout is not None
        for chunk in iter(lambda: proc.stdout.read(8192), b""):
            gz.write(chunk)
        ret = proc.wait()
        if ret != 0:
            # Cleanup partial file
            try:
                outfile.unlink(missing_ok=True)
            except Exception:
                pass
            raise RuntimeError(f"pg_dump failed with exit code {ret}")

    # Upload to MinIO for redundancy
    upload_to_minio(outfile, university_id)

    return outfile


def enforce_retention(university_id: int, keep: int = RETENTION_COUNT) -> None:
    entries = list_backups(university_id)
    for e in entries[keep:]:
        try:
            e.path.unlink(missing_ok=True)
        except Exception:
            # best-effort cleanup
            pass


def ensure_today_backup(db: Session, university_id: int) -> Optional[Path]:
    """Create today's backup if not present. Returns path if created."""
    info = _university_info(db, university_id)
    if not info:
        return None
    schema = info["schema_name"]
    today = datetime.utcnow().strftime("%Y%m%d")
    uni_dir = _ensure_uni_dir(university_id)
    candidate = uni_dir / f"{schema}_{today}.sql.gz"
    if candidate.exists():
        return None
    created = backup_university(db, university_id)
    enforce_retention(university_id)
    return created


def restore_university(db: Session, university_id: int, backup_name: str, to_temp: bool = False) -> dict:
    """Restore a university schema from a backup file.

    Steps:
      1) Create a pre-restore snapshot (if not to_temp)
      2) Drop and recreate target schema
      3) Restore from provided backup (.sql.gz)
      
    Args:
        db: SQLAlchemy session
        university_id: Target university ID
        backup_name: Name of the backup file to restore
        to_temp: If True, restore to <schema>_temp instead of production schema
        
    Returns:
        dict with restore details including schema_name and is_temp flag
    """
    info = _university_info(db, university_id)
    if not info:
        raise ValueError("University not found")
    
    production_schema = info["schema_name"]
    target_schema = f"{production_schema}_temp" if to_temp else production_schema

    uni_dir = _ensure_uni_dir(university_id)
    backup_path = uni_dir / backup_name
    if not backup_path.exists() or not backup_path.name.endswith(".sql.gz"):
        raise FileNotFoundError("Backup file not found")

    # Pre-restore snapshot (only for production restores)
    if not to_temp:
        label = f"prerestore_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        logger.info(f"[RESTORE] Creating pre-restore snapshot: {label}")
        backup_university(db, university_id, label=label)
        enforce_retention(university_id)

    # Drop and recreate schema to ensure a clean state
    logger.info(f"[RESTORE] Dropping and recreating schema: {target_schema}")
    db.execute(text(f"DROP SCHEMA IF EXISTS {target_schema} CASCADE"))
    db.execute(text(f"CREATE SCHEMA {target_schema}"))
    db.commit()

    # Restore by piping decompressed SQL into psql
    # Note: The backup contains the original schema name, so we need to replace it
    logger.info(f"[RESTORE] Restoring from {backup_name} to {target_schema}")
    cmd = [
        "psql",
        "-h",
        DB_HOST,
        "-p",
        str(DB_PORT),
        "-U",
        DB_USER,
        "-d",
        DB_NAME,
    ]
    env = _pg_env()
    
    # Read and modify the SQL to replace schema name if restoring to temp
    with gzip.open(backup_path, "rb") as gz:
        sql_content = gz.read().decode('utf-8')
        
        # If restoring to temp, replace all occurrences of the production schema name
        if to_temp:
            logger.info(f"[RESTORE] Replacing schema references: {production_schema} → {target_schema}")
            sql_content = sql_content.replace(f" {production_schema}.", f" {target_schema}.")
            sql_content = sql_content.replace(f" {production_schema};", f" {target_schema};")
            sql_content = sql_content.replace(f'"{production_schema}"', f'"{target_schema}"')
    
    # Execute the modified SQL
    try:
        proc = subprocess.Popen(
            cmd, 
            stdin=subprocess.PIPE, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE, 
            env=env
        )
        
        # Send SQL content to stdin and get results
        stdout, stderr = proc.communicate(input=sql_content.encode('utf-8'), timeout=300)
        
        if proc.returncode != 0:
            error_msg = stderr.decode('utf-8') if stderr else "Unknown error"
            logger.error(f"[RESTORE] psql restore failed: {error_msg}")
            raise RuntimeError(f"psql restore failed with exit code {proc.returncode}: {error_msg}")
    except subprocess.TimeoutExpired:
        proc.kill()
        logger.error(f"[RESTORE] Restore operation timed out after 300 seconds")
        raise RuntimeError("Restore operation timed out")
    except Exception as e:
        logger.error(f"[RESTORE] Restore operation failed: {str(e)}")
        raise
    
    logger.info(f"[RESTORE] ✓ Successfully restored to {target_schema}")

    temp_university_id: Optional[int] = None
    if to_temp:
        try:
            temp_university_id = _ensure_temp_university_entry(db, university_id)
            logger.info(f"[RESTORE] Temp university registry entry ensured (id={temp_university_id})")
        except Exception as e:
            logger.warning(f"[RESTORE] Failed to ensure temp university entry: {e}")

    return {
        "schema_name": target_schema,
        "is_temp": to_temp,
        "production_schema": production_schema,
        "university_id": university_id,
        "temp_university_id": temp_university_id,
    }


def promote_temp_to_production(db: Session, university_id: int) -> dict:
    """Promote a temporary schema to production.
    
    Steps:
        1. Create a backup of current production (safety snapshot)
        2. Rename production schema to <schema>_old
        3. Rename temp schema to production name
        4. Drop old schema
        
    Returns:
        dict with operation details
    """
    info = _university_info(db, university_id)
    if not info:
        raise ValueError("University not found")
        
    production_schema = info["schema_name"]
    temp_schema = f"{production_schema}_temp"
    old_schema = f"{production_schema}_old"
    
    # Check if temp schema exists
    result = db.execute(
        text("SELECT schema_name FROM information_schema.schemata WHERE schema_name = :name"),
        {"name": temp_schema}
    ).fetchone()
    
    if not result:
        raise ValueError(f"Temporary schema {temp_schema} does not exist. Nothing to promote.")
    
    logger.info(f"[PROMOTE] Starting promotion: {temp_schema} → {production_schema}")
    
    # Create safety backup of current production
    label = f"pre_promote_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    logger.info(f"[PROMOTE] Creating safety backup: {label}")
    backup_university(db, university_id, label=label)
    
    # Drop old schema if it exists (from previous promotion)
    logger.info(f"[PROMOTE] Dropping old schema if exists: {old_schema}")
    db.execute(text(f"DROP SCHEMA IF EXISTS {old_schema} CASCADE"))
    db.commit()
    
    # Rename production to old
    logger.info(f"[PROMOTE] Renaming: {production_schema} → {old_schema}")
    db.execute(text(f"ALTER SCHEMA {production_schema} RENAME TO {old_schema}"))
    db.commit()
    
    # Rename temp to production
    logger.info(f"[PROMOTE] Renaming: {temp_schema} → {production_schema}")
    db.execute(text(f"ALTER SCHEMA {temp_schema} RENAME TO {production_schema}"))
    db.commit()
    
    # Drop old schema after successful promotion
    logger.info(f"[PROMOTE] Dropping old schema: {old_schema}")
    db.execute(text(f"DROP SCHEMA {old_schema} CASCADE"))
    db.commit()
    
    logger.info(f"[PROMOTE] ✓ Successfully promoted {temp_schema} to production")

    # Clean up temp university registry row if present
    try:
        _remove_temp_university_entry(db, university_id)
    except Exception as e:
        logger.warning(f"[PROMOTE] Failed to remove temp university entry: {e}")
    
    return {
        "message": "Temporary schema successfully promoted to production",
        "schema_name": production_schema,
        "university_id": university_id
    }


def delete_temp_schema(db: Session, university_id: int) -> dict:
    """Delete a temporary schema (if validation shows it's not needed).
    
    Returns:
        dict with operation details
    """
    info = _university_info(db, university_id)
    if not info:
        raise ValueError("University not found")
        
    production_schema = info["schema_name"]
    temp_schema = f"{production_schema}_temp"
    
    logger.info(f"[CLEANUP] Dropping temporary schema: {temp_schema}")
    db.execute(text(f"DROP SCHEMA IF EXISTS {temp_schema} CASCADE"))
    db.commit()
    
    logger.info(f"[CLEANUP] ✓ Successfully dropped {temp_schema}")

    # Remove temp university registry row
    try:
        _remove_temp_university_entry(db, university_id)
    except Exception as e:
        logger.warning(f"[CLEANUP] Failed to remove temp university entry: {e}")
    
    return {
        "message": "Temporary schema deleted",
        "schema_name": temp_schema,
        "university_id": university_id
    }


# Background scheduler ---------------------------------------------------------

import asyncio


async def _backup_loop():
    """Periodic task that ensures one backup per day for each active university."""
    # Staggered sleep at start to avoid running immediately on frequent reloads
    await asyncio.sleep(5)
    while True:
        try:
            with SessionLocal() as db:
                rows = db.execute(
                    text("SELECT id FROM public.universities WHERE is_active = TRUE")
                ).fetchall()
                for (uid,) in rows:
                    try:
                        created = ensure_today_backup(db, int(uid))
                        if created:
                            print(f"[backups] Created daily backup for uni {uid}: {created}")
                    except Exception as e:
                        print(f"[backups] Failed backup for uni {uid}: {e}")
        except Exception as e:
            print(f"[backups] Loop error: {e}")
        # Sleep ~1 hour; ensures at-most-once daily due to filename check
        await asyncio.sleep(3600)


_scheduler_task: Optional[asyncio.Task] = None


def start_backup_scheduler() -> None:
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        return
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    _scheduler_task = loop.create_task(_backup_loop())
