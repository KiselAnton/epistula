from .test_utils import DummyUser, FakeUniversity


def test_create_lecture_as_root_happy_path(client, set_user):
    from utils.models import UniversityDB

    UNI_ID = 3
    SCHEMA = f"uni_{UNI_ID}"

    class _Res:
        def __init__(self, row=None):
            self._row = row
        def fetchone(self):
            return self._row
        def scalar(self):
            return None

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
            # Subject exists
            if f"FROM {SCHEMA}.subjects" in sql and "SELECT id" in sql:
                return _Res((params.get("subject_id", 7),))
            # Insert lecture
            if f"INSERT INTO {SCHEMA}.lectures" in sql and "RETURNING id" in sql:
                import datetime as _dt
                return _Res((21, _dt.datetime.now(_dt.timezone.utc), 123, False))
            # Insert content
            if f"INSERT INTO {SCHEMA}.lecture_content" in sql:
                return _Res(None)
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
        r = client.post("/api/v1/subjects/3/2/7/lectures", json={
            "title": "  Intro Lecture  ",
            "description": "  first  ",
            "lecture_number": 5,
            "content": "Hello"
        })
        assert r.status_code == 201
        body = r.json()
        assert body["id"] == 21
        assert body["subject_id"] == 7
        assert body["title"] == "Intro Lecture"
        assert body["description"] == "first"
        assert body["lecture_number"] == 5
    finally:
        app_main.app.dependency_overrides.clear()


def test_create_lecture_rejects_whitespace_title(client, set_user):
    set_user(DummyUser(is_root=True))
    from utils.models import UniversityDB
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    class _Q:
        def filter(self, *a, **k):
            return self
        def first(self):
            return FakeUniversity(UNI_ID, "U", "U", SCHEMA, True)
    class _Sess:
        def query(self, model):
            if model is UniversityDB:
                return _Q()
            return _Q()
        def execute(self, stmt, params=None):
            sql = str(stmt)
            if f"FROM {SCHEMA}.subjects" in sql and "SELECT id" in sql:
                class _R:
                    def fetchone(self_inner):
                        return (1,)
                return _R()
            class _R2:
                def fetchone(self_inner):
                    return None
            return _R2()
        def commit(self):
            pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/subjects/1/1/1/lectures", json={
            "title": "   ",
            "lecture_number": 1
        })
        assert r.status_code == 400
    finally:
        app_main.app.dependency_overrides.clear()
