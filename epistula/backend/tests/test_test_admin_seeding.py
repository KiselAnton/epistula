import os
from fastapi.testclient import TestClient


def test_seed_test_admin_creates_user_and_can_login(monkeypatch):
    # Ensure env enables seeding with known credentials
    monkeypatch.setenv("EPISTULA_SEED_TEST_ADMIN", "1")
    monkeypatch.setenv("EPISTULA_TEST_ADMIN_EMAIL", "test_admin@site.com")
    monkeypatch.setenv("EPISTULA_TEST_ADMIN_PASSWORD", "changeme123")

    # Run seeding explicitly (startup is patched to no-op in tests)
    from init_test_admin import init_test_admin
    from utils.database import SessionLocal
    from utils.models import UserDB, UserUniversityRoleDB

    # Ensure clean slate - delete roles first, then user
    db = SessionLocal()
    try:
        # Find user first
        user = db.query(UserDB).filter(UserDB.email == "test_admin@site.com").first()
        if user:
            # Delete roles that reference this user
            db.query(UserUniversityRoleDB).filter(UserUniversityRoleDB.created_by == user.id).delete()
            # Delete roles for this user
            db.query(UserUniversityRoleDB).filter(UserUniversityRoleDB.user_id == user.id).delete()
            # Now delete the user
            db.delete(user)
        db.commit()
    finally:
        db.close()

    init_test_admin()

    # Verify login works via real /login endpoint
    import main as app_main
    with TestClient(app_main.app) as client:
        r = client.post(
            "/api/v1/auth/login",
            json={"email": "test_admin@site.com", "password": "changeme123"},
            headers={"Origin": "http://localhost:3000"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["user"]["email"] == "test_admin@site.com"
        # CORS headers should be present on success
        assert r.headers.get("access-control-allow-origin") in ("http://localhost:3000", "*")


def test_seed_test_admin_updates_password(monkeypatch):
    monkeypatch.setenv("EPISTULA_SEED_TEST_ADMIN", "1")
    monkeypatch.setenv("EPISTULA_TEST_ADMIN_EMAIL", "test_admin@site.com")
    monkeypatch.setenv("EPISTULA_TEST_ADMIN_PASSWORD", "newpass123")
    monkeypatch.setenv("RESET_TEST_ADMIN_PASSWORD_ON_START", "1")

    from init_test_admin import init_test_admin
    from utils.database import SessionLocal
    from utils.models import UserDB
    from middleware.auth import hash_password

    # Seed existing user with old password
    db = SessionLocal()
    try:
        user = db.query(UserDB).filter(UserDB.email == "test_admin@site.com").first()
        if not user:
            user = UserDB(email="test_admin@site.com", password_hash=hash_password("old"), name="TA", is_active=True)
            db.add(user)
        else:
            user.password_hash = hash_password("old")
        db.commit()
    finally:
        db.close()

    init_test_admin()

    # Should be able to login with new password
    import main as app_main
    with TestClient(app_main.app) as client:
        r = client.post(
            "/api/v1/auth/login",
            json={"email": "test_admin@site.com", "password": "newpass123"},
            headers={"Origin": "http://localhost:3000"},
        )
        assert r.status_code == 200, r.text


def test_seed_test_admin_noop_when_disabled(monkeypatch):
    monkeypatch.setenv("EPISTULA_SEED_TEST_ADMIN", "0")
    monkeypatch.delenv("EPISTULA_TEST_ADMIN_EMAIL", raising=False)
    monkeypatch.delenv("EPISTULA_TEST_ADMIN_PASSWORD", raising=False)

    from init_test_admin import init_test_admin
    from utils.database import SessionLocal
    from utils.models import UserDB, UserUniversityRoleDB

    # Remove any existing test admin - delete roles first, then user
    db = SessionLocal()
    try:
        user = db.query(UserDB).filter(UserDB.email == "test_admin@site.com").first()
        if user:
            # Delete roles that reference this user
            db.query(UserUniversityRoleDB).filter(UserUniversityRoleDB.created_by == user.id).delete()
            # Delete roles for this user
            db.query(UserUniversityRoleDB).filter(UserUniversityRoleDB.user_id == user.id).delete()
            # Now delete the user
            db.delete(user)
        db.commit()
    finally:
        db.close()

    init_test_admin()

    # Ensure user not created
    db = SessionLocal()
    try:
        assert db.query(UserDB).filter(UserDB.email == "test_admin@site.com").count() == 0
    finally:
        db.close()
