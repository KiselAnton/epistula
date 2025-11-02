from .test_utils import DummyUser, FakeUniversity


def _make_list_session(university_id: int, schema_name: str, rows: list[tuple]):
    from utils.models import UniversityDB

    class _Query:
        def __init__(self, uni):
            self._uni = uni
        def filter(self, *a, **k):
            return self
        def first(self):
            return self._uni

    class _Result:
        def __init__(self, rows):
            self._rows = rows
        def fetchall(self):
            return list(self._rows)

    class _Sess:
        def query(self, model):
            if model is UniversityDB:
                return _Query(FakeUniversity(university_id, "U", "U", schema_name, True))
            return _Query(None)
        def execute(self, stmt, params=None):
            sql = str(stmt)
            if f"FROM {schema_name}.faculties" in sql and "SELECT id, university_id" in sql:
                return _Result(rows)
            return _Result([])

    return _Sess()


def test_list_faculties_happy_path_normalization(client, set_user):
    # User irrelevant (no auth checks); set arbitrary user
    set_user(DummyUser(is_root=False))

    UNI_ID = 10
    SCHEMA = f"uni_{UNI_ID}"

    import datetime as _dt
    now = _dt.datetime.now(_dt.timezone.utc)

    # Row with extra whitespace and lowercase code/empty description
    rows = [
        (
            1,  # id
            UNI_ID,  # university_id
            "  Faculty of Engineering  ",  # name
            "  eng ",  # short_name
            "fe",  # code (lowercase)
            "   ",  # description -> should become None
            None,  # logo_url
            now,
            True,
        )
    ]

    import utils.database as db_mod
    import main as app_main

    def _override_db():
        yield _make_list_session(UNI_ID, SCHEMA, rows)

    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.get(f"/api/v1/faculties/{UNI_ID}")
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list)
        assert len(body) == 1
        item = body[0]
        assert item["name"] == "Faculty of Engineering"  # trimmed
        assert item["short_name"] == "eng"  # trimmed
        assert item["code"] == "FE"  # uppercased
        assert item["description"] is None  # normalized
    finally:
        app_main.app.dependency_overrides.clear()


def test_list_faculties_skips_invalid_rows(client, set_user):
    set_user(DummyUser())

    UNI_ID = 11
    SCHEMA = f"uni_{UNI_ID}"

    import datetime as _dt
    now = _dt.datetime.now(_dt.timezone.utc)

    # Mix of valid and invalid rows (empty name/short_name/code)
    rows = [
        (1, UNI_ID, "Valid Name", "VN", "VN", None, None, now, True),
        (2, UNI_ID, "", "SN", "CD", None, None, now, True),  # empty name -> skip
        (3, UNI_ID, "Name", "", "CD", None, None, now, True),  # empty short_name -> skip
        (4, UNI_ID, "Name", "SN", "", None, None, now, True),  # empty code -> skip
    ]

    import utils.database as db_mod
    import main as app_main

    def _override_db():
        yield _make_list_session(UNI_ID, SCHEMA, rows)

    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.get(f"/api/v1/faculties/{UNI_ID}")
        assert r.status_code == 200
        body = r.json()
        assert len(body) == 1
        assert body[0]["id"] == 1
        assert body[0]["name"] == "Valid Name"
    finally:
        app_main.app.dependency_overrides.clear()


def test_list_faculties_university_not_found_404(client, set_user):
    set_user(DummyUser())

    from utils.models import UniversityDB
    import utils.database as db_mod
    import main as app_main

    class _Q:
        def filter(self, *a, **k):
            return self
        def first(self):
            return None  # university missing

    class _Sess:
        def query(self, model):
            if model is UniversityDB:
                return _Q()
            return _Q()
        def execute(self, *a, **k):
            class _R:
                def fetchall(self_in):
                    return []
            return _R()

    def _override_db():
        yield _Sess()

    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.get("/api/v1/faculties/99999")
        assert r.status_code == 404
        assert "not found" in r.json().get("detail", "").lower()
    finally:
        app_main.app.dependency_overrides.clear()
