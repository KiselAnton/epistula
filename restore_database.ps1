# Database Restore Script for Epistula (Windows PowerShell)
# Restores database from a backup file

param(
    [string]$BackupFile
)

if (-not $BackupFile) {
    Write-Host "Usage: .\restore_database.ps1 -BackupFile <backup_file.sql.zip>" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Available backups:" -ForegroundColor Cyan
    Get-ChildItem "backups\database\*.zip" 2>$null | Format-Table Name, LastWriteTime, Length -AutoSize
    if (-not (Test-Path "backups\database\*.zip")) {
        Write-Host "  No backups found" -ForegroundColor Gray
    }
    exit 1
}

if (-not (Test-Path $BackupFile)) {
    Write-Host "✗ Backup file not found: $BackupFile" -ForegroundColor Red
    exit 1
}

Write-Host "⚠️  WARNING: This will replace all current database data!" -ForegroundColor Yellow
Write-Host "Backup file: $BackupFile" -ForegroundColor Cyan
$confirm = Read-Host "Are you sure you want to restore? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "Restore cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host "Restoring database from: $BackupFile" -ForegroundColor Cyan

try {
    # Extract and restore
    $tempDir = Join-Path $env:TEMP "epistula_restore_$(Get-Date -Format 'yyyyMMddHHmmss')"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    Expand-Archive -Path $BackupFile -DestinationPath $tempDir -Force
    $extractedFile = Get-ChildItem "$tempDir\epistula_backup_*.sql" | Select-Object -First 1

    if ($extractedFile) {
        Get-Content $extractedFile.FullName | docker exec -i epistula_db psql -U epistula_user -d epistula
    
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Success: Database restored successfully!" -ForegroundColor Green
        } else {
            Write-Host "Error: Restore failed!" -ForegroundColor Red
            exit 1
        }
    } else {
    Write-Host "Error: Could not extract backup file!" -ForegroundColor Red
        exit 1
    }
}
finally {
    # Clean up temporary directory
    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "Cleaned up temporary files" -ForegroundColor Gray
    }
}
