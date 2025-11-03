"""Tests for lecture listing endpoint (GET /api/v1/subjects/{university_id}/{faculty_id}/{subject_id}/lectures).

Tests role-based visibility, filtering, error cases, and ordering.
"""
import datetime as _dt
from .test_utils import DummyUser, make_lecture_list_session, make_university_missing_session


def test_list_lectures_as_root_returns_all(client, set_user):
    """Root users see all lectures including unpublished ones."""
    set_user(DummyUser(is_root=True))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    now = _dt.datetime.now(_dt.timezone.utc)
    
    lecture_rows = [
        (1, 10, "Published Lecture", "Desc 1", now, 123, True, 1),
        (2, 10, "Unpublished Lecture", "Desc 2", now, 123, False, 2),
    ]
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_list_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=True,
            lecture_rows=lecture_rows,
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.get("/api/v1/subjects/1/5/10/lectures")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["title"] == "Published Lecture"
        assert data[1]["title"] == "Unpublished Lecture"
    finally:
        app_main.app.dependency_overrides.clear()


def test_list_lectures_as_admin_returns_all(client, set_user):
    """Uni admins see all lectures including unpublished ones."""
    set_user(DummyUser(id=2, is_root=False))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    now = _dt.datetime.now(_dt.timezone.utc)
    
    lecture_rows = [
        (1, 10, "Lecture 1", None, now, 123, True, 1),
        (2, 10, "Lecture 2", None, now, 123, False, 2),
    ]
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_list_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=True,
            user_is_admin=True,
            lecture_rows=lecture_rows,
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.get("/api/v1/subjects/1/5/10/lectures")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
    finally:
        app_main.app.dependency_overrides.clear()


def test_list_lectures_as_professor_returns_all(client, set_user):
    """Assigned professors see all lectures including unpublished ones."""
    set_user(DummyUser(id=3, is_root=False))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    now = _dt.datetime.now(_dt.timezone.utc)
    
    lecture_rows = [
        (1, 10, "Visible Lecture", None, now, 123, True, 1),
        (2, 10, "Draft Lecture", None, now, 123, False, 2),
    ]
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_list_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=True,
            user_is_professor=True,
            lecture_rows=lecture_rows,
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.get("/api/v1/subjects/1/5/10/lectures")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["title"] == "Visible Lecture"
        assert data[1]["title"] == "Draft Lecture"
    finally:
        app_main.app.dependency_overrides.clear()


def test_list_lectures_as_student_shows_only_active(client, set_user):
    """Students only see published lectures."""
    set_user(DummyUser(id=4, is_root=False))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    now = _dt.datetime.now(_dt.timezone.utc)
    
    # Only published lecture should be returned by mock
    lecture_rows = [
        (1, 10, "Public Lecture", None, now, 123, True, 1),
    ]
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_list_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=True,
            user_is_admin=False,
            user_is_professor=False,
            lecture_rows=lecture_rows,
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.get("/api/v1/subjects/1/5/10/lectures")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Public Lecture"
    finally:
        app_main.app.dependency_overrides.clear()


def test_list_lectures_empty_subject(client, set_user):
    """Listing lectures for subject with no lectures returns empty list."""
    set_user(DummyUser(is_root=True))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_list_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=True,
            lecture_rows=[],
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.get("/api/v1/subjects/1/5/10/lectures")
        assert response.status_code == 200
        data = response.json()
        assert data == []
    finally:
        app_main.app.dependency_overrides.clear()


def test_list_lectures_subject_not_found(client, set_user):
    """Listing lectures for non-existent subject returns 404."""
    set_user(DummyUser(is_root=True))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_list_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=False,
            lecture_rows=[],
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.get("/api/v1/subjects/1/5/999/lectures")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    finally:
        app_main.app.dependency_overrides.clear()


def test_list_lectures_university_not_found(client, set_user):
    """Listing lectures for non-existent university returns 404."""
    set_user(DummyUser(is_root=True))
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_university_missing_session()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.get("/api/v1/subjects/999/5/10/lectures")
        assert response.status_code == 404
    finally:
        app_main.app.dependency_overrides.clear()


def test_list_lectures_preserves_order(client, set_user):
    """Lectures are returned ordered by order_number."""
    set_user(DummyUser(is_root=True))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    now = _dt.datetime.now(_dt.timezone.utc)
    
    # Lectures with different order numbers
    lecture_rows = [
        (3, 10, "First", None, now, 123, True, 1),
        (1, 10, "Second", None, now, 123, True, 2),
        (2, 10, "Third", None, now, 123, True, 3),
    ]
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_list_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=True,
            lecture_rows=lecture_rows,
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.get("/api/v1/subjects/1/5/10/lectures")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        assert data[0]["title"] == "First"
        assert data[0]["lecture_number"] == 1
        assert data[1]["title"] == "Second"
        assert data[1]["lecture_number"] == 2
        assert data[2]["title"] == "Third"
        assert data[2]["lecture_number"] == 3
    finally:
        app_main.app.dependency_overrides.clear()
