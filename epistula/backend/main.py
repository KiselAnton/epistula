from fastapi import FastAPI
from auth import router as auth_router

app = FastAPI(title="Epistula ISO", version="0.1.0")

# Include authentication and user management router
app.include_router(auth_router)

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/version")
def get_version():
    return {"version": "0.1.0", "service": "Epistula ISO"}
