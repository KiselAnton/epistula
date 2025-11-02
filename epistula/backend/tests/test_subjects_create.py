from .test_utils import DummyUser, FakeUniversity, make_subject_create_session, make_university_missing_session


def test_create_subject_as_root_happy_path(client, set_user):
    UNI_ID = 9
    SCHEMA = f"uni_{UNI_ID}"

    def _build_row(params: dict):
        return (11, params["faculty_id"], params["name"], params["code"], params.get("description"), None, True, None)

    set_user(DummyUser(is_root=True))
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_subject_create_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            faculty_exists=True,
            code_exists=False,
            inserted_row_builder=_build_row,
        )
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
    UNI_ID = 10
    SCHEMA = f"uni_{UNI_ID}"

    set_user(DummyUser(is_root=True))
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        def _build_row(params: dict):
            return (12, params["faculty_id"], params["name"], params["code"], params.get("description"), None, True, None)
        yield make_subject_create_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            faculty_exists=True,
            code_exists=False,
            inserted_row_builder=_build_row,
        )
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
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    # Use custom session ensuring faculty exists, but code check isn't reached
    def _override_db():
        def _build_row(params: dict):
            return (99, params["faculty_id"], params["name"], params["code"], params.get("description"), None, True, None)
        yield make_subject_create_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            faculty_exists=True,
            code_exists=False,
            inserted_row_builder=_build_row,
        )
    import utils.database as db_mod
    import main as app_main
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


def test_create_subject_university_not_found_404(client, set_user):
    set_user(DummyUser(is_root=True))
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_university_missing_session()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    try:
        r = client.post("/api/v1/subjects/999/1", json={"name": "X", "code": "Y"})
        assert r.status_code == 404
    finally:
        app_main.app.dependency_overrides.clear()
