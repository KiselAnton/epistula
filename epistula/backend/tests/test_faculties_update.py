from .test_utils import DummyUser, FakeUniversity


def test_update_faculty_normalizes_and_validates(client, set_user):
    set_user(DummyUser(is_root=True))

    UNI_ID = 7
    FAC_ID = 3
    SCHEMA = f"uni_{UNI_ID}"

    import datetime as _dt

    class _Res:
        def __init__(self, row=None):
            self._row = row
        def fetchone(self):
            return self._row
        def fetchall(self):
            return [self._row] if self._row else []

    class _Q:
        def filter(self, *a, **k):
            return self
        def first(self):
            return FakeUniversity(UNI_ID, "U", "U", SCHEMA, True)

    # Simulate: current faculty row, no duplicate code, return updated row
    def _execute(stmt, params=None):
        sql = str(stmt)
        # Select current row
        if f"FROM {SCHEMA}.faculties" in sql and "WHERE id = :faculty_id" in sql and "SELECT id, university_id" in sql:
            # id, uni_id, name, short_name, code, description, logo_url, created_at, is_active
            return _Res((FAC_ID, UNI_ID, "Name Old", "SN", "OLD", "desc", None, _dt.datetime.now(_dt.timezone.utc), True))
        # Duplicate code check
        if f"FROM {SCHEMA}.faculties" in sql and "code = :code" in sql and "<> :id" in sql:
            return _Res(None)
        # Update returning
        if f"UPDATE {SCHEMA}.faculties" in sql and "RETURNING id" in sql:
            return _Res((FAC_ID, UNI_ID, params.get("name", "Name Old"), params.get("short_name", "SN"), params.get("code", "OLD"), params.get("description", None if params.get("description") == None else params.get("description")), None, _dt.datetime.now(_dt.timezone.utc), True))
        return _Res(None)

    class _Sess:
        def query(self, model):
            from utils.models import UniversityDB
            if model is UniversityDB:
                return _Q()
            return _Q()
        def execute(self, stmt, params=None):
            return _execute(stmt, params)
        def commit(self):
            pass

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        # Send lowercased code and spaced name/short_name; description whitespace -> None
        r = client.patch(f"/api/v1/faculties/{UNI_ID}/{FAC_ID}", json={
            "name": "  New Name  ",
            "short_name": "  new  ",
            "code": "new",
            "description": "   "
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["name"] == "New Name"
        assert body["short_name"] == "new"
        assert body["code"] == "NEW"
        assert body["description"] is None
    finally:
        app_main.app.dependency_overrides.clear()


def test_update_faculty_rejects_empty_fields(client, set_user):
    set_user(DummyUser(is_root=True))

    UNI_ID = 7
    FAC_ID = 3
    SCHEMA = f"uni_{UNI_ID}"

    import datetime as _dt

    class _Res:
        def __init__(self, row=None):
            self._row = row
        def fetchone(self):
            return self._row

    class _Q:
        def filter(self, *a, **k):
            return self
        def first(self):
            return FakeUniversity(UNI_ID, "U", "U", SCHEMA, True)

    def _execute(stmt, params=None):
        sql = str(stmt)
        if f"FROM {SCHEMA}.faculties" in sql and "WHERE id = :faculty_id" in sql and "SELECT id, university_id" in sql:
            return _Res((FAC_ID, UNI_ID, "Name Old", "SN", "OLD", None, None, _dt.datetime.now(_dt.timezone.utc), True))
        # We shouldn't reach duplicate code check due to validation failing early
        return _Res(None)

    class _Sess:
        def query(self, model):
            from utils.models import UniversityDB
            if model is UniversityDB:
                return _Q()
            return _Q()
        def execute(self, stmt, params=None):
            return _execute(stmt, params)
        def commit(self):
            pass

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r1 = client.patch(f"/api/v1/faculties/{UNI_ID}/{FAC_ID}", json={"name": "  "})
        assert r1.status_code == 400
        r2 = client.patch(f"/api/v1/faculties/{UNI_ID}/{FAC_ID}", json={"short_name": "\t\n"})
        assert r2.status_code == 400
        r3 = client.patch(f"/api/v1/faculties/{UNI_ID}/{FAC_ID}", json={"code": "   "})
        assert r3.status_code == 400
    finally:
        app_main.app.dependency_overrides.clear()


def test_update_faculty_duplicate_code_returns_400(client, set_user):
    set_user(DummyUser(is_root=True))

    UNI_ID = 7
    FAC_ID = 3
    SCHEMA = f"uni_{UNI_ID}"

    import datetime as _dt

    class _Res:
        def __init__(self, row=None):
            self._row = row
        def fetchone(self):
            return self._row

    class _Q:
        def filter(self, *a, **k):
            return self
        def first(self):
            return FakeUniversity(UNI_ID, "U", "U", SCHEMA, True)

    def _execute(stmt, params=None):
        sql = str(stmt)
        if f"FROM {SCHEMA}.faculties" in sql and "WHERE id = :faculty_id" in sql and "SELECT id, university_id" in sql:
            return _Res((FAC_ID, UNI_ID, "Name Old", "SN", "OLD", None, None, _dt.datetime.now(_dt.timezone.utc), True))
        if f"FROM {SCHEMA}.faculties" in sql and "code = :code" in sql and "<> :id" in sql:
            return _Res((99,))  # duplicate exists
        return _Res(None)

    class _Sess:
        def query(self, model):
            from utils.models import UniversityDB
            if model is UniversityDB:
                return _Q()
            return _Q()
        def execute(self, stmt, params=None):
            return _execute(stmt, params)
        def commit(self):
            pass

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.patch(f"/api/v1/faculties/{UNI_ID}/{FAC_ID}", json={"code": "dup"})
        assert r.status_code == 400
        assert "already exists" in r.json().get("detail", "")
    finally:
        app_main.app.dependency_overrides.clear()
