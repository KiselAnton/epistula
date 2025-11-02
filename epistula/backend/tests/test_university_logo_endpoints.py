import io

from .test_utils import DummyUser, FakeUniversity


def test_upload_university_logo_success(client, monkeypatch, set_user):
    import routers.universities as uni_router
    from utils.models import UniversityDB

    # Allow as root
    set_user(DummyUser(is_root=True))

    # Fake DB session with existing uni
    uni_obj = FakeUniversity(1, "U", "U", "uni_1", is_active=True, logo_url=None)

    class _Query:
        def __init__(self):
            pass
        def filter(self, *args, **kwargs):
            return self
        def first(self):
            return uni_obj

    class _Sess:
        def query(self, model):
            return _Query()
        def commit(self):
            pass
        def refresh(self, obj):
            pass
        def rollback(self):
            pass

    # Patch storage upload/delete in the universities router module
    monkeypatch.setattr(uni_router, "upload_file", lambda file_data, object_name, content_type: "/storage/logos/university-1.png")
    monkeypatch.setattr(uni_router, "delete_file", lambda object_name: None)

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        file_content = b"pngdata"
        files = {"file": ("logo.png", io.BytesIO(file_content), "image/png")}
        r = client.post("/api/v1/universities/1/logo", files=files)
        assert r.status_code == 200
        assert r.json()["logo_url"].startswith("/storage/")
    finally:
        app_main.app.dependency_overrides.clear()


def test_delete_university_logo_success(client, monkeypatch, set_user):
    import routers.universities as uni_router
    from utils.models import UniversityDB

    set_user(DummyUser(is_root=True))

    uni_obj = FakeUniversity(1, "U", "U", "uni_1", is_active=True, logo_url="/storage/logos/university-1.png")

    class _Query:
        def __init__(self):
            pass
        def filter(self, *args, **kwargs):
            return self
        def first(self):
            return uni_obj

    class _Sess:
        def query(self, model):
            return _Query()
        def commit(self):
            pass
        def refresh(self, obj):
            pass
        def rollback(self):
            pass

    import routers.universities as uni_router
    monkeypatch.setattr(uni_router, "delete_file", lambda object_name: None)

    import utils.database as db_mod
    import main as app_main
    def _override_db():
        yield _Sess()
    app_main.app.dependency_overrides[db_mod.get_db] = _override_db

    try:
        r = client.delete("/api/v1/universities/1/logo")
        assert r.status_code == 200
        assert r.json()["logo_url"] is None
    finally:
        app_main.app.dependency_overrides.clear()
