#!/bin/bash
# Database Backup Script for Epistula
# Creates timestamped SQL dumps to prevent data loss

BACKUP_DIR="./backups/database"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="epistula_backup_${TIMESTAMP}.sql"
TEMP_SQL_FILE="$BACKUP_DIR/$BACKUP_FILE"
FINAL_GZ_FILE="$BACKUP_DIR/$BACKUP_FILE.gz"

# Trap to ensure cleanup on exit
trap 'rm -f "$TEMP_SQL_FILE"' EXIT

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Creating database backup: $BACKUP_FILE"

# Create SQL dump
docker exec epistula_db pg_dump -U epistula_user -d epistula > "$TEMP_SQL_FILE"

if [ $? -eq 0 ]; then
    echo "Success: Backup created successfully"
    
    # Compress the backup
    gzip "$TEMP_SQL_FILE"
    echo "Success: Backup compressed: $FINAL_GZ_FILE"
    
    # Keep only last 10 backups
    ls -t "$BACKUP_DIR"/*.gz | tail -n +11 | xargs -r rm
    echo "Success: Old backups cleaned (keeping last 10)"
    
    echo ""
    echo "Backup complete!"
else
    echo "Error: Backup failed!"
    exit 1
fi
