"""Tests for lecture update and delete endpoints.

Tests PATCH /api/v1/subjects/{university_id}/{faculty_id}/{subject_id}/lectures/{lecture_id}
Tests DELETE /api/v1/subjects/{university_id}/{faculty_id}/{subject_id}/lectures/{lecture_id}
"""
import datetime as _dt
from .test_utils import DummyUser, make_lecture_update_session, make_lecture_delete_session, make_university_missing_session


# ========== UPDATE TESTS ==========

def test_update_lecture_as_root_success(client, set_user):
    """Root can update any lecture."""
    set_user(DummyUser(is_root=True))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    now = _dt.datetime.now(_dt.timezone.utc)
    
    updated_row = (1, 10, "Updated Title", "Updated Description", now, 123, True, 5)
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_update_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=True,
            lecture_exists=True,
            updated_lecture=updated_row,
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.patch("/api/v1/subjects/1/5/10/lectures/1", json={
            "title": "Updated Title",
            "description": "Updated Description",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"
        assert data["description"] == "Updated Description"
    finally:
        app_main.app.dependency_overrides.clear()


def test_update_lecture_as_admin_success(client, set_user):
    """University admins can update lectures."""
    set_user(DummyUser(id=2, is_root=False))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    now = _dt.datetime.now(_dt.timezone.utc)
    
    updated_row = (1, 10, "Admin Updated", None, now, 123, True, 1)
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_update_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=True,
            lecture_exists=True,
            user_is_admin=True,
            updated_lecture=updated_row,
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.patch("/api/v1/subjects/1/5/10/lectures/1", json={
            "title": "Admin Updated",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Admin Updated"
    finally:
        app_main.app.dependency_overrides.clear()


def test_update_lecture_as_professor_success(client, set_user):
    """Assigned professors can update lectures."""
    set_user(DummyUser(id=3, is_root=False))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    now = _dt.datetime.now(_dt.timezone.utc)
    
    updated_row = (1, 10, "Professor Edit", None, now, 3, True, 1)
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_update_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=True,
            lecture_exists=True,
            user_is_professor=True,
            updated_lecture=updated_row,
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.patch("/api/v1/subjects/1/5/10/lectures/1", json={
            "title": "Professor Edit",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Professor Edit"
    finally:
        app_main.app.dependency_overrides.clear()


def test_update_lecture_as_student_forbidden(client, set_user):
    """Students cannot update lectures (403)."""
    set_user(DummyUser(id=4, is_root=False))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_update_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=True,
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.patch("/api/v1/subjects/1/5/10/lectures/1", json={
            "title": "Hacked Title",
        })
        # Should fail authorization - expect 403
        assert response.status_code == 403
    finally:
        app_main.app.dependency_overrides.clear()


def test_update_lecture_not_found(client, set_user):
    """Updating non-existent lecture returns 404."""
    set_user(DummyUser(is_root=True))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_update_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=True,
            lecture_exists=False,
            updated_lecture=None,
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.patch("/api/v1/subjects/1/5/10/lectures/999", json={
            "title": "New Title",
        })
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    finally:
        app_main.app.dependency_overrides.clear()


def test_update_lecture_subject_not_found(client, set_user):
    """Updating lecture in non-existent subject returns 404."""
    set_user(DummyUser(is_root=True))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_update_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=False,
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.patch("/api/v1/subjects/1/5/999/lectures/1", json={
            "title": "New Title",
        })
        assert response.status_code == 404
        assert "subject" in response.json()["detail"].lower()
    finally:
        app_main.app.dependency_overrides.clear()


def test_update_lecture_toggle_active(client, set_user):
    """Can toggle lecture is_active (published) status."""
    set_user(DummyUser(is_root=True))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    now = _dt.datetime.now(_dt.timezone.utc)
    
    updated_row = (1, 10, "Toggled Lecture", None, now, 123, False, 1)
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_update_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=True,
            lecture_exists=True,
            updated_lecture=updated_row,
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.patch("/api/v1/subjects/1/5/10/lectures/1", json={
            "is_active": False,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] == False
    finally:
        app_main.app.dependency_overrides.clear()


def test_update_lecture_empty_title_rejected(client, set_user):
    """Empty title is rejected with 422 (Pydantic validation)."""
    set_user(DummyUser(is_root=True))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_update_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=True,
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.patch("/api/v1/subjects/1/5/10/lectures/1", json={
            "title": "   ",
        })
        # Pydantic field validation returns 422
        assert response.status_code == 422
    finally:
        app_main.app.dependency_overrides.clear()


# ========== DELETE TESTS ==========

def test_delete_lecture_as_root_success(client, set_user):
    """Root can delete lectures."""
    set_user(DummyUser(is_root=True))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_delete_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=True,
            lecture_exists=True,
            delete_affected_rows=1,
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.delete("/api/v1/subjects/1/5/10/lectures/1")
        assert response.status_code == 204
    finally:
        app_main.app.dependency_overrides.clear()


def test_delete_lecture_as_admin_success(client, set_user):
    """University admins can delete lectures."""
    set_user(DummyUser(id=2, is_root=False))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_delete_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=True,
            lecture_exists=True,
            user_is_admin=True,
            delete_affected_rows=1,
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.delete("/api/v1/subjects/1/5/10/lectures/1")
        assert response.status_code == 204
    finally:
        app_main.app.dependency_overrides.clear()


def test_delete_lecture_as_professor_success(client, set_user):
    """Assigned professors can delete lectures."""
    set_user(DummyUser(id=3, is_root=False))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_delete_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=True,
            lecture_exists=True,
            user_is_professor=True,
            delete_affected_rows=1,
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.delete("/api/v1/subjects/1/5/10/lectures/1")
        assert response.status_code == 204
    finally:
        app_main.app.dependency_overrides.clear()


def test_delete_lecture_as_student_forbidden(client, set_user):
    """Students cannot delete lectures (403)."""
    set_user(DummyUser(id=4, is_root=False))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_delete_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=True,
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.delete("/api/v1/subjects/1/5/10/lectures/1")
        assert response.status_code == 403
    finally:
        app_main.app.dependency_overrides.clear()


def test_delete_lecture_not_found(client, set_user):
    """Deleting non-existent lecture returns 404."""
    set_user(DummyUser(is_root=True))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_delete_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=True,
            lecture_exists=False,
            delete_affected_rows=0,
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.delete("/api/v1/subjects/1/5/10/lectures/999")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    finally:
        app_main.app.dependency_overrides.clear()


def test_delete_lecture_subject_not_found(client, set_user):
    """Deleting lecture from non-existent subject returns 404."""
    set_user(DummyUser(is_root=True))
    
    UNI_ID = 1
    SCHEMA = f"uni_{UNI_ID}"
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_lecture_delete_session(
            uni_id=UNI_ID,
            schema_name=SCHEMA,
            subject_exists=False,
        )
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.delete("/api/v1/subjects/1/5/999/lectures/1")
        assert response.status_code == 404
        # Error message mentions "lecture" because that's what the DELETE checks
        assert "lecture" in response.json()["detail"].lower() or "not found" in response.json()["detail"].lower()
    finally:
        app_main.app.dependency_overrides.clear()


def test_delete_lecture_university_not_found(client, set_user):
    """Deleting lecture from non-existent university returns 404."""
    set_user(DummyUser(is_root=True))
    
    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield make_university_missing_session()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db
    
    try:
        response = client.delete("/api/v1/subjects/999/5/10/lectures/1")
        assert response.status_code == 404
    finally:
        app_main.app.dependency_overrides.clear()
