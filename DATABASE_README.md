# Epistula Database Setup Guide

## Overview

Epistula uses a **multi-schema PostgreSQL architecture** where each university gets its own dedicated schema. This design provides:

- **Independent backups**: Each university can be backed up/restored separately
- **Data isolation**: University data is logically separated
- **Scalability**: Easy to add new universities without affecting existing ones
- **Performance**: Queries are scoped to relevant data sets

## Quick Start

### 1. Prerequisites

- Docker and Docker Compose installed
- At least 2GB free disk space for database
- Ports 5432 (database), 8000 (backend), 3000 (frontend) available

### 2. Initial Setup

```powershell
# Clone the repository (if not already done)
cd d:\epistula\epistula

# Copy environment template
Copy-Item .env.example .env

# Edit .env and change default passwords!
notepad .env

# Start the database (first time will initialize)
docker-compose up -d database

# Wait for database to be ready (check health)
docker-compose ps

# Start all services
docker-compose up -d
```

### 3. Verify Setup

```powershell
# Check all containers are running
docker-compose ps

# View database logs
docker-compose logs database

# Test backend API
curl http://localhost:8000/health

# Test frontend
Start-Process http://localhost:3000
```

## Database Architecture

### Schema Structure

```
epistula (database)
├── public (global schema)
│   ├── users                    -- All users
│   ├── universities             -- University registry
│   ├── user_university_roles    -- User role assignments
│   └── audit_log                -- System-wide audit trail
│
├── uni_1 (first university)
│   ├── faculties
│   ├── subjects
│   ├── lectures
│   ├── lecture_content
│   ├── subject_professors
│   └── subject_students
│
├── uni_2 (second university)
│   └── ... (same structure as uni_1)
└── ...
```

### Entity Hierarchy

```
University
  └── Faculty
       └── Subject
            └── Lecture
                 └── Lecture Content
```

### User Roles

1. **Root**
   - Super administrator
   - Can create universities and any user role
   - Access to all data across all schemas
   - Only one root user allowed
   - Login restricted to local machine (security)

2. **Uni-Admin**
   - University-level administrator
   - Scoped to one university
   - Can create professors and students
   - Can manage faculties and subjects
   - Cannot access other universities

3. **Professor**
   - Can teach at multiple universities
   - Can create subjects (in universities where they're assigned)
   - Can edit subjects where they have edit rights
   - Can create/edit lectures in their subjects

4. **Student**
   - Belongs to one faculty
   - Can enroll in subjects from any faculty (within same university)
   - Read-only access to enrolled subjects' lectures
   - Cannot see subjects they're not enrolled in

## Database Operations

### Creating a New University

```sql
-- Use the helper function
SELECT create_university(
    'Massachusetts Institute of Technology',  -- name
    'MIT',                                     -- code (will be uppercase)
    'Leading research university',            -- description
    1                                          -- created_by (root user id)
);
-- Returns: university_id
-- Automatically creates schema: uni_<id>
```

### Adding a Faculty

```sql
-- In the university's schema (e.g., uni_1)
INSERT INTO uni_1.faculties (name, code, description, created_by)
VALUES ('Computer Science', 'CS', 'Department of Computer Science', 1);
```

### Creating a Subject

```sql
-- In the university's schema
INSERT INTO uni_1.subjects (faculty_id, name, code, description, created_by)
VALUES (1, 'Introduction to Algorithms', 'CS101', 'Basic algorithms course', 2);
```

### Assigning a Professor to a Subject

```sql
-- Grant professor edit rights to a subject
INSERT INTO uni_1.subject_professors (subject_id, professor_id, can_edit, assigned_by)
VALUES (1, 3, TRUE, 2);  -- subject_id=1, professor_id=3, assigned by user 2
```

### Enrolling a Student

```sql
-- Enroll student in a subject
INSERT INTO uni_1.subject_students (subject_id, student_id, enrolled_by)
VALUES (1, 4, 2);  -- subject_id=1, student_id=4, enrolled by user 2
```

## Backup and Restore

### Backup a Single University

```powershell
# Backup only one university's schema
docker exec epistula_db pg_dump -U epistula_user -n uni_1 epistula > backup_uni_1.sql

# Backup with data compression
docker exec epistula_db pg_dump -U epistula_user -n uni_1 -Fc epistula > backup_uni_1.dump
```

### Backup All Universities

```powershell
# Full database backup
docker exec epistula_db pg_dump -U epistula_user epistula > backup_full.sql
```

### Restore a University

```powershell
# Restore a single university schema
cat backup_uni_1.sql | docker exec -i epistula_db psql -U epistula_user epistula

# Restore from compressed backup
docker exec -i epistula_db pg_restore -U epistula_user -d epistula backup_uni_1.dump
```

### Backup Strategy Recommendation

1. **Daily**: Automated full database backup
2. **Before upgrades**: Manual snapshot of database volume
3. **Per-university**: Weekly backups of each schema
4. **Retention**: Keep last 30 days of backups

## Volume Management

### Database Volume

The database data is stored in a named Docker volume: `epistula_db_data`

```powershell
# List volumes
docker volume ls | Select-String epistula

# Inspect volume
docker volume inspect epistula_db_data

# Backup volume (recommended before major changes)
docker run --rm -v epistula_db_data:/data -v ${PWD}:/backup ubuntu tar czf /backup/db_backup.tar.gz /data
```

### IMPORTANT: Volume Persistence

⚠️ **The database volume persists even when containers are removed**

```powershell
# This is SAFE - destroys containers but keeps data
docker-compose down

# This is DANGEROUS - destroys containers AND data
docker-compose down -v

# To completely reset database (DELETES ALL DATA!)
docker-compose down -v
docker volume rm epistula_db_data
```

## Upgrading the Application

When upgrading Epistula, the database should **NOT** be rebuilt:

```powershell
# Stop all services
docker-compose down

# Pull new code
git pull

# Rebuild only backend and frontend (NOT database!)
docker-compose build backend frontend

# Start all services
docker-compose up -d

# Check migration status (if migrations added)
docker-compose exec backend python -m alembic current
docker-compose exec backend python -m alembic upgrade head
```

## Database Migrations

For schema changes, use Alembic migrations:

```powershell
# Create a new migration
docker-compose exec backend python -m alembic revision -m "Add new feature"

# Apply migrations
docker-compose exec backend python -m alembic upgrade head

# Rollback last migration
docker-compose exec backend python -m alembic downgrade -1

# View migration history
docker-compose exec backend python -m alembic history
```

## Monitoring

### Check Database Health

```powershell
# Connection test
docker-compose exec database pg_isready -U epistula_user

# Database size
docker-compose exec database psql -U epistula_user -d epistula -c "SELECT pg_size_pretty(pg_database_size('epistula'));"

# List all schemas
docker-compose exec database psql -U epistula_user -d epistula -c "\dn"

# Count users per university
docker-compose exec database psql -U epistula_user -d epistula -c "SELECT * FROM v_university_summary;"
```

### View Logs

```powershell
# Database logs
docker-compose logs -f database

# Backend logs
docker-compose logs -f backend

# All logs
docker-compose logs -f
```

## Troubleshooting

### Database Won't Start

```powershell
# Check logs
docker-compose logs database

# Verify volume
docker volume inspect epistula_db_data

# Check port availability
netstat -ano | Select-String ":5432"
```

### Connection Refused

```powershell
# Verify database is healthy
docker-compose ps

# Check environment variables
docker-compose exec backend env | Select-String DB_

# Test connection from backend
docker-compose exec backend python -c "import psycopg2; print(psycopg2.connect(host='database', dbname='epistula', user='epistula_user', password='your_password'))"
```

### Initialization Scripts Not Running

Initialization scripts only run when the database is **first created**:

```powershell
# To re-run initialization (DELETES ALL DATA!)
docker-compose down -v
docker volume rm epistula_db_data
docker-compose up -d database
```

### Performance Issues

```powershell
# Check active connections
docker-compose exec database psql -U epistula_user -d epistula -c "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries
docker-compose exec database psql -U epistula_user -d epistula -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds';"

# Vacuum database
docker-compose exec database psql -U epistula_user -d epistula -c "VACUUM ANALYZE;"
```

## Security Considerations

1. **Change default passwords** in `.env` file
2. **Use strong JWT secret** (generate with: `openssl rand -hex 32`)
3. **Restrict root login** to localhost only
4. **Regular backups** to prevent data loss
5. **Network isolation** using Docker networks
6. **Environment variables** never commit `.env` to git
7. **Database encryption** at rest (configure in PostgreSQL)

## Development vs Production

### Development Mode

```env
EPISTULA_ENV=development
EPISTULA_CORS_ORIGINS=http://localhost:3000
DB_PASSWORD=dev_password_ok
```

- CORS allows localhost
- Detailed error messages
- Hot reload enabled
- Volume mounts for live code updates

### Production Mode

```env
EPISTULA_ENV=production
EPISTULA_CORS_ORIGINS=https://yourdomain.com
DB_PASSWORD=very_strong_random_password_here
JWT_SECRET=strong_random_secret_min_32_chars
```

- CORS restricted to specific domains
- Generic error messages
- No volume mounts
- Optimized builds
- SSL/TLS enabled

## Next Steps

1. Review and customize `.env` file
2. Start services: `docker-compose up -d`
3. Create root user (automatic on first run)
4. Create first university via API
5. Set up automated backups
6. Configure monitoring/alerting
7. Review security settings

For detailed implementation guides, see:
- `DATABASE_DESIGN.md` - Complete schema documentation
- `backend/README.md` - Backend API documentation
- `QUICKSTART.md` - Getting started guide
