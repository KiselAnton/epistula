"""MinIO client configuration and utilities for Epistula.

Provides S3-compatible object storage for files like university logos,
documents, and other uploaded content.
"""
import os
from minio import Minio
from minio.error import S3Error

# MinIO configuration from environment variables
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "epistula")
MINIO_USE_SSL = os.getenv("MINIO_USE_SSL", "false").lower() == "true"


def get_minio_client() -> Minio:
    """Get configured MinIO client instance.
    
    Returns:
        Minio: Configured MinIO client
    """
    return Minio(
        MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=MINIO_USE_SSL
    )


def ensure_bucket_exists(bucket_name: str = MINIO_BUCKET) -> None:
    """Ensure the MinIO bucket exists, create if it doesn't.
    
    Args:
        bucket_name: Name of the bucket to ensure exists
    """
    client = get_minio_client()
    
    try:
        if not client.bucket_exists(bucket_name):
            client.make_bucket(bucket_name)
            print(f"Created MinIO bucket: {bucket_name}")
        else:
            print(f"MinIO bucket already exists: {bucket_name}")
    except S3Error as e:
        print(f"Error ensuring bucket exists: {e}")
        raise


def upload_file(
    file_data: bytes,
    object_name: str,
    content_type: str,
    bucket_name: str = MINIO_BUCKET
) -> str:
    """Upload file to MinIO.
    
    Args:
        file_data: File content as bytes
        object_name: Object name/path in bucket (e.g., "logos/university-1.png")
        content_type: MIME type of the file
        bucket_name: Bucket name (defaults to MINIO_BUCKET env var)
        
    Returns:
        str: URL path to access the file
        
    Raises:
        S3Error: If upload fails
    """
    from io import BytesIO
    
    client = get_minio_client()
    
    try:
        client.put_object(
            bucket_name,
            object_name,
            BytesIO(file_data),
            length=len(file_data),
            content_type=content_type
        )
        
        # Return the URL path (without domain, since we'll proxy through backend)
        return f"/storage/{object_name}"
        
    except S3Error as e:
        print(f"Error uploading file to MinIO: {e}")
        raise


def delete_file(object_name: str, bucket_name: str = MINIO_BUCKET) -> None:
    """Delete file from MinIO.
    
    Args:
        object_name: Object name/path in bucket
        bucket_name: Bucket name (defaults to MINIO_BUCKET env var)
        
    Raises:
        S3Error: If deletion fails
    """
    client = get_minio_client()
    
    try:
        client.remove_object(bucket_name, object_name)
        print(f"Deleted object from MinIO: {object_name}")
    except S3Error as e:
        print(f"Error deleting file from MinIO: {e}")
        raise


def get_file_url(object_name: str, bucket_name: str = MINIO_BUCKET) -> str:
    """Get presigned URL for accessing a file (valid for 7 days).
    
    Args:
        object_name: Object name/path in bucket
        bucket_name: Bucket name (defaults to MINIO_BUCKET env var)
        
    Returns:
        str: Presigned URL to access the file
    """
    from datetime import timedelta
    
    client = get_minio_client()
    
    try:
        # Generate presigned URL valid for 7 days
        url = client.presigned_get_object(
            bucket_name,
            object_name,
            expires=timedelta(days=7)
        )
        return url
    except S3Error as e:
        print(f"Error generating presigned URL: {e}")
        raise


def get_file(object_name: str, bucket_name: str = MINIO_BUCKET) -> bytes:
    """Download file from MinIO.
    
    Args:
        object_name: Object name/path in bucket
        bucket_name: Bucket name (defaults to MINIO_BUCKET env var)
        
    Returns:
        bytes: File content
        
    Raises:
        S3Error: If download fails
    """
    client = get_minio_client()
    
    try:
        response = client.get_object(bucket_name, object_name)
        data = response.read()
        response.close()
        response.release_conn()
        return data
    except S3Error as e:
        print(f"Error downloading file from MinIO: {e}")
        raise
