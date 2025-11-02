# Backend Architecture

This document describes the backend architecture for Epistula.

## Directory Structure

```
backend/
├── main.py               # FastAPI app initialization
├── auth.py               # Authentication endpoints
├── auth_utils.py         # Auth helper functions
├── database.py           # Database connection
├── models.py             # Pydantic and SQLAlchemy models
├── init_root_user.py     # Root user initialization
├── universities.py       # Universities API
├── faculties.py          # Faculties API
├── subjects.py           # Subjects API
├── storage.py            # File storage API
├── minio_client.py       # MinIO utilities
├── requirements.txt      # Python dependencies
└── VERSION               # Version file
```

## Architecture Patterns

### 1. Router Pattern

Each entity has its own router file:

```python
# universities.py
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/universities", tags=["universities"])

@router.get("/")
def list_universities():
    ...

@router.post("/")
def create_university():
    ...
```

### 2. Database Schema Pattern

- **Public Schema:** Users, Universities registry
- **University Schemas:** `uni_<id>` contains faculties, subjects, lectures, etc.

This allows:
- Data isolation per university
- Easier backups per university
- Independent scaling

### 3. Dynamic Schema Queries

```python
schema_name = uni.schema_name
query = text(f"""
    SELECT * FROM {schema_name}.faculties 
    WHERE id = :id
""")
result = db.execute(query, {"id": faculty_id})
```

### 4. Cascade Deletion

Database enforces referential integrity:
- Delete University → Drop entire schema (all faculties, subjects, etc.)
- Delete Faculty → CASCADE deletes subjects, lectures
- Delete Subject → CASCADE deletes lectures, content

### 5. File Storage (MinIO)

Centralized file operations:

```python
from minio_client import upload_file, delete_file

# Upload
logo_url = upload_file(file_data, object_name, content_type)

# Delete
delete_file(object_name)
```

## API Endpoints Structure

```
/api/v1/
├── auth/
│   ├── POST /login
│   └── POST /register
├── universities/
│   ├── GET /
│   ├── POST /
│   ├── DELETE /{id}
│   └── POST /{id}/logo
├── faculties/
│   ├── GET /{university_id}
│   ├── POST /{university_id}
│   ├── DELETE /{university_id}/{faculty_id}
│   └── POST /{university_id}/{faculty_id}/logo
├── subjects/
│   ├── GET /{university_id}/{faculty_id}
│   ├── POST /{university_id}/{faculty_id}
│   └── DELETE /{university_id}/{faculty_id}/{subject_id}
└── storage/
    └── GET /{file_path}
├── backups/
│   ├── GET /all                               # Root: list backups grouped by university
│   ├── GET /{university_id}                   # List backups for one university
│   ├── POST /{university_id}/create           # Create backup now
│   ├── POST /{university_id}/{name}/restore   # Restore backup (to prod or temp via ?to_temp=true)
│   ├── POST /{university_id}/{name}/upload-to-minio   # Upload local backup to MinIO
│   ├── POST /{university_id}/promote-temp     # Promote temp schema to production
│   ├── DELETE /{university_id}/temp-schema    # Drop temp schema and cleanup
│   ├── GET /{university_id}/temp-status       # Inspect temp schema state
│   └── DELETE /{university_id}/{name}         # Delete backup (local and optionally MinIO)
```

## Security

1. **JWT Authentication:** All endpoints require valid token
2. **Role-Based Access:** Root users have full access
3. **SQL Injection Prevention:** Using parameterized queries
4. **File Upload Validation:** Size limits, type checking

## Database Functions

Located in `database/init/03_create_schema_functions.sql`:

- `create_university(name, code, description, created_by)` - Creates uni + schema
- `create_university_schema(schema_name)` - Creates all tables
- `drop_university_schema(schema_name)` - Safe schema deletion

## Best Practices

1. **Use text() for dynamic schemas** to prevent SQL injection
2. **Always use parameterized queries** with `:param` syntax
3. **Check permissions** before operations
4. **Handle MinIO errors gracefully** (S3Error)
5. **Return proper HTTP status codes**
6. **Document with docstrings**

## Future Improvements

1. Add API versioning (v2, v3)
2. Add rate limiting
3. Add request validation middleware
4. Add logging middleware
5. Add metrics/monitoring
6. Add API documentation (OpenAPI/Swagger)
7. Add database migrations (Alembic)
