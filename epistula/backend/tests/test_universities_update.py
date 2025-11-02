from .test_utils import DummyUser, FakeUniversity, FakeUserUniversityRole


def test_update_university_allowed_for_uni_admin(client, monkeypatch, set_user):
    # Setup: user is uni_admin for target university; DB returns existing uni; changes applied
    from utils.models import UniversityDB, UserUniversityRoleDB

    uni = FakeUniversity(10, "Old", "OLD", "uni_10", is_active=True)
    role_obj = FakeUserUniversityRole(77, 10, "uni_admin")

    # Fake session to return admin role and target uni
    class _Query:
        def __init__(self, data):
            self._data = data
        def filter(self, *args, **kwargs):
            return self
        def first(self):
            return self._data[0] if self._data else None

    class _Sess:
        def __init__(self):
            self._committed = False
        def query(self, model):
            if model is UniversityDB:
                return _Query([uni])
            if model is UserUniversityRoleDB:
                return _Query([role_obj])
            return _Query([])
        def commit(self):
            self._committed = True
        def refresh(self, obj):
            return None

    set_user(DummyUser(id=77, is_root=False))

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.patch("/api/v1/universities/10", json={"name": "New Name", "code": "new", "description": "d"})
        assert r.status_code == 200
        body = r.json()
        # Code is uppercased by endpoint
        assert body["name"] == "New Name"
        assert body["code"] == "NEW"
        assert body["id"] == 10
    finally:
        app_main.app.dependency_overrides.clear()


def test_update_university_forbidden_for_non_admin(client, monkeypatch, set_user):
    from utils.models import UniversityDB, UserUniversityRoleDB

    # Fake session with no admin role
    class _Query:
        def __init__(self, data):
            self._data = data
        def filter(self, *args, **kwargs):
            return self
        def first(self):
            return None

    class _Sess:
        def query(self, model):
            return _Query([])

    set_user(DummyUser(id=88, is_root=False))

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.patch("/api/v1/universities/11", json={"name": "X"})
        assert r.status_code == 403
    finally:
        app_main.app.dependency_overrides.clear()


def test_update_university_rejects_empty_code_and_name(client, monkeypatch, set_user):
    """Pydantic should reject empty strings for optional fields (422)."""
    from utils.models import UniversityDB, UserUniversityRoleDB

    uni = FakeUniversity(12, "Old", "OLD", "uni_12", is_active=True)
    role_obj = FakeUserUniversityRole(99, 12, "uni_admin")

    class _Query:
        def __init__(self, data):
            self._data = data
        def filter(self, *args, **kwargs):
            return self
        def first(self):
            return self._data[0] if self._data else None

    class _Sess:
        def query(self, model):
            if model is UniversityDB:
                return _Query([uni])
            if model is UserUniversityRoleDB:
                return _Query([role_obj])
            return _Query([])

    set_user(DummyUser(id=99, is_root=False))

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        # Empty code should be rejected by request validation (min_length=1)
        r1 = client.patch("/api/v1/universities/12", json={"code": ""})
        assert r1.status_code == 422

        # Empty name should be rejected by request validation (min_length=1)
        r2 = client.patch("/api/v1/universities/12", json={"name": ""})
        assert r2.status_code == 422
    finally:
        app_main.app.dependency_overrides.clear()


def test_update_university_rejects_whitespace_only_values(client, monkeypatch, set_user):
    """Handler should trim and reject whitespace-only code/name with 400."""
    from utils.models import UniversityDB, UserUniversityRoleDB

    uni = FakeUniversity(13, "Old", "OLD", "uni_13", is_active=True)
    role_obj = FakeUserUniversityRole(100, 13, "uni_admin")

    class _Query:
        def __init__(self, data):
            self._data = data
        def filter(self, *args, **kwargs):
            return self
        def first(self):
            return self._data[0] if self._data else None

    class _Sess:
        def __init__(self):
            self._committed = False
        def query(self, model):
            if model is UniversityDB:
                return _Query([uni])
            if model is UserUniversityRoleDB:
                return _Query([role_obj])
            return _Query([])
        def commit(self):
            self._committed = True

    set_user(DummyUser(id=100, is_root=False))

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r1 = client.patch("/api/v1/universities/13", json={"code": "   "})
        assert r1.status_code == 400
        assert r1.json().get("detail")

        r2 = client.patch("/api/v1/universities/13", json={"name": "  \t  "})
        assert r2.status_code == 400
        assert r2.json().get("detail")
    finally:
        app_main.app.dependency_overrides.clear()
