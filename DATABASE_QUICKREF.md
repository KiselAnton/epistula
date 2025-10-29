# Epistula Database - Quick Reference Card

## 🚀 Quick Start Commands

### Start Services
```powershell
# Start all services
docker-compose up -d

# Start only database
docker-compose up -d database

# View logs
docker-compose logs -f

# Stop services (keeps data)
docker-compose down

# ⚠️ DANGER: Stop and delete ALL data
docker-compose down -v
```

### First Time Setup
```powershell
# 1. Copy environment template
Copy-Item .env.example .env

# 2. Edit passwords (IMPORTANT!)
notepad .env

# 3. Start database
docker-compose up -d database

# 4. Wait for ready
docker-compose logs -f database
# Look for: "database system is ready to accept connections"

# 5. Verify tables created
docker-compose exec database psql -U epistula_user -d epistula -c "\dt public.*"
```

## 🗄️ Database Operations

### Connect to Database
```powershell
# Interactive psql
docker-compose exec database psql -U epistula_user -d epistula

# Run single command
docker-compose exec database psql -U epistula_user -d epistula -c "SELECT * FROM public.users;"

# Run SQL file
Get-Content script.sql | docker-compose exec -T database psql -U epistula_user -d epistula
```

### Common Queries

```sql
-- List all users
SELECT id, email, name, is_root, is_active FROM public.users;

-- List universities
SELECT * FROM public.universities;

-- List all schemas
\dn

-- List tables in a schema
\dt public.*
\dt uni_1.*

-- Check user roles
SELECT * FROM get_user_roles(1);  -- user_id = 1

-- University summary
SELECT * FROM v_university_summary;

-- User summary
SELECT * FROM v_user_summary;
```

## 🏛️ University Management

### Create University
```sql
-- Using helper function (recommended)
SELECT create_university(
    'Massachusetts Institute of Technology',  -- name
    'MIT',                                     -- code
    'Leading research university',            -- description
    1                                          -- created_by (user_id)
);

-- Manual (not recommended - use function above)
INSERT INTO public.universities (name, code, schema_name, created_by)
VALUES ('MIT', 'MIT', 'uni_1', 1);
PERFORM create_university_schema('uni_1');
```

### Add Faculty
```sql
-- In university schema (e.g., uni_1)
INSERT INTO uni_1.faculties (name, code, description, created_by)
VALUES ('Computer Science', 'CS', 'CS Department', 1);
```

### Add Subject
```sql
INSERT INTO uni_1.subjects (faculty_id, name, code, description, created_by)
VALUES (1, 'Introduction to Algorithms', 'CS101', 'Basic algorithms', 2);
```

### Add Lecture
```sql
INSERT INTO uni_1.lectures (subject_id, title, description, order_number, created_by)
VALUES (1, 'Sorting Algorithms', 'Learn about quicksort, mergesort...', 1, 3);
```

## 👥 User Management

### Create User
```sql
-- Insert user (password should be hashed by backend!)
INSERT INTO public.users (email, name, password_hash, is_active)
VALUES ('john@example.com', 'John Doe', '$2b$12$...', TRUE)
RETURNING id;
```

### Assign Role
```sql
-- Make user a uni-admin at university 1
INSERT INTO public.user_university_roles (user_id, university_id, role, created_by)
VALUES (2, 1, 'uni_admin', 1);

-- Make user a professor at university 1
INSERT INTO public.user_university_roles (user_id, university_id, role, created_by)
VALUES (3, 1, 'professor', 1);

-- Make user a student at university 1, faculty 1
INSERT INTO public.user_university_roles (user_id, university_id, role, faculty_id, created_by)
VALUES (4, 1, 'student', 1, 1);
```

### Assign Professor to Subject
```sql
INSERT INTO uni_1.subject_professors (subject_id, professor_id, can_edit, assigned_by)
VALUES (1, 3, TRUE, 2);  -- subject 1, professor user 3, can edit, assigned by user 2
```

### Enroll Student in Subject
```sql
INSERT INTO uni_1.subject_students (subject_id, student_id, enrolled_by)
VALUES (1, 4, 2);  -- subject 1, student user 4, enrolled by user 2
```

## 💾 Backup & Restore

### Backup

```powershell
# Full database backup
docker exec epistula_db pg_dump -U epistula_user epistula > backup_full.sql

# Single university backup
docker exec epistula_db pg_dump -U epistula_user -n uni_1 epistula > backup_mit.sql

# Compressed backup
docker exec epistula_db pg_dump -U epistula_user -Fc epistula > backup.dump

# Backup with timestamp
$date = Get-Date -Format "yyyy-MM-dd_HHmmss"
docker exec epistula_db pg_dump -U epistula_user epistula > "backup_$date.sql"
```

### Restore

```powershell
# Restore full database (⚠️ OVERWRITES existing data)
Get-Content backup_full.sql | docker exec -i epistula_db psql -U epistula_user epistula

# Restore single university
Get-Content backup_mit.sql | docker exec -i epistula_db psql -U epistula_user epistula

# Restore compressed backup
docker exec -i epistula_db pg_restore -U epistula_user -d epistula backup.dump
```

### Backup Volume

```powershell
# Backup Docker volume
docker run --rm -v epistula_db_data:/data -v ${PWD}:/backup ubuntu tar czf /backup/volume_backup.tar.gz /data

# Restore Docker volume
docker run --rm -v epistula_db_data:/data -v ${PWD}:/backup ubuntu tar xzf /backup/volume_backup.tar.gz -C /
```

## 🔍 Monitoring

### Database Health
```powershell
# Check if database is ready
docker-compose exec database pg_isready -U epistula_user

# Database size
docker-compose exec database psql -U epistula_user -d epistula -c "SELECT pg_size_pretty(pg_database_size('epistula'));"

# Table sizes
docker-compose exec database psql -U epistula_user -d epistula -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema') ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 10;"
```

### Connection Info
```powershell
# Active connections
docker-compose exec database psql -U epistula_user -d epistula -c "SELECT count(*) FROM pg_stat_activity;"

# Connection details
docker-compose exec database psql -U epistula_user -d epistula -c "SELECT pid, usename, application_name, client_addr, state, query_start FROM pg_stat_activity;"

# Slow queries (> 5 seconds)
docker-compose exec database psql -U epistula_user -d epistula -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds';"
```

### Performance
```powershell
# Vacuum database
docker-compose exec database psql -U epistula_user -d epistula -c "VACUUM ANALYZE;"

# Cache hit ratio (should be > 95%)
docker-compose exec database psql -U epistula_user -d epistula -c "SELECT sum(heap_blks_read) as heap_read, sum(heap_blks_hit) as heap_hit, sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio FROM pg_statio_user_tables;"
```

## 🔒 Security

### Change Passwords
```powershell
# Stop services
docker-compose down

# Edit .env
notepad .env
# Change DB_PASSWORD, JWT_SECRET, ROOT_PASSWORD

# Restart services
docker-compose up -d
```

### User Password (in database)
```sql
-- Update user password (hash with bcrypt first!)
UPDATE public.users 
SET password_hash = '$2b$12$...new_hash_here...', 
    updated_at = NOW()
WHERE id = 1;
```

### Deactivate User
```sql
UPDATE public.users SET is_active = FALSE WHERE id = 5;
```

### Deactivate University
```sql
UPDATE public.universities SET is_active = FALSE WHERE id = 2;
```

## 🧹 Maintenance

### Clean Up
```sql
-- Delete old audit logs (older than 90 days)
DELETE FROM public.audit_log 
WHERE created_at < NOW() - INTERVAL '90 days';

-- Remove inactive users (with confirmation!)
-- ⚠️ CAREFUL: This deletes user data
DELETE FROM public.users 
WHERE is_active = FALSE 
  AND updated_at < NOW() - INTERVAL '365 days';
```

### Rebuild Indexes
```sql
-- Reindex a table
REINDEX TABLE public.users;

-- Reindex entire schema
REINDEX SCHEMA public;
REINDEX SCHEMA uni_1;
```

### Analyze Tables
```sql
-- Update statistics for query planner
ANALYZE public.users;
ANALYZE uni_1.subjects;

-- Analyze all tables
ANALYZE;
```

## 🐛 Troubleshooting

### Database Won't Start
```powershell
# Check logs
docker-compose logs database

# Check if port is in use
netstat -ano | Select-String ":5432"

# Check volume
docker volume inspect epistula_db_data

# Remove and recreate (⚠️ DELETES DATA!)
docker-compose down -v
docker volume rm epistula_db_data
docker-compose up -d database
```

### Can't Connect from Backend
```powershell
# Test connection
docker-compose exec backend python -c "import psycopg2; conn = psycopg2.connect(host='database', dbname='epistula', user='epistula_user', password='your_password'); print('OK')"

# Check environment variables
docker-compose exec backend env | Select-String DB_

# Check network
docker network inspect epistula_epistula_network
```

### Initialization Scripts Didn't Run
```powershell
# Scripts only run on FIRST creation
# To re-run, must delete volume:
docker-compose down -v
docker volume rm epistula_db_data
docker-compose up -d database
```

### Reset Everything
```powershell
# ⚠️ WARNING: Deletes ALL data
docker-compose down -v
docker volume rm epistula_db_data
docker-compose build --no-cache
docker-compose up -d
```

## 📊 Useful Views

```sql
-- All views available
\dv

-- User summary
SELECT * FROM v_user_summary;

-- University summary with counts
SELECT * FROM v_university_summary;

-- User roles across universities
SELECT * FROM get_user_roles(1);  -- user_id

-- Check if user has role
SELECT has_role(1, 1, 'uni_admin');  -- user_id, university_id, role
```

## 🔗 Connection Strings

### From Backend Container
```
postgresql://epistula_user:password@database:5432/epistula
```

### From Host Machine
```
postgresql://epistula_user:password@localhost:5432/epistula
```

### SQLAlchemy Format
```python
DATABASE_URL = "postgresql://epistula_user:password@database:5432/epistula"
```

## 📝 Environment Variables Reference

```env
# Database
DB_HOST=database              # Container name
DB_PORT=5432                  # PostgreSQL port
DB_NAME=epistula             # Database name
DB_USER=epistula_user        # Database user
DB_PASSWORD=your_password    # ⚠️ Change this!

# Application
EPISTULA_ENV=development     # development | production
EPISTULA_CORS_ORIGINS=http://localhost:3000

# Security
JWT_SECRET=your_secret_key   # ⚠️ Use: openssl rand -hex 32
JWT_EXPIRATION_MINUTES=60

# Root User
ROOT_EMAIL=root@localhost
ROOT_PASSWORD=change_me      # ⚠️ Change this!
```

## 🎯 Common Workflows

### Setup New University
```sql
-- 1. Create university
SELECT create_university('Stanford', 'STAN', 'Description', 1);
-- Returns: 3 (university_id)

-- 2. Create uni-admin
INSERT INTO public.user_university_roles (user_id, university_id, role, created_by)
VALUES (5, 3, 'uni_admin', 1);

-- 3. Add faculties
INSERT INTO uni_3.faculties (name, code, created_by)
VALUES 
  ('Engineering', 'ENG', 5),
  ('Computer Science', 'CS', 5);

-- 4. Done! Uni-admin can now manage the university
```

### Setup Complete Course
```sql
-- 1. Create subject
INSERT INTO uni_1.subjects (faculty_id, name, code, created_by)
VALUES (1, 'Web Development', 'CS201', 2)
RETURNING id;  -- Returns: 5

-- 2. Assign professor
INSERT INTO uni_1.subject_professors (subject_id, professor_id, assigned_by)
VALUES (5, 3, 2);

-- 3. Create lectures
INSERT INTO uni_1.lectures (subject_id, title, order_number, created_by)
VALUES 
  (5, 'Introduction to HTML', 1, 3),
  (5, 'CSS Basics', 2, 3),
  (5, 'JavaScript Fundamentals', 3, 3);

-- 4. Enroll students
INSERT INTO uni_1.subject_students (subject_id, student_id, enrolled_by)
VALUES 
  (5, 10, 2),
  (5, 11, 2),
  (5, 12, 2);
```

---

**Quick Links**:
- Full Design: `DATABASE_DESIGN.md`
- Operations Guide: `DATABASE_README.md`
- Visual Reference: `DATABASE_ARCHITECTURE_VISUAL.md`
- Summary: `IMPLEMENTATION_SUMMARY.md`
