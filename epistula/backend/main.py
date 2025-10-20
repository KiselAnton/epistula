from fastapi import FastAPI

app = FastAPI(title="Epistula ISO", version="0.1.0")

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/version")
def get_version():
    return {"version": "0.1.0", "service": "Epistula ISO"}
