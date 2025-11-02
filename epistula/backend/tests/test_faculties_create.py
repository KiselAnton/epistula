from .test_utils import DummyUser, FakeUniversity, make_faculty_create_session


def test_create_faculty_as_root_happy_path(client, set_user):
    from utils.models import UniversityDB

    # Fake session that simulates university lookup, code uniqueness, and insert
    UNI_ID = 99
    SCHEMA = f"uni_{UNI_ID}"

    import datetime as _dt
    def _build_row(params: dict):
        return (
            1,
            UNI_ID,
            params["name"],
            params["short_name"],
            params["code"],
            params["description"],
            None,
            _dt.datetime.now(_dt.timezone.utc),
            True,
        )

    # Root user
    set_user(DummyUser(is_root=True))

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_faculty_create_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            count_value=0,
            inserted_row_builder=_build_row,
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post(f"/api/v1/faculties/{UNI_ID}", json={
            "name": "  Faculty of Science  ",
            "short_name": " fs ",
            "code": "fs",
            "description": "  desc  "
        })
        assert r.status_code == 201
        body = r.json()
        assert body["id"] == 1
        assert body["university_id"] == UNI_ID
        assert body["name"] == "Faculty of Science"
        assert body["short_name"] == "fs".strip()
        assert body["code"] == "FS"
        assert body["description"] == "desc"
    finally:
        app_main.app.dependency_overrides.clear()


def test_create_faculty_duplicate_code_returns_400(client, set_user):
    # Root user
    set_user(DummyUser(is_root=True))

    UNI_ID = 42
    SCHEMA = f"uni_{UNI_ID}"

    import utils.database as db_mod
    import main as app_main
    import datetime as _dt

    def _row_builder(params: dict):
        return (
            9,
            UNI_ID,
            params["name"],
            params["short_name"],
            params["code"],
            params.get("description"),
            None,
            _dt.datetime.now(_dt.timezone.utc),
            True,
        )

    def _override_db():
        # Simulate COUNT(*) = 1 (duplicate code)
        yield make_faculty_create_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            count_value=1,
            inserted_row_builder=_row_builder,
        )

    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    try:
        r = client.post(f"/api/v1/faculties/{UNI_ID}", json={
            "name": "Name",
            "short_name": "SN",
            "code": "sn",
        })
        assert r.status_code == 400
        assert "already exists" in r.json().get("detail", "")
    finally:
        app_main.app.dependency_overrides.clear()


def test_create_faculty_without_description(client, set_user):
    from utils.models import UniversityDB

    UNI_ID = 5
    SCHEMA = f"uni_{UNI_ID}"

    class _Res:
        def __init__(self, row=None, count=0):
            self._row = row
            self._count = count
        def fetchone(self):
            return self._row
        def scalar(self):
            return self._count

    class _Query:
        def __init__(self, uni):
            self._uni = uni
        def filter(self, *args, **kwargs):
            return self
        def first(self):
            return self._uni

    class _Sess:
        def query(self, model):
            if model is UniversityDB:
                return _Query(FakeUniversity(UNI_ID, "U", "U", SCHEMA, True))
            return _Query(None)
        def execute(self, stmt, params=None):
            sql = str(stmt)
            if "SELECT COUNT(*)" in sql and f"FROM {SCHEMA}.faculties" in sql:
                return _Res(count=0)
            if f"INSERT INTO {SCHEMA}.faculties" in sql:
                import datetime as _dt
                return _Res((7, UNI_ID, params["name"], params["short_name"], params["code"], params["description"], None, _dt.datetime.now(_dt.timezone.utc), True))
            return _Res()
        def commit(self):
            pass

    set_user(DummyUser(is_root=True))
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post(f"/api/v1/faculties/{UNI_ID}", json={
            "name": "Name",
            "short_name": "NS",
            "code": "ns"
        })
        assert r.status_code == 201
        body = r.json()
        assert body["id"] == 7
        assert body["code"] == "NS"
        assert body.get("description") is None
    finally:
        app_main.app.dependency_overrides.clear()


def test_create_faculty_rejects_whitespace_only_fields(client, set_user):
    # Root user; DB shouldn't be hit due to validation failure
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
            # Not expected to be called beyond university lookup in this test
            class _R:
                def fetchone(self_inner):
                    return None
            return _R()
        def commit(self):
            pass
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r1 = client.post("/api/v1/faculties/1", json={
            "name": " ", "short_name": "SN", "code": "SN"
        })
        assert r1.status_code == 400

        r2 = client.post("/api/v1/faculties/1", json={
            "name": "Name", "short_name": "  ", "code": "SN"
        })
        assert r2.status_code == 400

        r3 = client.post("/api/v1/faculties/1", json={
            "name": "Name", "short_name": "SN", "code": "   "
        })
        assert r3.status_code == 400
    finally:
        app_main.app.dependency_overrides.clear()


def test_create_faculty_forbidden_for_non_root(client, set_user):
    # Non-root user should be forbidden immediately
    set_user(DummyUser(is_root=False))

    from .test_utils import FakeSession
    import utils.database as db_mod
    import main as app_main

    def _override_db():
        # Shouldn't matter; permission check happens before DB use
        yield FakeSession({})

    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    try:
        r = client.post("/api/v1/faculties/1", json={
            "name": "Name", "short_name": "SN", "code": "SN"
        })
        assert r.status_code == 403
    finally:
        app_main.app.dependency_overrides.clear()


def test_create_faculty_university_not_found_404(client, set_user):
    # Root user; simulate missing university
    set_user(DummyUser(is_root=True))

    from utils.models import UniversityDB
    import utils.database as db_mod
    import main as app_main

    class _Q:
        def filter(self, *a, **k):
            return self
        def first(self):
            return None  # university not found

    class _Sess:
        def query(self, model):
            if model is UniversityDB:
                return _Q()
            return _Q()
        def execute(self, *a, **k):
            class _R:
                def fetchone(self_in):
                    return None
                def scalar(self_in):
                    return 0
            return _R()
        def commit(self):
            pass

    def _override_db():
        yield _Sess()

    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    try:
        r = client.post("/api/v1/faculties/12345", json={
            "name": "Name", "short_name": "SN", "code": "SN"
        })
        assert r.status_code == 404
        assert "not found" in r.json().get("detail", "").lower()
    finally:
        app_main.app.dependency_overrides.clear()


def test_create_faculty_empty_strings_422_from_pydantic(client, set_user):
    # Empty strings should be rejected by Pydantic (min_length=1)
    set_user(DummyUser(is_root=True))
    from .test_utils import FakeSession
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield FakeSession({})
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r1 = client.post("/api/v1/faculties/1", json={
            "name": "", "short_name": "SN", "code": "SN"
        })
        assert r1.status_code == 422

        r2 = client.post("/api/v1/faculties/1", json={
            "name": "Name", "short_name": "", "code": "SN"
        })
        assert r2.status_code == 422

        r3 = client.post("/api/v1/faculties/1", json={
            "name": "Name", "short_name": "SN", "code": ""
        })
        assert r3.status_code == 422
    finally:
        app_main.app.dependency_overrides.clear()
