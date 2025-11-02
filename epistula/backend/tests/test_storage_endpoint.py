from .test_utils import FakeS3Error


def test_get_file_success(client, monkeypatch):
    import routers.storage as storage

    # Patch get_file to return bytes
    monkeypatch.setattr(storage, "get_file", lambda path: b"data")

    r = client.get("/storage/logos/u.png")
    assert r.status_code == 200
    # Should detect PNG by extension
    assert r.headers.get("content-type") == "image/png"
    assert r.content == b"data"


def test_get_file_not_found_returns_404(client, monkeypatch):
    import routers.storage as storage

    def _raise(path):
        raise FakeS3Error("NoSuchKey", "not found")

    monkeypatch.setattr(storage, "get_file", _raise)

    r = client.get("/storage/any/thing.txt")
    assert r.status_code == 404
    assert r.json()["detail"] == "File not found"


def test_get_file_storage_error_returns_500(client, monkeypatch):
    import routers.storage as storage

    def _raise(path):
        raise FakeS3Error("AccessDenied", "denied")

    monkeypatch.setattr(storage, "get_file", _raise)

    r = client.get("/storage/any/thing.pdf")
    assert r.status_code == 500
    # Can match either since exception detection is duck-typed
    assert ("Storage error" in r.json()["detail"] or "Error retrieving file" in r.json()["detail"])
