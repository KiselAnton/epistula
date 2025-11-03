"""
Tests for root login local-only restriction.

We avoid any real DB dependency by patching authenticate_user, token creation,
and db_user_to_pydantic, focusing solely on the IP restriction behavior.
"""
import os
import pytest


class _DummyDBUser:
    def __init__(self, id=1, email="root@example.com", name="Root", is_root=True):
        self.id = id
        self.email = email
        self.name = name
        self.is_root = is_root


def test_root_login_denied_from_remote_ip(client, monkeypatch):
    # Arrange: patch auth helpers to avoid DB
    import routers.auth as auth_router
    import middleware.auth as auth_utils
    dummy = _DummyDBUser()
    monkeypatch.setattr(auth_router, "authenticate_user", lambda db, e, p: dummy)
    monkeypatch.setattr(auth_router, "create_access_token", lambda data: "tok")
    monkeypatch.setattr(auth_utils, "db_user_to_pydantic", lambda db_user, db=None: {
        "id": str(dummy.id),
        "email": dummy.email,
        "name": dummy.name,
        "role": "root",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
        "is_active": True,
        "universities": [],
        "university_access": [],
        "primary_university_id": None,
    })

    # Trust proxy to read X-Forwarded-For and enforce local-only
    monkeypatch.setenv("EPISTULA_TRUST_PROXY", "true")
    monkeypatch.setenv("EPISTULA_ROOT_LOCAL_ONLY", "true")

    # Act: attempt login with a non-local IP
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": dummy.email, "password": "ignored"},
        headers={"X-Forwarded-For": "192.168.1.55"},
    )

    # Assert
    assert resp.status_code == 403
    assert "local host" in resp.json().get("detail", "").lower()


def test_root_login_allowed_from_localhost(client, monkeypatch):
    # Arrange: patch auth helpers to avoid DB
    import routers.auth as auth_router
    import middleware.auth as auth_utils
    dummy = _DummyDBUser()
    monkeypatch.setattr(auth_router, "authenticate_user", lambda db, e, p: dummy)
    monkeypatch.setattr(auth_router, "create_access_token", lambda data: "tok")
    monkeypatch.setattr(auth_utils, "db_user_to_pydantic", lambda db_user, db=None: {
        "id": str(dummy.id),
        "email": dummy.email,
        "name": dummy.name,
        "role": "root",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
        "is_active": True,
        "universities": [],
        "university_access": [],
        "primary_university_id": None,
    })
    monkeypatch.setenv("EPISTULA_TRUST_PROXY", "true")
    monkeypatch.setenv("EPISTULA_ROOT_LOCAL_ONLY", "true")

    # Act: simulate localhost via X-Forwarded-For
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": dummy.email, "password": "ignored"},
        headers={"X-Forwarded-For": "127.0.0.1"},
    )

    # Assert
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("access_token") == "tok"
    assert body.get("user", {}).get("role") == "root"
