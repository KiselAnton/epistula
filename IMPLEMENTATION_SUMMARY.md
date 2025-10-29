# Epistula Database Architecture - Implementation Summary

## What We've Created

### 1. Database Design (`DATABASE_DESIGN.md`)
Complete architectural documentation including:
- Multi-schema approach (one schema per university)
- Entity hierarchy: University → Faculty → Subject → Lecture
- User role system: Root, Uni-Admin, Professor, Student
- Access control rules and permissions
- Implementation phases

### 2. Docker Infrastructure

#### `docker-compose.yml`
- **Database container**: PostgreSQL 16 with persistent volume
- **Backend container**: FastAPI application (can be rebuilt)
- **Frontend container**: Next.js application (can be rebuilt)
- Network isolation and health checks

#### `.env.example`
Environment configuration template with:
- Database credentials
- JWT security settings
- CORS configuration
- Service ports

### 3. Database Initialization Scripts

Located in `epistula/database/init/`:

1. **`01_create_types.sql`**
   - User role enum (root, uni_admin, professor, student)
   - Enrollment status enum
   - Content type enum
   - Audit action enum

2. **`02_create_global_tables.sql`**
   - `users` - Central user registry
   - `universities` - University registry
   - `user_university_roles` - Role assignments
   - `audit_log` - System audit trail
   - Triggers for data integrity

3. **`03_create_schema_functions.sql`**
   - `create_university_schema()` - Creates new university schema
   - `drop_university_schema()` - Safely deletes university schema
   - Automatically creates all tables for new universities

4. **`04_create_helper_functions.sql`**
   - `get_user_roles()` - Get all roles for a user
   - `has_role()` - Check specific role
   - `is_root_user()` - Check if user is root
   - `create_university()` - High-level university creation
   - Views: `v_user_summary`, `v_university_summary`
   - Validation triggers

### 4. Backend Infrastructure

#### `backend/database.py`
SQLAlchemy configuration with:
- Connection pooling
- Multi-schema support
- Session management
- University-specific session context manager
- FastAPI dependency injection
- Health check utilities

#### `backend/requirements.txt`
Updated with:
- SQLAlchemy 2.0.23
- psycopg2-binary (PostgreSQL adapter)
- Alembic (migrations)
- python-jose (JWT)
- passlib (password hashing)

### 5. Documentation

#### `DATABASE_README.md`
Comprehensive guide covering:
- Quick start instructions
- Schema structure explanation
- Database operations (CRUD examples)
- Backup and restore procedures
- Volume management
- Upgrade process
- Monitoring and troubleshooting
- Security best practices

## Key Design Decisions

### 1. Multi-Schema Architecture ✅

**Decision**: Each university gets its own PostgreSQL schema (e.g., `uni_1`, `uni_2`)

**Benefits**:
- **Independent backups**: Can backup/restore individual universities
- **Data isolation**: University data is logically separated
- **Scalability**: Easy to add new universities
- **Performance**: Queries scoped to relevant data
- **Security**: Schema-level access control

**Example**:
```
epistula (database)
├── public (global)
│   ├── users (all users)
│   ├── universities
│   └── user_university_roles
├── uni_1 (MIT)
│   ├── faculties
│   ├── subjects
│   └── lectures
└── uni_2 (Harvard)
    └── ... (same structure)
```

### 2. Global User Registry ✅

**Decision**: All users stored in `public.users`, roles assigned per university

**Benefits**:
- Professors can teach at multiple universities
- Single authentication mechanism
- Centralized user management
- Easy cross-university queries

### 3. Persistent Database Container ✅

**Decision**: Database runs in its own container with named volume

**Benefits**:
- Survives application upgrades
- Can rebuild backend/frontend without losing data
- Standard Docker backup/restore procedures
- Easy to scale/migrate

### 4. Hierarchical Faculty Model ✅

**Decision**: University → Faculty → Subject → Lecture

**Benefits**:
- Students belong to one faculty but can take subjects from others
- Clear organizational structure
- Flexible subject assignment
- Matches real-world university structure

### 5. Role-Based Access Control ✅

**Decision**: Four distinct roles with clear permissions

**Root**:
- Can do anything
- Only one allowed
- Login restricted to localhost

**Uni-Admin**:
- Scoped to one university
- Manages users and structure

**Professor**:
- Can teach at multiple universities
- Edit rights assigned per subject

**Student**:
- Belongs to one faculty
- Enrolls in multiple subjects
- Read-only access to lectures

## Implementation Phases

### Phase 1: Database Setup (Current) ✅
- [x] Docker Compose configuration
- [x] PostgreSQL container setup
- [x] Database initialization scripts
- [x] Multi-schema functions
- [x] Helper functions and views
- [x] Documentation

### Phase 2: Backend - User Management (Next)
- [ ] User authentication (JWT)
- [ ] Password hashing (bcrypt)
- [ ] Root user initialization
- [ ] Role-based middleware
- [ ] User CRUD endpoints
- [ ] Login/logout endpoints

### Phase 3: Backend - University Management
- [ ] University CRUD endpoints
- [ ] Faculty CRUD endpoints
- [ ] Schema creation on university creation
- [ ] Uni-admin assignment

### Phase 4: Backend - Subject & Lecture Management
- [ ] Subject CRUD endpoints
- [ ] Professor assignment to subjects
- [ ] Lecture CRUD endpoints
- [ ] Content versioning
- [ ] Student enrollment endpoints

### Phase 5: Frontend Integration
- [ ] Login/authentication UI
- [ ] University management UI
- [ ] Faculty/subject browser
- [ ] Lecture viewer
- [ ] Admin dashboards
- [ ] Student dashboard

### Phase 6: Advanced Features
- [ ] Backup/restore UI
- [ ] Audit log viewer
- [ ] Search functionality
- [ ] Student notes system
- [ ] AI-powered content suggestions
- [ ] Analytics dashboard

## Next Steps

### Immediate (Do Now)

1. **Review and customize `.env`**
   ```powershell
   cd d:\epistula\epistula
   Copy-Item .env.example .env
   notepad .env
   ```
   - Change `DB_PASSWORD`
   - Set strong `JWT_SECRET` (use `openssl rand -hex 32`)
   - Set `ROOT_EMAIL` and `ROOT_PASSWORD`

2. **Start the database**
   ```powershell
   docker-compose up -d database
   docker-compose logs -f database
   ```
   Wait for "database system is ready to accept connections"

3. **Verify initialization**
   ```powershell
   docker-compose exec database psql -U epistula_user -d epistula -c "\dt public.*"
   ```
   Should show: users, universities, user_university_roles, audit_log

### Short Term (This Week)

4. **Implement user authentication**
   - Create `auth.py` with JWT token generation
   - Hash passwords with bcrypt
   - Create root user on startup
   - Add login endpoint

5. **Create basic user endpoints**
   - POST /users (create user)
   - GET /users/me (current user)
   - GET /users (list users - admin only)
   - PUT /users/{id} (update user)

6. **Test with curl/Postman**
   - Create root user
   - Login and get JWT token
   - Create test university
   - Create test users

### Medium Term (Next 2 Weeks)

7. **University management**
   - POST /universities (create)
   - GET /universities (list)
   - GET /universities/{id}/faculties
   - POST /universities/{id}/faculties

8. **Subject management**
   - CRUD endpoints for subjects
   - Professor assignment
   - Student enrollment

9. **Frontend integration**
   - Update Next.js frontend
   - Add authentication
   - Create admin dashboard

### Long Term (Next Month)

10. **Production readiness**
    - Add comprehensive tests
    - Set up CI/CD
    - Configure SSL/TLS
    - Set up monitoring
    - Implement backup automation
    - Security audit

## Testing the Database

### Manual Testing

```powershell
# Connect to database
docker-compose exec database psql -U epistula_user -d epistula

# Test creating a university
SELECT create_university('Test University', 'TEST', 'Test description', NULL);

# Verify schema was created
\dn

# Check the schema has tables
\dt uni_1.*

# Test helper functions
SELECT * FROM v_university_summary;
```

### Sample Data Script

Create `epistula/database/init/99_sample_data.sql` (optional, for dev):

```sql
-- Create root user (password: 'root123')
INSERT INTO public.users (email, name, password_hash, is_root, is_active)
VALUES ('root@localhost', 'Root User', '$2b$12$...', TRUE, TRUE);

-- Create test university
SELECT create_university('Massachusetts Institute of Technology', 'MIT', 
    'Leading research university', 1);

-- Add faculty
INSERT INTO uni_1.faculties (name, code, description, created_by)
VALUES ('Computer Science', 'CS', 'Department of Computer Science', 1);
```

## Common Operations Reference

### Create University
```sql
SELECT create_university('University Name', 'CODE', 'Description', creator_user_id);
```

### Assign User Role
```sql
INSERT INTO public.user_university_roles (user_id, university_id, role)
VALUES (user_id, uni_id, 'professor');
```

### Enroll Student
```sql
INSERT INTO uni_1.subject_students (subject_id, student_id, enrolled_by)
VALUES (subject_id, student_id, admin_user_id);
```

### Check User Permissions
```sql
SELECT * FROM get_user_roles(user_id);
SELECT has_role(user_id, university_id, 'professor');
```

### Backup Single University
```powershell
docker exec epistula_db pg_dump -U epistula_user -n uni_1 epistula > backup.sql
```

## File Structure

```
epistula/
├── .env.example                  # Environment template
├── docker-compose.yml            # Container orchestration
├── DATABASE_DESIGN.md           # Architecture documentation
├── DATABASE_README.md           # Operations guide
├── IMPLEMENTATION_SUMMARY.md    # This file
│
├── epistula/
│   ├── database/
│   │   └── init/                # Database initialization
│   │       ├── 01_create_types.sql
│   │       ├── 02_create_global_tables.sql
│   │       ├── 03_create_schema_functions.sql
│   │       └── 04_create_helper_functions.sql
│   │
│   ├── backend/
│   │   ├── database.py          # SQLAlchemy configuration
│   │   ├── requirements.txt     # Python dependencies
│   │   ├── models.py            # Pydantic/SQLAlchemy models
│   │   ├── auth.py              # Authentication (to update)
│   │   └── main.py              # FastAPI app (to update)
│   │
│   └── frontend/
│       └── ...                  # Next.js app (to update)
```

## Security Checklist

- [ ] Change default `DB_PASSWORD` in `.env`
- [ ] Generate strong `JWT_SECRET` (min 32 chars)
- [ ] Change `ROOT_PASSWORD` from default
- [ ] Restrict CORS in production (`EPISTULA_CORS_ORIGINS`)
- [ ] Enable SSL/TLS for production
- [ ] Regular security updates
- [ ] Implement rate limiting
- [ ] Add request validation
- [ ] Enable audit logging
- [ ] Regular backups
- [ ] Encrypt database at rest
- [ ] Use secrets management (not .env in prod)

## Questions & Decisions Needed

None at the moment - architecture is solid and ready for implementation!

## Resources

- **PostgreSQL Docs**: https://www.postgresql.org/docs/16/
- **SQLAlchemy Docs**: https://docs.sqlalchemy.org/
- **FastAPI Docs**: https://fastapi.tiangolo.com/
- **Docker Docs**: https://docs.docker.com/

---

**Status**: Phase 1 Complete ✅  
**Next Phase**: User Authentication & Management  
**Ready to Start**: Yes! Run `docker-compose up -d database`
