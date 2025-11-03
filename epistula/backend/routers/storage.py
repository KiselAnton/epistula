"""Storage API endpoints for serving files from MinIO."""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import StreamingResponse
from utils.minio_client import get_file, upload_file
from minio.error import S3Error
from middleware.auth import get_current_user
from utils.models import UserDB
import uuid
from datetime import datetime

router = APIRouter(prefix="/storage", tags=["storage"])


@router.get("/{file_path:path}")
async def get_file_from_storage(file_path: str):
    """Serve files from MinIO storage.
    
    Args:
        file_path: Path to file in storage (e.g., "logos/university-1.png")
        
    Returns:
        StreamingResponse: File content with appropriate content type
    """
    try:
        # Get file from MinIO
        file_data = get_file(file_path)
        
        # Determine content type based on file extension
        content_type = "application/octet-stream"
        if file_path.endswith(".png"):
            content_type = "image/png"
        elif file_path.endswith(".jpg") or file_path.endswith(".jpeg"):
            content_type = "image/jpeg"
        elif file_path.endswith(".svg"):
            content_type = "image/svg+xml"
        elif file_path.endswith(".webp"):
            content_type = "image/webp"
        elif file_path.endswith(".pdf"):
            content_type = "application/pdf"
        
        # Return file as streaming response
        from io import BytesIO
        return StreamingResponse(
            BytesIO(file_data),
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=31536000",  # Cache for 1 year
                "Content-Disposition": f'inline; filename="{file_path.split("/")[-1]}"'
            }
        )
        
    except S3Error as e:
        code = getattr(e, "code", None)
        if code == "NoSuchKey" or "NoSuchKey" in str(e):
            raise HTTPException(status_code=404, detail="File not found")
        raise HTTPException(status_code=500, detail=f"Storage error: {str(e)}")
    except Exception as e:
        # Catch non-S3Error exceptions with a code attribute (e.g., tests)
        code = getattr(e, "code", None)
        if code == "NoSuchKey" or "NoSuchKey" in str(e):
            raise HTTPException(status_code=404, detail="File not found")
        raise HTTPException(status_code=500, detail=f"Error retrieving file: {str(e)}")


@router.post("/upload")
async def upload_to_storage(
    file: UploadFile = File(...),
    folder: str = "uploads",
    current_user: UserDB = Depends(get_current_user),
):
    """Upload an image or file to MinIO and return its accessible URL.

    - Auth required (any authenticated user)
    - Validates content type and size (10MB max)
    - Stores under uploads/YYYY/MM/{uuid}.{ext}
    - Returns JSON: { url, filename, content_type, size }
    """
    # Validate file size (limit 10MB)
    max_size = 10 * 1024 * 1024
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB")

    # Validate content type
    allowed_types = {
        # images
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/svg+xml": "svg",
        "image/webp": "webp",
        "image/gif": "gif",
        # documents
        "application/pdf": "pdf",
        "text/plain": "txt",
        "text/markdown": "md",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
        "text/csv": "csv",
    }
    ext = allowed_types.get(file.content_type)
    if not ext:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    # Normalize folder (prevent traversal)
    safe_folder = "/".join(p for p in folder.split("/") if p and p not in ("..", ".")) or "uploads"

    # Build object name: uploads/YYYY/MM/uuid.ext
    now = datetime.utcnow()
    key = f"{safe_folder}/{now.year:04d}/{now.month:02d}/{uuid.uuid4().hex}.{ext}"

    try:
        url_path = upload_file(
            file_data=content,
            object_name=key,
            content_type=file.content_type,
        )
        return {
            "url": url_path,  # e.g., /storage/uploads/...
            "filename": file.filename,
            "content_type": file.content_type,
            "size": len(content),
        }
    except S3Error as e:
        raise HTTPException(status_code=500, detail=f"Storage error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")
