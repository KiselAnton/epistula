#!/bin/bash
# Database Restore Script for Epistula
# Restores database from a backup file

if [ -z "$1" ]; then
    echo "Usage: ./restore_database.sh <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lh backups/database/*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "✗ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  WARNING: This will replace all current database data!"
echo "Backup file: $BACKUP_FILE"
read -p "Are you sure you want to restore? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo "Restoring database from: $BACKUP_FILE"

# Create temporary directory for extraction
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

# Decompress and restore
gunzip -c "$BACKUP_FILE" > "$TEMP_DIR/restore.sql"
docker exec -i epistula_db psql -U epistula_user -d epistula < "$TEMP_DIR/restore.sql"

if [ $? -eq 0 ]; then
    echo "Success: Database restored successfully!"
else
    echo "Error: Restore failed!"
    exit 1
fi
