import datetime as _dt

from .test_utils import DummyUser


def _make_session_for_notes_flow(
    *,
    uni_id: int,
    schema: str,
    enrolled: bool = True,
    lecture_exists: bool = True,
    existing_note: tuple | None = None,
    insert_note_row: tuple | None = None,
    update_note_row: tuple | None = None,
    list_rows: list[tuple] | None = None,
):
    """Create a minimal fake Session that supports lecture_notes router flows.

    It inspects SQL text() via substring checks and returns canned results.
    """
    from utils.models import UniversityDB

    class _Q:
        def filter(self, *a, **k):
            return self
        def first(self):
            # Always return a university with the given schema
            class _U:
                id = uni_id
                schema_name = schema
            return _U()

    class _Res:
        def __init__(self, row=None, rows=None, count=0):
            self._row = row
            self._rows = rows if rows is not None else ([] if row is None else [row])
            self._count = count
        def fetchone(self):
            return self._row
        def fetchall(self):
            return self._rows
        def scalar(self):
            return self._count
        def __iter__(self):
            return iter(self._rows)

    class _Sess:
        def __init__(self):
            self._committed = False
        def query(self, model):
            if model is UniversityDB:
                return _Q()
            return _Q()
        def execute(self, stmt, params=None):
            sql = str(stmt)
            # Ensure table creation: no-op
            if f"CREATE TABLE IF NOT EXISTS {schema}.lecture_notes" in sql:
                return _Res()
            # Enrollment check
            if f"FROM {schema}.subject_students" in sql:
                return _Res(row=(1,) if enrolled else None)
            # Lecture exists check
            if f"FROM {schema}.lectures" in sql and "WHERE id = :lecture_id" in sql:
                return _Res(row=(1,) if lecture_exists else None)
            # Select existing note id for upsert pre-check
            if f"FROM {schema}.lecture_notes" in sql and "SELECT id FROM" in sql:
                return _Res(row=existing_note)
            # Select full note payload
            if f"FROM {schema}.lecture_notes" in sql and "SELECT id, lecture_id" in sql:
                return _Res(row=existing_note)
            # Insert note
            if f"INSERT INTO {schema}.lecture_notes" in sql and "RETURNING" in sql:
                return _Res(row=insert_note_row)
            # Update note
            if f"UPDATE {schema}.lecture_notes" in sql and "RETURNING" in sql:
                return _Res(row=update_note_row)
            # List my notes join query
            if f"FROM {schema}.lecture_notes ln" in sql and "JOIN" in sql:
                return _Res(rows=list_rows or [])
            return _Res()
        def commit(self):
            self._committed = True
        def rollback(self):
            pass

    return _Sess()


def test_upsert_create_note_happy_path(client, set_user):
    set_user(DummyUser(id=10, is_root=False))
    import utils.database as db_mod
    import main as app_main

    now = _dt.datetime.now(_dt.timezone.utc)
    sess = _make_session_for_notes_flow(
        uni_id=1,
        schema="uni_1",
        enrolled=True,
        lecture_exists=True,
        existing_note=None,
        insert_note_row=(5, 99, 10, "My note", now, now),
    )

    def _override_db():
        yield sess

    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    try:
        r = client.post(
            "/api/v1/subjects/1/2/3/lectures/99/notes",
            json={"content": "My note"},
        )
        assert r.status_code == 201
        body = r.json()
        assert body["id"] == 5
        assert body["lecture_id"] == 99
        assert body["student_id"] == 10
        assert body["content"] == "My note"
    finally:
        app_main.app.dependency_overrides.clear()


def test_upsert_update_existing_note(client, set_user):
    set_user(DummyUser(id=22, is_root=False))
    import utils.database as db_mod
    import main as app_main

    now = _dt.datetime.now(_dt.timezone.utc)
    sess = _make_session_for_notes_flow(
        uni_id=1,
        schema="uni_1",
        enrolled=True,
        lecture_exists=True,
        existing_note=(7,),
        update_note_row=(7, 50, 22, "Updated text", now, now),
    )

    def _override_db():
        yield sess

    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    try:
        r = client.post(
            "/api/v1/subjects/1/2/3/lectures/50/notes",
            json={"content": "Updated text"},
        )
        assert r.status_code == 201
        body = r.json()
        assert body["id"] == 7
        assert body["lecture_id"] == 50
        assert body["student_id"] == 22
        assert body["content"] == "Updated text"
    finally:
        app_main.app.dependency_overrides.clear()


def test_get_note_not_found_returns_404(client, set_user):
    set_user(DummyUser(id=9, is_root=False))
    import utils.database as db_mod
    import main as app_main

    sess = _make_session_for_notes_flow(
        uni_id=2,
        schema="uni_2",
        enrolled=True,
        lecture_exists=True,
        existing_note=None,
    )

    def _override_db():
        yield sess
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    try:
        r = client.get("/api/v1/subjects/2/1/10/lectures/77/notes")
        assert r.status_code == 404
    finally:
        app_main.app.dependency_overrides.clear()


def test_list_my_notes_happy_path(client, set_user):
    set_user(DummyUser(id=42, is_root=False))
    import utils.database as db_mod
    import main as app_main

    now = _dt.datetime.now(_dt.timezone.utc)
    rows = [
        # id, lecture_id, subject_id, faculty_id, title, subject_name, subject_code, content, updated_at
        (1, 11, 3, 5, "Lec 1", "Subject One", "SUB1", "C1", now),
        (2, 12, 3, 5, "Lec 2", "Subject One", "SUB1", "C2", now),
    ]
    sess = _make_session_for_notes_flow(
        uni_id=3,
        schema="uni_3",
        list_rows=rows,
    )

    def _override_db():
        yield sess
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    try:
        r = client.get("/api/v1/universities/3/my/notes")
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list)
        assert len(body) == 2
        assert body[0]["lecture_id"] == 11
        assert body[0]["subject_id"] == 3
        assert body[0]["faculty_id"] == 5
        assert body[0]["title"] == "Lec 1"
        assert body[0]["subject_name"] == "Subject One"
        assert body[0]["subject_code"] == "SUB1"
        assert body[0]["content"] == "C1"
        assert body[1]["lecture_id"] == 12
        assert body[1]["faculty_id"] == 5
        assert body[1]["subject_name"] == "Subject One"
    finally:
        app_main.app.dependency_overrides.clear()


def test_root_forbidden_on_notes_endpoints(client, set_user):
    set_user(DummyUser(id=1, is_root=True))
    # Using default DB (no override) should still reject due to auth only
    r1 = client.get("/api/v1/subjects/1/1/1/lectures/1/notes")
    assert r1.status_code == 403
    r2 = client.post("/api/v1/subjects/1/1/1/lectures/1/notes", json={"content": "x"})
    assert r2.status_code == 403
    r3 = client.get("/api/v1/universities/1/my/notes")
    assert r3.status_code == 403


def test_forbidden_if_not_enrolled(client, set_user):
    set_user(DummyUser(id=13, is_root=False))
    import utils.database as db_mod
    import main as app_main

    sess = _make_session_for_notes_flow(
        uni_id=1,
        schema="uni_1",
        enrolled=False,
        lecture_exists=True,
    )

    def _override_db():
        yield sess
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    try:
        r = client.post("/api/v1/subjects/1/2/3/lectures/10/notes", json={"content": "hi"})
        assert r.status_code == 403
    finally:
        app_main.app.dependency_overrides.clear()


def test_lecture_not_found_returns_404(client, set_user):
    set_user(DummyUser(id=13, is_root=False))
    import utils.database as db_mod
    import main as app_main

    sess = _make_session_for_notes_flow(
        uni_id=1,
        schema="uni_1",
        enrolled=True,
        lecture_exists=False,
    )

    def _override_db():
        yield sess
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    try:
        r = client.post("/api/v1/subjects/1/2/3/lectures/10/notes", json={"content": "hi"})
        assert r.status_code == 404
    finally:
        app_main.app.dependency_overrides.clear()
