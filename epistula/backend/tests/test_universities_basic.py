from typing import Any, List

from .test_utils import DummyUser, FakeQuery, FakeSession, FakeUniversity, FakeUserUniversityRole


def test_list_universities_as_root_returns_all(client, monkeypatch, set_user):
    # Prepare fake DB returning 2 universities as plain objects with required attrs
    from utils.models import UniversityDB
    uni1 = FakeUniversity(1, "A", "A", "uni_1", True)
    uni2 = FakeUniversity(2, "B", "B", "uni_2", False)

    fake_db = FakeSession({UniversityDB: [uni1, uni2]})

    # Patch current user as root and DB dependency
    import routers.universities as uni_router
    set_user(DummyUser(is_root=True))

    import utils.database as db_mod
    # Override FastAPI dependency
    import main as app_main
    def _override_db():
        yield fake_db
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.get("/api/v1/universities/")
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list)
        assert len(body) == 2
        assert {u["id"] for u in body} == {1, 2}
    finally:
        app_main.app.dependency_overrides.clear()


def test_create_university_forbidden_for_non_root(client, monkeypatch, set_user):
    # Non-root user should get 403 before any DB calls are needed
    import routers.universities as uni_router
    set_user(DummyUser(is_root=False))

    resp = client.post("/api/v1/universities/", json={
        "name": "Test U",
        "code": "TU",
        "description": "desc"
    })
    assert resp.status_code == 403


def test_delete_university_forbidden_for_non_root(client, monkeypatch, set_user):
    import routers.universities as uni_router
    set_user(DummyUser(is_root=False))

    resp = client.delete("/api/v1/universities/123")
    assert resp.status_code == 403


def test_list_universities_as_student_shows_only_active(client, monkeypatch, set_user):
    # Student role: only active universities are returned
    from utils.models import UniversityDB, UserUniversityRoleDB
    # Universities include one inactive
    uni1 = FakeUniversity(1, "Active", "ACT", "uni_1", True)
    uni2 = FakeUniversity(2, "Inactive", "INA", "uni_2", False)

    # Student membership row (role set to 'student')
    fake_db = FakeSession({
        UniversityDB: [uni1, uni2],
        UserUniversityRoleDB: [FakeUserUniversityRole(10, 1, "student")],
    })

    set_user(DummyUser(id=10, is_root=False))

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield fake_db
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.get("/api/v1/universities/")
        assert r.status_code == 200
        body = r.json()
        assert [u["name"] for u in body] == ["Active"]
    finally:
        app_main.app.dependency_overrides.clear()


def test_list_universities_as_professor_includes_temp_and_memberships(client, monkeypatch, set_user):
    # Professor sees active, any university they belong to, and any temp schema rows
    from utils.models import UniversityDB, UserUniversityRoleDB
    # Active unrelated uni
    u1 = FakeUniversity(1, "Active", "ACT", "uni_1", True)
    # The professor's uni (could be inactive, but should be included due to membership)
    u2 = FakeUniversity(2, "Mine", "MINE", "uni_2", False)
    # Temp entry corresponding to u2's schema
    u2_temp = FakeUniversity(3, "Mine Temp", "MINE_T", "uni_2_temp", True)

    fake_db = FakeSession({
        UniversityDB: [u1, u2, u2_temp],
        UserUniversityRoleDB: [FakeUserUniversityRole(55, 2, "professor")],
    })

    # Endpoint uses `or_` filter to include all data; our filter() stubbed method returns all.
    # Ensure fake query returns all universities (no naive is_active filtering for professors).
    # We'll monkeypatch FakeQuery.all() to skip the auto-filter for this test.
    original_all = FakeQuery.all
    def _all_no_filter(self):
        return self._data
    FakeQuery.all = _all_no_filter

    set_user(DummyUser(id=55, is_root=False))

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield fake_db
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.get("/api/v1/universities/")
        assert r.status_code == 200
        names = [u["name"] for u in r.json()]
        assert set(names) == {"Active", "Mine", "Mine Temp"}
    finally:
        FakeQuery.all = original_all
        app_main.app.dependency_overrides.clear()

