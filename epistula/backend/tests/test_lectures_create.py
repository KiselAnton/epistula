from .test_utils import DummyUser, FakeUniversity, make_lecture_create_session, make_university_missing_session


def test_create_lecture_as_root_happy_path(client, set_user):
    UNI_ID = 3
    SCHEMA = f"uni_{UNI_ID}"

    import datetime as _dt
    def _row(params: dict):
        return (21, _dt.datetime.now(_dt.timezone.utc), 123, False)

    set_user(DummyUser(is_root=True))
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_create_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=True,
            max_order_next=1,
            inserted_row_builder=_row,
        )
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
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    import datetime as _dt
    def _override_db():
        def _row(params: dict):
            return (30, _dt.datetime.now(_dt.timezone.utc), 999, False)
        yield make_lecture_create_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=True,
            max_order_next=1,
            inserted_row_builder=_row,
        )
    import utils.database as db_mod
    import main as app_main
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.post("/api/v1/subjects/1/1/1/lectures", json={
            "title": "   ",
            "lecture_number": 1
        })
        assert r.status_code == 400
    finally:
        app_main.app.dependency_overrides.clear()


def test_create_lecture_university_not_found_404(client, set_user):
    set_user(DummyUser(is_root=True))
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_university_missing_session()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    try:
        r = client.post("/api/v1/subjects/999/1/1/lectures", json={"title": "X", "lecture_number": 1})
        assert r.status_code == 404
    finally:
        app_main.app.dependency_overrides.clear()
