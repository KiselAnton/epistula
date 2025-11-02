from .test_utils import DummyUser, FakeUniversity


def test_create_university_as_root_happy_path(client, monkeypatch, set_user):
    from sqlalchemy import text
    from utils.models import UniversityDB

    created_uni = None

    class _Res:
        def __init__(self, row):
            self._row = row
        def fetchone(self):
            return self._row

    class _Query:
        def __init__(self):
            pass
        def filter(self, *args, **kwargs):
            return self
        def first(self):
            return created_uni

    class _Sess:
        def __init__(self):
            self._committed = False
        def execute(self, stmt, params=None):
            # Expect SQL function create_university returning id
            return _Res((42,))
        def query(self, model):
            return _Query()
        def commit(self):
            self._committed = True

    # Our created uni object returned by the follow-up query
    created_uni = FakeUniversity(42, "Test U", "TU", "uni_42", is_active=True, description="desc")

    # Root user allowed via dependency override
    set_user(DummyUser(is_root=True))

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/universities/", json={
            "name": "Test U",
            "code": "tu",
            "description": "desc"
        })
        assert r.status_code == 201
        body = r.json()
        assert body["id"] == 42
        assert body["schema_name"] == "uni_42"
        assert body["code"] == "TU"  # uppercased in DB function
    finally:
        app_main.app.dependency_overrides.clear()


def test_create_university_without_description_as_root(client, monkeypatch, set_user):
    """Creation should work without optional description field."""
    created_uni = None

    class _Res:
        def __init__(self, row):
            self._row = row
        def fetchone(self):
            return self._row

    class _Query:
        def __init__(self):
            pass
        def filter(self, *args, **kwargs):
            return self
        def first(self):
            return created_uni

    class _Sess:
        def __init__(self):
            self._committed = False
        def execute(self, stmt, params=None):
            return _Res((43,))
        def query(self, model):
            return _Query()
        def commit(self):
            self._committed = True

    # Our created uni (no description)
    created_uni = FakeUniversity(43, "Tech Uni", "TU", "uni_43", is_active=True, description=None)

    # Root user allowed via dependency override
    set_user(DummyUser(is_root=True))

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/universities/", json={
            "name": "Tech Uni",
            "code": "tu"
        })
        assert r.status_code == 201
        body = r.json()
        assert body["id"] == 43
        assert body["schema_name"] == "uni_43"
        assert body["code"] == "TU"
        assert body.get("description") is None
    finally:
        app_main.app.dependency_overrides.clear()


def test_create_university_rejects_whitespace_only_values(client, set_user):
    """Handler should trim and reject whitespace-only code/name with 400 on create."""
    # Root user allowed via dependency override
    set_user(DummyUser(is_root=True))

    # Override DB to a no-op fake session (should not be used when validation fails)
    from .test_utils import FakeSession
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield FakeSession({})
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r1 = client.post("/api/v1/universities/", json={
            "name": "Valid Name",
            "code": "   "
        })
        assert r1.status_code == 400

        r2 = client.post("/api/v1/universities/", json={
            "name": "   ",
            "code": "TU"
        })
        assert r2.status_code == 400
    finally:
        app_main.app.dependency_overrides.clear()


def test_create_university_rejects_empty_values_422(client, set_user):
    """Pydantic should reject empty strings for required fields (422)."""
    set_user(DummyUser(is_root=True))

    # Override DB to a no-op fake session
    from .test_utils import FakeSession
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield FakeSession({})
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r1 = client.post("/api/v1/universities/", json={
            "name": "Tech U",
            "code": ""
        })
        assert r1.status_code == 422

        r2 = client.post("/api/v1/universities/", json={
            "name": "",
            "code": "TU"
        })
        assert r2.status_code == 422
    finally:
        app_main.app.dependency_overrides.clear()
