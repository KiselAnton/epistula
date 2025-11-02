import types
from typing import Iterator

import pytest
from fastapi.testclient import TestClient

# Import shared test utilities
from .test_utils import DummyUser

# Global current user used by dependency override
_CURRENT_USER = None


@pytest.fixture()
def client(monkeypatch) -> Iterator[TestClient]:
    """Create a TestClient with startup side-effects disabled.

    We monkeypatch startup utilities to no-op so tests don't require external
    services (MinIO, schedulers, or root init). Tests can still override
    dependencies like get_db on app.dependency_overrides if needed.
    """
    import main as app_main
    import middleware.auth as auth_utils

    # Disable startup side-effects
    monkeypatch.setattr(app_main, "ensure_bucket_exists", lambda: None, raising=False)
    monkeypatch.setattr(app_main, "start_backup_scheduler", lambda: None, raising=False)
    monkeypatch.setattr(app_main, "init_root_user", lambda: None, raising=False)

    # Provide a default current user for all tests via dependency override
    # Tests can change _CURRENT_USER via the set_user fixture below.
    def _override_get_current_user():
        from .conftest import _CURRENT_USER, DummyUser
        return _CURRENT_USER or DummyUser()

    app_main.app.dependency_overrides[auth_utils.get_current_user] = _override_get_current_user

    with TestClient(app_main.app) as c:
        yield c

    # Clear overrides after tests finish
    app_main.app.dependency_overrides.clear()


def make_pydantic_user(**overrides):
    """Return a utils.models.User populated from defaults + overrides."""
    from utils.models import User, UserRole
    import datetime as _dt
    data = {
        "id": "1",
        "email": overrides.get("email", "user@example.com"),
        "name": overrides.get("name", "Test User"),
        "role": overrides.get("role", UserRole.ROOT if overrides.get("is_root") else UserRole.STUDENT),
        "created_at": overrides.get("created_at", _dt.datetime.now(_dt.timezone.utc)),
        "updated_at": overrides.get("updated_at", _dt.datetime.now(_dt.timezone.utc)),
        "is_active": overrides.get("is_active", True),
        "universities": overrides.get("universities", []),
        "primary_university_id": overrides.get("primary_university_id"),
    }
    return User(**data)


@pytest.fixture()
def set_user():
    """Fixture to set the current user returned by get_current_user dependency.

    Usage:
        def test_x(set_user):
            set_user(DummyUser(is_root=True))
            ...
    """
    from .conftest import DummyUser
    def _set(user: DummyUser | None):
        from .conftest import _CURRENT_USER
        # assign to module global
        globals()["_CURRENT_USER"] = user
    return _set
