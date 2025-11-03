import io
import pytest


def test_upload_rejects_large_file(client):
    data = b"x" * (10 * 1024 * 1024 + 1)
    files = {"file": ("big.bin", io.BytesIO(data), "application/pdf")}
    resp = client.post("/storage/upload", files=files)
    assert resp.status_code == 400
    assert resp.json()["detail"].startswith("File too large")


def test_upload_unsupported_type(client):
    data = b"hello"
    files = {"file": ("file.xyz", io.BytesIO(data), "application/x-unknown")}
    resp = client.post("/storage/upload", files=files)
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Unsupported file type"


def test_upload_success_image(client, monkeypatch):
    # Mock upload_file to avoid real storage
    import routers.storage as storage_router

    def fake_upload_file(file_data, object_name, content_type):
        assert file_data == b"img"
        assert content_type == "image/png"
        assert object_name.startswith("uploads/")
        return f"/storage/{object_name}"

    monkeypatch.setattr(storage_router, "upload_file", fake_upload_file)

    files = {"file": ("pic.png", io.BytesIO(b"img"), "image/png")}
    resp = client.post("/storage/upload", files=files)
    assert resp.status_code == 200
    body = resp.json()
    assert body["url"].startswith("/storage/uploads/")
    assert body["filename"] == "pic.png"
    assert body["content_type"] == "image/png"
    assert body["size"] == 3


def test_upload_storage_error(client, monkeypatch):
    import routers.storage as storage_router

    def bad_upload_file(*args, **kwargs):
        raise Exception("boom")

    monkeypatch.setattr(storage_router, "upload_file", bad_upload_file)

    files = {"file": ("doc.pdf", io.BytesIO(b"data"), "application/pdf")}
    resp = client.post("/storage/upload", files=files)
    assert resp.status_code == 500
    assert "Error uploading file" in resp.json()["detail"]
