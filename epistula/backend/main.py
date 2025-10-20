from pathlib import Path
from fastapi import FastAPI
from auth import router as auth_router

# Read version from VERSION file
def get_version_from_file():
    version_file = Path(__file__).parent / "VERSION"
    if version_file.exists():
        return version_file.read_text().strip()
    return "0.1.0"  # fallback version

VERSION = get_version_from_file()

app = FastAPI(title="Epistula ISO", version=VERSION)

# Include authentication and user management router
app.include_router(auth_router)

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/version")
def get_version():
    return {"version": VERSION, "service": "Epistula ISO"}
