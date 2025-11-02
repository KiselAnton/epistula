import os
from fastapi.testclient import TestClient
import importlib


def make_client(monkeypatch):
    # Ensure startup side effects are disabled
    import main as app_main
    monkeypatch.setattr(app_main, "ensure_bucket_exists", lambda: None, raising=False)
    monkeypatch.setattr(app_main, "start_backup_scheduler", lambda: None, raising=False)
    monkeypatch.setattr(app_main, "init_root_user", lambda: None, raising=False)
    return TestClient(app_main.app)


def test_health_endpoint_and_cors(monkeypatch):
    # Force dev defaults for CORS
    monkeypatch.setenv("EPISTULA_ENV", "development")
    client = make_client(monkeypatch)

    origin = "http://localhost:3000"
    r = client.get("/health", headers={"Origin": origin})
    assert r.status_code == 200
    assert r.json().get("status") == "healthy"
    # CORSMiddleware should echo origin for allowed dev origins
    allow_origin = r.headers.get("access-control-allow-origin")
    assert allow_origin in (origin, "*")


def test_cors_preflight_options(monkeypatch):
    monkeypatch.setenv("EPISTULA_ENV", "development")
    client = make_client(monkeypatch)

    origin = "http://localhost:3000"
    headers = {
        "Origin": origin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization,content-type",
    }
    r = client.options("/health", headers=headers)
    assert r.status_code in (200, 204)
    # Preflight response should include CORS headers
    assert r.headers.get("access-control-allow-origin") in (origin, "*")
    assert "GET" in r.headers.get("access-control-allow-methods", "")


def test_allowed_origins_helper(monkeypatch):
    # Validate helper still includes dev localhost by default
    monkeypatch.setenv("EPISTULA_ENV", "development")
    import main as app_main
    origins = app_main._get_allowed_origins()
    assert "http://localhost:3000" in origins
