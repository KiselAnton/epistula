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
    Write-Info "Rebuilding and restarting backend and frontend containers (parallel build with BuildKit)..."
    Push-Location $RepoRoot
    try {
        $env:DOCKER_BUILDKIT = "1"
        docker compose build --parallel frontend backend
        docker compose up -d frontend backend
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
    $workers = $env:EPISTULA_TEST_WORKERS
    if ($workers -and $workers -ne "1") {
        Write-Info "Parallelizing backend tests with $workers workers"
        if ($workers -eq "auto") {
            python -m pytest -q --tb=short -n auto --dist=loadscope
        } else {
            python -m pytest -q --tb=short -n $workers --dist=loadscope
        }
    } else {
        python -m pytest -q --tb=short
    }
} catch {
    Pop-Location
    Write-Err "Tests failed."
    exit 1
}
Pop-Location

# Run Playwright E2E tests from frontend
Write-Info "Running Playwright E2E tests..."
Push-Location "$RepoRoot\epistula\frontend"
try {
    # Ensure Node deps installed (no-op if already installed)
    npm ci | Out-Null
} catch {
    try { npm install | Out-Null } catch {}
}

try {
    # Install Playwright browsers (chromium only for speed)
    npx playwright install chromium | Out-Null
} catch {}

try {
    $env:PORT = "3000"
    # Enable optional UI tests and provide root creds for global setup
    $env:EPISTULA_E2E_ENABLE_UI_TESTS = "1"
    if (-not $env:NEXT_PUBLIC_ROOT_EMAIL) { $env:NEXT_PUBLIC_ROOT_EMAIL = "root@localhost.localdomain" }
    if (-not $env:EPISTULA_ROOT_EMAIL) { $env:EPISTULA_ROOT_EMAIL = $env:NEXT_PUBLIC_ROOT_EMAIL }
    if (-not $env:EPISTULA_ROOT_PASSWORD) { $env:EPISTULA_ROOT_PASSWORD = "changeme123" }
    npm run -s test:e2e
} catch {
    Pop-Location
    Write-Err "Playwright tests failed."
    exit 1
}
Pop-Location

Write-Info "All good."
exit 0
