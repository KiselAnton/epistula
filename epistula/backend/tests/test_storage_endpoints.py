"""
Tests for storage endpoints - file upload and retrieval
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from io import BytesIO


def test_upload_file_requires_authentication(client):
    """Test that file upload requires authentication."""
    # Create a fake file
    file_content = b"fake image content"
    files = {"file": ("test.jpg", BytesIO(file_content), "image/jpeg")}
    
    response = client.post("/api/v1/storage/upload", files=files)
    assert response.status_code == 401


def test_upload_file_validates_size(client, set_user):
    """Test that files larger than 10MB are rejected."""
    # Set authenticated user
    set_user(id=1, email="test@example.com", role="professor")
    
    # Create a file larger than 10MB (10 * 1024 * 1024 bytes)
    large_content = b"x" * (11 * 1024 * 1024)
    files = {"file": ("large.jpg", BytesIO(large_content), "image/jpeg")}
    
    with patch("routers.storage.upload_file") as mock_upload:
        response = client.post("/api/v1/storage/upload", files=files)
        assert response.status_code == 400
        assert "too large" in response.json()["detail"].lower()
        # Should not attempt upload
        mock_upload.assert_not_called()


def test_upload_file_validates_content_type(client, set_user):
    """Test that only allowed file types can be uploaded."""
    set_user(id=1, email="test@example.com", role="professor")
    
    # Try to upload an executable file
    file_content = b"fake exe content"
    files = {"file": ("virus.exe", BytesIO(file_content), "application/x-msdownload")}
    
    with patch("routers.storage.upload_file") as mock_upload:
        response = client.post("/api/v1/storage/upload", files=files)
        assert response.status_code == 400
        assert "not allowed" in response.json()["detail"].lower() or "invalid" in response.json()["detail"].lower()
        mock_upload.assert_not_called()


def test_upload_image_success(client, set_user):
    """Test successful image upload."""
    set_user(id=1, email="test@example.com", role="professor")
    
    file_content = b"fake image content"
    files = {"file": ("test.jpg", BytesIO(file_content), "image/jpeg")}
    
    with patch("routers.storage.upload_file") as mock_upload:
        # Mock successful upload returning a file path
        mock_upload.return_value = "uploads/2025/11/abc123.jpg"
        
        response = client.post("/api/v1/storage/upload", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert data["url"].startswith("/storage/")
        assert "filename" in data
        assert "content_type" in data
        assert data["content_type"] == "image/jpeg"


def test_upload_file_success(client, set_user):
    """Test successful file upload (non-image)."""
    set_user(id=1, email="test@example.com", role="professor")
    
    file_content = b"PDF content here"
    files = {"file": ("document.pdf", BytesIO(file_content), "application/pdf")}
    
    with patch("routers.storage.upload_file") as mock_upload:
        mock_upload.return_value = "uploads/2025/11/document123.pdf"
        
        response = client.post("/api/v1/storage/upload", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert "/storage/" in data["url"]
        assert data["content_type"] == "application/pdf"


def test_get_file_not_found(client):
    """Test retrieving a file that doesn't exist returns 404."""
    with patch("routers.storage.get_file") as mock_get:
        # Simulate S3Error for missing file
        from minio.error import S3Error
        mock_get.side_effect = S3Error(
            code="NoSuchKey",
            message="The specified key does not exist",
            resource="test.jpg",
            request_id="123",
            host_id="abc",
            response=MagicMock()
        )
        
        response = client.get("/api/v1/storage/uploads/2025/11/nonexistent.jpg")
        assert response.status_code == 404


def test_get_file_success_jpg(client):
    """Test retrieving a JPG image."""
    fake_image_data = b"\xff\xd8\xff\xe0\x00\x10JFIF"  # JPEG header
    
    with patch("routers.storage.get_file") as mock_get:
        mock_get.return_value = fake_image_data
        
        response = client.get("/api/v1/storage/uploads/2025/11/test.jpg")
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/jpeg"
        assert response.content == fake_image_data


def test_get_file_success_png(client):
    """Test retrieving a PNG image."""
    fake_image_data = b"\x89PNG\r\n\x1a\n"  # PNG header
    
    with patch("routers.storage.get_file") as mock_get:
        mock_get.return_value = fake_image_data
        
        response = client.get("/api/v1/storage/uploads/2025/11/test.png")
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"


def test_get_file_success_pdf(client):
    """Test retrieving a PDF file."""
    fake_pdf_data = b"%PDF-1.4"
    
    with patch("routers.storage.get_file") as mock_get:
        mock_get.return_value = fake_pdf_data
        
        response = client.get("/api/v1/storage/uploads/2025/11/document.pdf")
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"


def test_get_file_cache_headers(client):
    """Test that file retrieval includes proper cache headers."""
    fake_data = b"test"
    
    with patch("routers.storage.get_file") as mock_get:
        mock_get.return_value = fake_data
        
        response = client.get("/api/v1/storage/uploads/2025/11/test.jpg")
        
        assert response.status_code == 200
        assert "cache-control" in response.headers
        # Should cache for a long time (1 year = 31536000 seconds)
        assert "31536000" in response.headers["cache-control"]


def test_upload_supports_image_jpg_mimetype(client, set_user):
    """Test that image/jpg MIME type is accepted (in addition to image/jpeg)."""
    set_user(id=1, email="test@example.com", role="professor")
    
    file_content = b"fake jpg image"
    files = {"file": ("photo.jpg", BytesIO(file_content), "image/jpg")}
    
    with patch("routers.storage.upload_file") as mock_upload:
        mock_upload.return_value = "uploads/2025/11/photo123.jpg"
        
        response = client.post("/api/v1/storage/upload", files=files)
        
        # Should accept image/jpg even though standard is image/jpeg
        assert response.status_code == 200


def test_upload_different_roles_can_upload(client, set_user):
    """Test that all staff roles can upload files."""
    file_content = b"test content"
    files = {"file": ("test.jpg", BytesIO(file_content), "image/jpeg")}
    
    roles = ["root", "uni_admin", "professor"]
    
    with patch("routers.storage.upload_file") as mock_upload:
        mock_upload.return_value = "uploads/2025/11/test123.jpg"
        
        for role in roles:
            set_user(id=1, email=f"{role}@example.com", role=role)
            
            response = client.post("/api/v1/storage/upload", files=files)
            assert response.status_code == 200, f"Role {role} should be able to upload"


def test_students_can_upload_images(client, set_user):
    """Test that students can also upload images (for profile pictures, assignments, etc)."""
    set_user(id=1, email="student@example.com", role="student")
    
    file_content = b"student image"
    files = {"file": ("assignment.jpg", BytesIO(file_content), "image/jpeg")}
    
    with patch("routers.storage.upload_file") as mock_upload:
        mock_upload.return_value = "uploads/2025/11/student123.jpg"
        
        response = client.post("/api/v1/storage/upload", files=files)
        assert response.status_code == 200
