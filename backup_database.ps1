# Database Backup Script for Epistula (Windows PowerShell)
# Creates timestamped SQL dumps to prevent data loss

$BACKUP_DIR = ".\backups\database"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_FILE = "epistula_backup_$TIMESTAMP.sql"
$TEMP_SQL_FILE = "$BACKUP_DIR\$BACKUP_FILE"
$FINAL_ZIP_FILE = "$BACKUP_DIR\$BACKUP_FILE.zip"

# Create backup directory if it doesn't exist
New-Item -ItemType Directory -Force -Path $BACKUP_DIR | Out-Null

Write-Host "Creating database backup: $BACKUP_FILE" -ForegroundColor Cyan

try {
    # Create SQL dump
    docker exec epistula_db pg_dump -U epistula_user -d epistula | Out-File -FilePath $TEMP_SQL_FILE -Encoding UTF8

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Success: Backup created successfully" -ForegroundColor Green
    
        # Compress the backup
        Compress-Archive -Path $TEMP_SQL_FILE -DestinationPath $FINAL_ZIP_FILE -Force
        Write-Host "Success: Backup compressed: $FINAL_ZIP_FILE" -ForegroundColor Green
    
        # Keep only last 10 backups
        Get-ChildItem "$BACKUP_DIR\*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 10 | Remove-Item -ErrorAction SilentlyContinue
        Write-Host "Success: Old backups cleaned (keeping last 10)" -ForegroundColor Green
    
        Write-Host "`nBackup complete!" -ForegroundColor Green
    } else {
        Write-Host "Error: Backup failed!" -ForegroundColor Red
        exit 1
    }
}
finally {
    # Always clean up temporary SQL file
    if (Test-Path $TEMP_SQL_FILE) {
        Remove-Item $TEMP_SQL_FILE -ErrorAction SilentlyContinue
        Write-Host "Cleaned up temporary file" -ForegroundColor Gray
    }
}
