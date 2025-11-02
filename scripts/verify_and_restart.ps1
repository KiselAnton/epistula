Param(
    [switch]$SkipRestart
)

$ErrorActionPreference = 'Stop'

function Write-Info($msg) { Write-Host "[verify] $msg" -ForegroundColor Cyan }
function Write-Err($msg) { Write-Host "[verify] $msg" -ForegroundColor Red }

# Resolve repo root (this script lives in scripts/)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir

Write-Info "Repo root: $RepoRoot"

if (-not $SkipRestart) {
    # Rebuild and restart containers FIRST
    Write-Info "Rebuilding and restarting backend and frontend containers..."
    Push-Location $RepoRoot
    try {
        docker compose up -d --build frontend backend
        Write-Info "Containers restarted. Waiting for backend health..."
    } catch {
        Write-Err "Docker compose failed: $($_.Exception.Message)"
        exit 1
    } finally {
        Pop-Location
    }

    # Health check loop for backend
    $ok = $false
    for ($i=0; $i -lt 20; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri 'http://localhost:8000/health' -UseBasicParsing -TimeoutSec 3
            if ($resp.StatusCode -eq 200) { $ok = $true; break }
        } catch {}
        Start-Sleep -Seconds 1
    }
    if (-not $ok) {
        Write-Err "Backend health check failed."
        exit 1
    }

    # Health check frontend
    Write-Info "Checking frontend health..."
    $frontendOk = $false
    for ($i=0; $i -lt 20; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri 'http://localhost:3000/' -UseBasicParsing -TimeoutSec 3
            if ($resp.StatusCode -eq 200) { $frontendOk = $true; break }
        } catch {}
        Start-Sleep -Seconds 1
    }
    if (-not $frontendOk) {
        Write-Err "Frontend health check failed."
        exit 1
    }
}

# Run tests AFTER restart
Write-Info "Running backend tests..."
Push-Location "$RepoRoot\epistula\backend"
try {
    python -m pytest -q --tb=short
} catch {
    Pop-Location
    Write-Err "Tests failed."
    exit 1
}
Pop-Location

Write-Info "All good."
exit 0
