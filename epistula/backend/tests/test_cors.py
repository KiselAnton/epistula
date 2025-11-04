from fastapi.testclient import TestClient


def make_client(monkeypatch):
    import main as app_main
    # Disable startup side-effects
    monkeypatch.setattr(app_main, "ensure_bucket_exists", lambda: None, raising=False)
    monkeypatch.setattr(app_main, "start_backup_scheduler", lambda: None, raising=False)
    monkeypatch.setattr(app_main, "init_root_user", lambda: None, raising=False)
    return TestClient(app_main.app)


def test_cors_preflight_login_options(monkeypatch):
    monkeypatch.setenv("EPISTULA_ENV", "development")
    client = make_client(monkeypatch)
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    }
    resp = client.options("/api/v1/auth/login", headers=headers)
    assert resp.status_code in (200, 204)
    assert resp.headers.get("access-control-allow-origin") in ("http://localhost:3000", "*")
    assert "POST" in resp.headers.get("access-control-allow-methods", "")
    assert "content-type" in resp.headers.get("access-control-allow-headers", "").lower()


def test_cors_on_error_response_still_has_headers(monkeypatch):
    monkeypatch.setenv("EPISTULA_ENV", "development")
    client = make_client(monkeypatch)
    # Send invalid JSON to trigger 422 but still expect CORS header
    headers = {
        "Origin": "http://localhost:3000",
        "Content-Type": "application/json",
    }
    resp = client.post("/api/v1/auth/login", content="not-json", headers=headers)
    assert resp.status_code in (400, 415, 422)
    assert resp.headers.get("access-control-allow-origin") in ("http://localhost:3000", "*")


def test_cors_preflight_faculty_professors_options(monkeypatch):
    monkeypatch.setenv("EPISTULA_ENV", "development")
    client = make_client(monkeypatch)
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization, content-type",
    }
    resp = client.options("/api/v1/faculties/1/2/professors", headers=headers)
    assert resp.status_code in (200, 204)
    assert resp.headers.get("access-control-allow-origin") in ("http://localhost:3000", "*")
    allow_methods = resp.headers.get("access-control-allow-methods", "")
    assert "POST" in allow_methods or "*" in allow_methods
    allow_headers = resp.headers.get("access-control-allow-headers", "").lower()
    assert "authorization" in allow_headers or "*" in allow_headers
    assert "content-type" in allow_headers or "*" in allow_headers


def test_cors_header_on_unauthorized_faculty_professors_post(monkeypatch):
    monkeypatch.setenv("EPISTULA_ENV", "development")
    client = make_client(monkeypatch)
    # No Authorization header to trigger 401 from auth dependency
    headers = {
        "Origin": "http://localhost:3000",
        "Content-Type": "application/json",
    }
    resp = client.post("/api/v1/faculties/1/2/professors", json={"professor_id": 1}, headers=headers)
    # Missing auth may yield 401/403; if the resource isn't present in test DB it can be 404. In all cases, CORS headers must be present.
    assert resp.status_code in (401, 403, 404)
    assert resp.headers.get("access-control-allow-origin") in ("http://localhost:3000", "*")
