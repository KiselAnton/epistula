"""Main FastAPI application module for Epistula ISO service.

This module initializes the FastAPI application, manages versioning,
and defines core health check endpoints.
"""

from pathlib import Path
from fastapi import FastAPI
from auth import router as auth_router


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
app = FastAPI(title="Epistula ISO", version=VERSION)

# Include authentication and user management router
app.include_router(auth_router)


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
