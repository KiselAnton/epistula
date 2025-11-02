from typing import Any

import pytest

from .test_utils import DummyUser
from .conftest import make_pydantic_user


def test_login_success(client, monkeypatch):
    # Patch auth helpers: authenticate_user returns a dummy DB user; token creation returns fixed value
    import routers.auth as auth_router
    import middleware.auth as auth_utils

    dummy_db_user = DummyUser(id=42, email="root@example.com", name="Root", is_root=True)

    # Patch the symbol used by the router, not the origin module only
    monkeypatch.setattr(auth_router, "authenticate_user", lambda db, email, pwd: dummy_db_user)
    monkeypatch.setattr(auth_router, "create_access_token", lambda data: "testtoken123")
    # Avoid DB lookups inside db_user_to_pydantic for this test: return a prebuilt user
    monkeypatch.setattr(auth_utils, "db_user_to_pydantic", lambda db_user, db=None: make_pydantic_user(
        id=str(dummy_db_user.id), email=dummy_db_user.email, name=dummy_db_user.name, is_root=True
    ))

    resp = client.post("/api/v1/auth/login", json={"email": "root@example.com", "password": "secret"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["access_token"] == "testtoken123"
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "root@example.com"


def test_login_failure_unauthorized(client, monkeypatch):
    import middleware.auth as auth_utils
    # Return None to indicate failed auth
    monkeypatch.setattr(auth_utils, "authenticate_user", lambda db, email, pwd: None)

    resp = client.post("/api/v1/auth/login", json={"email": "nope@example.com", "password": "wrong"})
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Incorrect email or password"


def test_get_me_requires_auth_header(client):
    # No Authorization header should be rejected by HTTPBearer
    # Temporarily remove dependency override so HTTPBearer runs
    import main as app_main
    import middleware.auth as auth_utils
    app_main.app.dependency_overrides.pop(auth_utils.get_current_user, None)

    r = client.get("/api/v1/auth/me")
    assert r.status_code in (401, 403)


def test_get_me_success_with_dependency_override(client, monkeypatch, set_user):
    # Patch the dependency used by this router to return our dummy user
    import routers.auth as auth_router
    import middleware.auth as auth_utils

    dummy_db_user = DummyUser(id=7, email="user@example.com", name="U", is_root=False)
    set_user(dummy_db_user)
    # Return a pydantic user from db_user_to_pydantic
    monkeypatch.setattr(auth_utils, "db_user_to_pydantic", lambda db_user, db=None: make_pydantic_user(
        id=str(dummy_db_user.id), email=dummy_db_user.email, name=dummy_db_user.name, is_root=False
    ))

    # Provide a dummy Authorization header to satisfy HTTPBearer (value won't be parsed since we patched dependency)
    r = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer ignored"})
    assert r.status_code == 200
    assert r.json()["email"] == "user@example.com"
