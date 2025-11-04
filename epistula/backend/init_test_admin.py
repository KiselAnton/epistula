"""Initialize a development test admin user on application startup.

This utility seeds a non-root admin account for manual testing in development
or when explicitly enabled via environment variables.

Defaults:
- EPISTULA_SEED_TEST_ADMIN: '1' in development, otherwise '0'
- EPISTULA_TEST_ADMIN_EMAIL: 'test_admin@site.com'
- EPISTULA_TEST_ADMIN_PASSWORD: 'changeme123'
- RESET_TEST_ADMIN_PASSWORD_ON_START: '0' (set to '1' to force-update password)

It will create the user in public.users if missing, and if any active
university exists, it will grant UNI_ADMIN role for the first one.
"""

from __future__ import annotations
import os
from sqlalchemy.orm import Session
from sqlalchemy import select
from utils.database import SessionLocal
from utils.models import UserDB, UniversityDB, UserUniversityRoleDB
from middleware.auth import hash_password


def _should_seed() -> bool:
    env = os.getenv("EPISTULA_ENV", "development").lower()
    default = env == "development"
    flag = os.getenv("EPISTULA_SEED_TEST_ADMIN")
    if flag is None:
        return default
    return flag.strip().lower() in ("1", "true", "yes")


def init_test_admin() -> None:
    """Create or update a test admin user if enabled by env.

    Safe to call multiple times; it's idempotent.
    """
    if not _should_seed():
        return

    email = os.getenv("EPISTULA_TEST_ADMIN_EMAIL", "test_admin@site.com").strip()
    password = os.getenv("EPISTULA_TEST_ADMIN_PASSWORD", "changeme123")
    reset = os.getenv("RESET_TEST_ADMIN_PASSWORD_ON_START", "0").lower() in ("1", "true", "yes")

    if not email or not password:
        print("[seed] Skipping test admin seeding: missing email or password")
        return

    db: Session = SessionLocal()
    try:
        user = db.execute(select(UserDB).where(UserDB.email == email)).scalar_one_or_none()
        if user:
            if reset:
                user.password_hash = hash_password(password)
                user.is_active = True
                db.add(user)
                db.commit()
                print(f"✓ Test admin password updated: {email}")
            else:
                print(f"Test admin already exists: {email}")
        else:
            user = UserDB(
                email=email,
                password_hash=hash_password(password),
                name="Test Admin",
                is_active=True,
                is_root=False,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"✓ Test admin created: {email} (ID: {user.id})")

        # Optionally grant UNI_ADMIN on the first active, non-temp university
        uni = db.execute(
            select(UniversityDB).where(UniversityDB.is_active == True).order_by(UniversityDB.id.asc())
        ).scalar_one_or_none()
        if uni:
            existing_role = db.execute(
                select(UserUniversityRoleDB).where(
                    (UserUniversityRoleDB.user_id == user.id) &
                    (UserUniversityRoleDB.university_id == uni.id)
                )
            ).scalar_one_or_none()
            if not existing_role:
                rel = UserUniversityRoleDB(
                    user_id=user.id,
                    university_id=uni.id,
                    role="uni_admin",
                    created_by=None,
                )
                db.add(rel)
                db.commit()
                print(f"✓ Granted UNI_ADMIN for university {uni.id} to {email}")
    except Exception as e:
        db.rollback()
        # Don't raise to avoid crashing app in dev; surface as warning
        print(f"WARNING: Failed to seed test admin: {e}")
    finally:
        db.close()
