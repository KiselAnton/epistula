"""Main FastAPI application module for Epistula ISO service.

This module initializes the FastAPI application, manages versioning,
and defines core health check endpoints.
"""

from pathlib import Path
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from auth import router as auth_router
from init_root_user import init_root_user


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager - runs on startup and shutdown.
    
    This ensures the root user is created from environment variables
    when the application starts.
    """
    # Startup
    print("Starting up Epistula...")
    init_root_user()
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

# CORS configuration ---------------------------------------------------------


def _get_allowed_origins() -> list[str]:
    """Return CORS allow_origins from env.

    EPISTULA_CORS_ORIGINS: comma-separated list of origins. Examples:
      - "http://localhost:3000"
      - "http://localhost:3000,http://127.0.0.1:3000"
      - "*" (development only; DO NOT use in production)
    """
    raw = os.environ.get("EPISTULA_CORS_ORIGINS", "*").strip()
    if raw in ("", "*"):
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]


ALLOWED_ORIGINS = _get_allowed_origins()

# WARNING (production): avoid using "*" for allow_origins in production.
# Set EPISTULA_CORS_ORIGINS to a comma-separated list of trusted origins.
# Example: EPISTULA_CORS_ORIGINS="http://localhost:3000,http://my-host:3000"
if (
    os.environ.get("EPISTULA_ENV", "development").lower() == "production"
    and "*" in ALLOWED_ORIGINS
):
    # Print a clear warning in logs if misconfigured in production
    warn_msg = (
        "[WARN] CORS allow_origins='*' detected in production. "
        "Set EPISTULA_CORS_ORIGINS to restrict origins."
    )
    print(warn_msg)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,  # we don't use cookies/credentials in this build
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.get("/health")
def health_check() -> dict[str, str]:
    """Health check endpoint.

    Returns:
        dict[str, str]: Status dictionary indicating service health.
    """
    return {"status": "healthy"}


@app.get("/version")
def get_version() -> dict[str, str]:
    """Get service version information.

    Returns:
        dict[str, str]: Dictionary containing version and service name.
    """
    return {"version": VERSION, "service": "Epistula ISO"}
