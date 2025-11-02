# Data Safety & Backup Guide

## 🔒 How Your Data is Protected

### Docker Volume Persistence

Epistula uses **named Docker volumes** to persist data permanently:

- **`epistula_db_data`**: PostgreSQL database (universities, faculties, users, etc.)
- **`epistula_minio_data`**: MinIO object storage (uploaded files, logos, documents)

These volumes survive:
- ✅ Container stop/start (`docker compose stop/start`)
- ✅ Container restart (`docker compose restart`)
- ✅ Container rebuild (`docker compose up --build`)
- ✅ Container removal (`docker compose down`)
- ✅ Docker Desktop restart
- ✅ System reboot

### ⚠️ When Data IS Deleted

Data will ONLY be lost if you:

```powershell
# DON'T DO THIS unless you want to lose all data!
docker compose down -v              # -v flag removes volumes
docker volume rm epistula_db_data   # Explicitly deletes database
docker volume prune                 # Removes unused volumes (if volume is orphaned)
```

**SAFE COMMAND** (preserves data):
```powershell
docker compose down    # No -v flag = volumes preserved
```

## 📦 Creating Backups

### Windows (PowerShell)

**Create a backup:**
```powershell
.\backup_database.ps1
```

**List available backups:**
```powershell
Get-ChildItem backups\database\*.zip | Format-Table Name, LastWriteTime, Length
```

**Restore from backup:**
```powershell
.\restore_database.ps1 -BackupFile .\backups\database\epistula_backup_20251101_143000.sql.zip
```

### Linux/Mac (Bash)

**Create a backup:**
```bash
chmod +x backup_database.sh
./backup_database.sh
```

**List available backups:**
```bash
ls -lh backups/database/*.sql.gz
```

**Restore from backup:**
```bash
chmod +x restore_database.sh
./restore_database.sh backups/database/epistula_backup_20251101_143000.sql.gz
```

## 🔄 Backup Best Practices

### Manual Backups

**Before risky operations:**
```powershell
# Create backup before:
# - Major updates
# - Database migrations
# - Testing new features
# - Docker cleanup operations

.\backup_database.ps1
```

### Recommended Schedule

- **Daily**: If actively developing
- **Before updates**: Always before `git pull` or code changes
- **Before Docker cleanup**: Before `docker system prune` or volume operations
- **Weekly**: Minimum for production use

### Automated Backups (Windows Task Scheduler)

1. Open **Task Scheduler** (`taskschd.msc`)
2. Create Basic Task:
   - **Name**: Epistula Database Backup
   - **Trigger**: Daily at 2:00 AM
   - **Action**: Start a program
   - **Program**: `powershell.exe`
   - **Arguments**: `-File "D:\epistula\epistula\backup_database.ps1"`
   - **Start in**: `D:\epistula\epistula`

### Automated Backups (Linux cron)

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/epistula && ./backup_database.sh
```

## 🔍 Verify Data Integrity

### Check volume exists:
```powershell
docker volume ls | findstr epistula
```

### Check database size:
```powershell
docker exec epistula_db psql -U epistula_user -d epistula -c "\l+"
```

### Check table row counts:
```powershell
docker exec epistula_db psql -U epistula_user -d epistula -c "
SELECT 
    'universities' as table_name, COUNT(*) as rows FROM public.universities
UNION ALL
SELECT 'faculties', COUNT(*) FROM public.faculties
UNION ALL
SELECT 'users', COUNT(*) FROM public.users
UNION ALL
SELECT 'subjects', COUNT(*) FROM public.subjects;
"
```

### Export volume to archive:
```powershell
# Full volume backup (includes all PostgreSQL internals)
docker run --rm -v epistula_db_data:/data -v ${PWD}/backups:/backup alpine tar czf /backup/db_volume_full.tar.gz -C /data .
```

## 🚨 Data Loss Recovery

### If you accidentally deleted the volume:

1. **Stop immediately** - don't create new containers
2. Check if backup exists: `ls backups/database/`
3. Recreate containers: `docker compose up -d`
4. Restore latest backup: `.\restore_database.ps1 -BackupFile .\backups\database\[latest].sql.zip`

### If volume was orphaned (renamed):

```powershell
# List all volumes
docker volume ls

# Check anonymous volumes for PostgreSQL data
docker run --rm -v [VOLUME_ID]:/data alpine ls -la /data/pgdata

# If found, restore by:
# 1. Stop database: docker compose stop database
# 2. Create new volume: docker volume create epistula_db_data
# 3. Copy data: docker run --rm -v [OLD_VOLUME]:/source -v epistula_db_data:/dest alpine cp -a /source/. /dest/
# 4. Start database: docker compose start database
```

## 🎯 Production Recommendations

1. **Daily automated backups** to external location
2. **Weekly backup verification** (test restore to staging)
3. **Off-site backup** (cloud storage, external drive)
4. **Version control** backups (S3, Google Drive, etc.)
5. **Monitor volume size**: `docker system df -v`
6. **Document restore procedures** for your team

## 📝 Quick Reference

| Operation | Data Safe? | Backup Recommended? |
|-----------|------------|---------------------|
| `docker compose restart` | ✅ Yes | No |
| `docker compose down` | ✅ Yes | No |
| `docker compose up --build` | ✅ Yes | No |
| `docker compose down -v` | ❌ **NO - DELETES DATA!** | **REQUIRED** |
| `docker volume rm epistula_db_data` | ❌ **NO - DELETES DATA!** | **REQUIRED** |
| `docker system prune` | ✅ Yes (doesn't remove named volumes) | Recommended |
| `docker system prune -a --volumes` | ❌ **NO - DELETES VOLUMES!** | **REQUIRED** |
| Database migration | ⚠️ Risk | **REQUIRED** |
| Git pull / update | ⚠️ Risk | **REQUIRED** |

## 🛡️ Current Protection Status

Run this to check your setup:

```powershell
Write-Host "=== Epistula Data Protection Status ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Docker Volumes:" -ForegroundColor Yellow
docker volume ls | findstr epistula
Write-Host ""
Write-Host "Database Size:" -ForegroundColor Yellow
docker volume inspect epistula_db_data --format "Size: {{.Options}}"
Write-Host ""
Write-Host "Recent Backups:" -ForegroundColor Yellow
Get-ChildItem backups\database\*.zip -ErrorAction SilentlyContinue | Select-Object -First 5 | Format-Table Name, LastWriteTime, Length
Write-Host ""
Write-Host "Container Status:" -ForegroundColor Yellow
docker ps --filter "name=epistula" --format "table {{.Names}}\t{{.Status}}"
```

---

**Remember**: The best time to set up backups is BEFORE you lose data. Set up automated backups today!
