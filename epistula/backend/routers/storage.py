"""Storage API endpoints for serving files from MinIO."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from utils.minio_client import get_file, MINIO_BUCKET
from minio.error import S3Error

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
