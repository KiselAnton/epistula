# What Happened: Data Loss Investigation

## Timeline of Events

### When Data Was Lost

Based on Docker volume creation timestamp: **November 1, 2025 at 12:23:20 UTC**

The `epistula_db_data` volume was created fresh today, which means all previous data (universities, faculties, users beyond root) was lost before this time.

### Possible Causes

The volume was likely deleted by one of these operations:

1. **`docker compose down -v`** - The `-v` flag removes named volumes
2. **`docker volume rm epistula_db_data`** - Explicit volume deletion
3. **`docker system prune --volumes`** - Aggressive cleanup that removes volumes
4. **Volume name change** - If docker-compose.yml volume config changed (checked: it didn't)
5. **Manual volume pruning** - `docker volume prune` if volume became orphaned

### Evidence

```
PowerShell history shows these commands:
- docker compose rm -sfv frontend
- docker compose down frontend
- Multiple container rebuilds
```

None of these should have deleted the database volume, which suggests either:
- A different terminal session ran `docker compose down -v`
- Docker Desktop performed cleanup
- Manual volume deletion occurred

### What Was Lost

- All universities created
- All faculties within those universities
- All subjects and lectures
- All user accounts except root
- All uploaded files in MinIO (if not backed up separately)

### What Survived

- Root user account (proves volume IS persisting correctly NOW)
- Database schema (tables, views, functions)
- Docker container configuration
- Application code

## Current Protection Status

### ✅ **Data Persistence IS Working**

The fact that the root user survived multiple restarts proves the volume system is functioning correctly:

```powershell
# Verified operations that preserved root user:
- Container restarts
- Backend crashes and recovery
- Frontend rebuilds
- Port configuration changes
```

### 🔒 **New Protections Implemented**

1. **Backup Scripts Created:**
   - `backup_database.ps1` (Windows)
   - `backup_database.sh` (Linux/Mac)
   - `restore_database.ps1` (Windows)
   - `restore_database.sh` (Linux/Mac)

2. **Documentation Added:**
   - `DATA_SAFETY.md` - Complete backup and recovery guide
   - `README.md` - Updated with data safety warnings
   - `docker-compose.yml` - Added warning header about volume operations

3. **Automated Backup Support:**
   - Scripts automatically keep last 10 backups
   - Compress backups to save space
   - Include instructions for Windows Task Scheduler
   - Include instructions for Linux cron jobs

4. **Initial Backup Created:**
   ```
   ✓ backups/database/epistula_backup_20251101_153506.sql.zip
   ```
   (Contains current state: root user + empty database)

## What To Do Now

### Immediate Actions

1. **Set up automated backups:**
   ```powershell
   # Windows: Create scheduled task
   # See DATA_SAFETY.md section "Automated Backups (Windows Task Scheduler)"
   ```

2. **Create backup BEFORE any risky operation:**
   ```powershell
   .\backup_database.ps1  # Always run this first!
   ```

3. **NEVER use these commands without backing up:**
   ```powershell
   docker compose down -v              # ❌ DELETES VOLUMES
   docker volume rm epistula_db_data   # ❌ DELETES DATABASE
   docker volume prune                 # ❌ MAY DELETE IF ORPHANED
   ```

4. **SAFE commands (these preserve data):**
   ```powershell
   docker compose down          # ✅ No -v flag
   docker compose restart       # ✅ Safe
   docker compose up --build    # ✅ Safe
   ```

### Recovery From Data Loss

Unfortunately, **without a backup, the old data cannot be recovered**.

Moving forward:
1. Recreate universities through the UI at http://localhost:3000
2. Backup immediately after creating important data
3. Set up daily automated backups
4. Consider external backup storage (cloud, external drive)

## Prevention Checklist

- [ ] Read `DATA_SAFETY.md` completely
- [ ] Set up automated daily backups (Task Scheduler or cron)
- [ ] Test backup/restore procedure once
- [ ] Create backup before git pull or updates
- [ ] Create backup before Docker cleanup operations
- [ ] Store backups in multiple locations (local + cloud)
- [ ] Document who has access to production Docker commands
- [ ] Add pre-commit hooks to warn about risky Docker commands

## Technical Details

### Volume Configuration

```yaml
# docker-compose.yml
volumes:
  epistula_db_data:
    driver: local
    name: epistula_db_data  # Named volume (persistent)
  
  epistula_minio_data:
    driver: local
    name: epistula_minio_data
```

### Database Architecture

- **Public schema**: users, universities, audit_log
- **Per-university schemas**: `uni_1`, `uni_2`, etc.
  - Each contains: faculties, subjects, lectures, enrollments
- **Dynamic schema creation**: Created when university is added

### Current State

```sql
SELECT COUNT(*) FROM public.users;        -- 1 (root)
SELECT COUNT(*) FROM public.universities; -- 0
SELECT COUNT(*) FROM public.audit_log;    -- TBD
```

## Lessons Learned

1. **Docker volumes ARE persistent** - but only if not explicitly deleted
2. **The `-v` flag is dangerous** - `docker compose down -v` deletes everything
3. **Backups are critical** - No backup = no recovery
4. **Automation is key** - Manual backups get forgotten
5. **Documentation matters** - Clear warnings prevent accidents

## Questions for You

1. **Do you remember running `docker compose down -v`?**
2. **Did Docker Desktop show any cleanup notifications?**
3. **Were there any other terminals/sessions running Docker commands?**
4. **Do you have any external backups of the database?**
5. **When was the last time the data was known to be present?**

---

**Bottom Line**: Your data is **NOW PROTECTED** with volume persistence working correctly. The old data is lost without a backup, but this won't happen again if you:

1. Use the backup scripts regularly
2. Set up automated daily backups  
3. Never run `docker compose down -v`
4. Always backup before risky operations

See `DATA_SAFETY.md` for complete procedures.
