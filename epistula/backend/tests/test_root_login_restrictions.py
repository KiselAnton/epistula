"""
Tests for root login local-only restriction.

We create a root user directly in the database and verify that:
- Login from a remote IP (via X-Forwarded-For when trusting proxy) is denied (403)
- Login from localhost is allowed
"""
import os
import pytest
from fastapi.testclient import TestClient

from utils.database import SessionLocal
from utils.models import UserDB
from middleware.auth import hash_password
import main as app_main


def _ensure_root_user(default_email: str = "root@epistula.edu", password: str = "RootPass123!") -> tuple[str, str]:
    """Ensure there's exactly one root user and return its email/password.

    If a root user exists, update its password and use its existing email.
    Otherwise, create a new root user with the default email.
    """
    db = SessionLocal()
    try:
        # Prefer existing root user if present (DB enforces only one)
        user = db.query(UserDB).filter(UserDB.is_root == True).first()
        if user:
            user.password_hash = hash_password(password)
            user.is_active = True
        else:
            # Fall back to creating one with the default email
            user = UserDB(
                email=default_email,
                password_hash=hash_password(password),
                name="Root",
                is_active=True,
                is_root=True,
            )
            db.add(user)
        db.commit()
        email = user.email
    finally:
        db.close()
    return email, password


@pytest.fixture()
def client_with_startup(monkeypatch) -> TestClient:
    """Create a TestClient without disabling startup, so routes use defaults."""
    # Unlike the standard client fixture in conftest.py, we keep startup logic default here.
    # Still avoid external systems by no-oping MinIO and scheduler.
    monkeypatch.setattr(app_main, "ensure_bucket_exists", lambda: None, raising=False)
    monkeypatch.setattr(app_main, "start_backup_scheduler", lambda: None, raising=False)
    # Do not call init_root_user; we'll create root directly in DB
    monkeypatch.setattr(app_main, "init_root_user", lambda: None, raising=False)
    with TestClient(app_main.app) as c:
        yield c


def test_root_login_denied_from_remote_ip(client_with_startup, monkeypatch):
    # Arrange: ensure root user exists
    email, password = _ensure_root_user()
    # Trust proxy to read X-Forwarded-For and enforce local-only
    monkeypatch.setenv("EPISTULA_TRUST_PROXY", "true")
    monkeypatch.setenv("EPISTULA_ROOT_LOCAL_ONLY", "true")

    # Act: attempt login with a non-local IP
    resp = client_with_startup.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
        headers={"X-Forwarded-For": "192.168.1.55"},
    )

    # Assert
    assert resp.status_code == 403
    assert "local host" in resp.json().get("detail", "").lower()


def test_root_login_allowed_from_localhost(client_with_startup, monkeypatch):
    # Arrange
    email, password = _ensure_root_user()
    monkeypatch.setenv("EPISTULA_TRUST_PROXY", "true")
    monkeypatch.setenv("EPISTULA_ROOT_LOCAL_ONLY", "true")

    # Act: simulate localhost via X-Forwarded-For
    resp = client_with_startup.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
        headers={"X-Forwarded-For": "127.0.0.1"},
    )

    # Assert
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("access_token")
    assert body.get("user", {}).get("role") == "root"
