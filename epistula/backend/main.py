"""Main FastAPI application module for Epistula ISO service.

This module initializes the FastAPI application, manages versioning,
and defines core health check endpoints.
"""

from pathlib import Path
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from routers.auth import router as auth_router
from routers.universities import router as universities_router
from routers.faculties import router as faculties_router
from routers.faculty_professors import router as faculty_professors_router
from routers.faculty_students import router as faculty_students_router
from routers.subjects import router as subjects_router
from routers.subject_professors import router as subject_professors_router
from routers.subject_students import router as subject_students_router
from routers.lectures import router as lectures_router
from routers.storage import router as storage_router
from routers.users import router as users_router
from routers.backups import router as backups_router
from routers.data_transfer import router as data_transfer_router
from init_root_user import init_root_user
from utils.minio_client import ensure_bucket_exists
from utils.backups import start_backup_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager - runs on startup and shutdown.
    
    This ensures the root user is created from environment variables
    when the application starts, and MinIO bucket is initialized.
    """
    # Startup
    print("Starting up Epistula...")
    init_root_user()
    
    # Initialize MinIO bucket
    try:
        ensure_bucket_exists()
        print("MinIO initialized successfully")
    except Exception as e:
        print(f"Warning: MinIO initialization failed: {e}")
        print("File uploads may not work properly")

    # Start backup scheduler (ensures daily per-university backups)
    try:
        start_backup_scheduler()
        print("Backup scheduler started")
    except Exception as e:
        print(f"Warning: Failed to start backup scheduler: {e}")
    
    yield
    # Shutdown
    print("Shutting down Epistula...")


def get_version_from_file() -> str:
    """Read version string from VERSION file.

    Returns:
        str: Version string from VERSION file, or '0.1.0' if file not found.
    """
    version_file = Path(__file__).parent / "VERSION"
    if version_file.exists():
        return version_file.read_text().strip()
    return "0.1.0"  # fallback version


VERSION = get_version_from_file()
app = FastAPI(title="Epistula ISO", version=VERSION, lifespan=lifespan)

# Include authentication and user management router
app.include_router(auth_router)
app.include_router(universities_router)
app.include_router(faculties_router)
app.include_router(faculty_professors_router)
app.include_router(faculty_students_router)
app.include_router(subjects_router)
app.include_router(subject_professors_router)
app.include_router(subject_students_router)
app.include_router(lectures_router)
app.include_router(storage_router)
app.include_router(users_router)
app.include_router(backups_router)
app.include_router(data_transfer_router)

# CORS configuration ---------------------------------------------------------


def _get_allowed_origins() -> list[str]:
    """Return CORS allow_origins from env with sensible dev defaults.

    - EPISTULA_CORS_ORIGINS: comma-separated list (no spaces) of allowed origins.
    - In development, always include localhost and 127.0.0.1 on port 3000 so the
      Next.js dev server works out of the box, even if the env var is set.
    """
    origins: list[str] = []
    origins_str = os.getenv("EPISTULA_CORS_ORIGINS")
    if origins_str and origins_str.strip() != "*":
        origins.extend([o.strip() for o in origins_str.split(",") if o.strip()])

    env = os.getenv("EPISTULA_ENV", "development").lower()
    if env == "development":
        for dev_origin in [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://localhost:3000",
            "https://127.0.0.1:3000",
        ]:
            if dev_origin not in origins:
                origins.append(dev_origin)

    # Fallback if empty or "*"
    if not origins or (len(origins) == 1 and origins[0] == "*"):
        origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    return origins


def _get_allowed_origin_regex() -> str | None:
    """Optionally allow private LAN origins on port 3000 in development.

    This enables accessing the frontend from devices on the same network
    (e.g., iPad at http://<lan-ip>:3000) without explicitly listing each IP.
    """
    env = os.getenv("EPISTULA_ENV", "development").lower()
    if env != "development":
        return None
    # Allow http://localhost:3000, http://127.0.0.1:3000, and RFC1918 LAN ranges on port 3000
    # Allow both http and https on port 3000 for local and LAN IPs
    return r"^https?://(localhost|127\.0\.0\.1|10\..*|172\.(1[6-9]|2\d|3[01])\..*|192\.168\..*):3000$"


allowed_origins = _get_allowed_origins()
allowed_origin_regex = _get_allowed_origin_regex()

print("[CORS] Allowed origins:", allowed_origins)
if allowed_origin_regex:
    print("[CORS] Allowed origin regex:", allowed_origin_regex)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Health check endpoint
@app.get("/health")
def health():
    """Health check endpoint.

    Returns:
        dict: Simple status response.
    """
    return {"status": "healthy", "version": VERSION}


@app.get("/")
def root():
    """Root endpoint with API information.

    Returns:
        dict: API version and status.
    """
    return {
        "message": "Epistula ISO API",
        "version": VERSION,
        "status": "running",
        "docs": "/docs"
    }

