from .test_utils import DummyUser, FakeUniversity


def test_create_subject_as_root_happy_path(client, set_user):
    from utils.models import UniversityDB

    UNI_ID = 9
    SCHEMA = f"uni_{UNI_ID}"

    class _Res:
        def __init__(self, row=None):
            self._row = row
        def fetchone(self):
            return self._row

    class _Sess:
        def query(self, model):
            if model is UniversityDB:
                class _Q:
                    def filter(self, *a, **k):
                        return self
                    def first(self):
                        return FakeUniversity(UNI_ID, "U", "U", SCHEMA, True)
                return _Q()
            return None
        def execute(self, stmt, params=None):
            sql = str(stmt)
            # faculty exists check
            if f"FROM {SCHEMA}.faculties" in sql and "SELECT id" in sql:
                return _Res((1,))
            # code uniqueness check
            if f"FROM {SCHEMA}.subjects" in sql and "SELECT id" in sql:
                return _Res(None)
            # insert
            if f"INSERT INTO {SCHEMA}.subjects" in sql:
                return _Res((11, params["faculty_id"], params["name"], params["code"], params["description"], None, True, None))
            # ensure_subject_logo_column DO $$ block
            return _Res(None)
        def commit(self):
            pass

    set_user(DummyUser(is_root=True))
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/subjects/9/1", json={
            "name": "  Algorithms ",
            "code": " cs101 ",
            "description": "  intro  "
        })
        assert r.status_code == 201
        body = r.json()
        assert body["id"] == 11
        assert body["faculty_id"] == 1
        assert body["name"] == "Algorithms"
        assert body["code"] == "CS101"
        assert body["description"] == "intro"
    finally:
        app_main.app.dependency_overrides.clear()


def test_create_subject_without_description(client, set_user):
    from utils.models import UniversityDB

    UNI_ID = 10
    SCHEMA = f"uni_{UNI_ID}"

    class _Res:
        def __init__(self, row=None):
            self._row = row
        def fetchone(self):
            return self._row

    class _Sess:
        def query(self, model):
            if model is UniversityDB:
                class _Q:
                    def filter(self, *a, **k):
                        return self
                    def first(self):
                        return FakeUniversity(UNI_ID, "U", "U", SCHEMA, True)
                return _Q()
            return None
        def execute(self, stmt, params=None):
            sql = str(stmt)
            if f"FROM {SCHEMA}.faculties" in sql and "SELECT id" in sql:
                return _Res((1,))
            if f"FROM {SCHEMA}.subjects" in sql and "SELECT id" in sql:
                return _Res(None)
            if f"INSERT INTO {SCHEMA}.subjects" in sql:
                return _Res((12, params["faculty_id"], params["name"], params["code"], params["description"], None, True, None))
            return _Res(None)
        def commit(self):
            pass

    set_user(DummyUser(is_root=True))
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/subjects/10/1", json={
            "name": "Data Structures",
            "code": "ds"
        })
        assert r.status_code == 201
        body = r.json()
        assert body["id"] == 12
        assert body["code"] == "DS"
        assert body.get("description") is None
    finally:
        app_main.app.dependency_overrides.clear()


def test_create_subject_rejects_whitespace_and_empty(client, set_user):
    # Root user; ensure uni and faculty checks pass, then validation triggers 400
    set_user(DummyUser(is_root=True))
    from utils.models import UniversityDB
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    class _Q:
        def filter(self, *a, **k):
            return self
        def first(self):
            return FakeUniversity(UNI_ID, "U", "U", SCHEMA, True)
    class _Res:
        def __init__(self, row=None):
            self._row = row
        def fetchone(self):
            return self._row
    class _Sess:
        def query(self, model):
            if model is UniversityDB:
                return _Q()
            return _Q()
        def execute(self, stmt, params=None):
            sql = str(stmt)
            # faculty exists check should pass
            if f"FROM {SCHEMA}.faculties" in sql and "SELECT id" in sql:
                return _Res((1,))
            # code check won't be reached due to validation failures below
            return _Res(None)
        def commit(self):
            pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        # whitespace-only name
        r1 = client.post("/api/v1/subjects/1/1", json={"name": "  ", "code": "X"})
        assert r1.status_code == 400
        # whitespace-only code
        r2 = client.post("/api/v1/subjects/1/1", json={"name": "Name", "code": "  "})
        assert r2.status_code == 400
    # empty strings also 400 (since router uses dict, not Pydantic)
        r3 = client.post("/api/v1/subjects/1/1", json={"name": "", "code": "X"})
        assert r3.status_code == 400
        r4 = client.post("/api/v1/subjects/1/1", json={"name": "Name", "code": ""})
        assert r4.status_code == 400
    finally:
        app_main.app.dependency_overrides.clear()
