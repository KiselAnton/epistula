Param(
  [Parameter(Mandatory=$true)][string]$Message,
  [switch]$Push
)

$ErrorActionPreference = 'Stop'

function Write-Info($msg) { Write-Host "[commit] $msg" -ForegroundColor Cyan }
function Write-Err($msg) { Write-Host "[commit] $msg" -ForegroundColor Red }

$RepoRoot = git rev-parse --show-toplevel
if (-not $RepoRoot) { Write-Err "Not a git repository"; exit 1 }

Write-Info "Repo root: $RepoRoot"

# Clean workspace (preserves ISOs)
if (Test-Path "$RepoRoot/scripts/clean_workspace.ps1") {
  Write-Info "Cleaning workspace via PowerShell script..."
  & "$RepoRoot/scripts/clean_workspace.ps1" -Stash | Out-Null
}

# Rebuild/restart and health check
Write-Info "Rebuilding and restarting containers..."
Push-Location $RepoRoot
try {
  docker compose up -d --build frontend backend | Out-Null
} catch {
  Pop-Location
  Write-Err "Docker compose failed. Aborting commit."
  exit 1
}
Pop-Location

Write-Info "Waiting for backend health..."
$ok = $false
for ($i=0; $i -lt 20; $i++) {
  try {
    $resp = Invoke-WebRequest -Uri 'http://localhost:8000/health' -UseBasicParsing -TimeoutSec 3
    if ($resp.StatusCode -eq 200) { $ok = $true; break }
  } catch {}
  Start-Sleep -Seconds 1
}
if (-not $ok) {
  Write-Err "Backend health check failed. Aborting commit."
  exit 1
}

Write-Info "Waiting for frontend health..."
$frontendOk = $false
for ($i=0; $i -lt 20; $i++) {
  try {
    $resp = Invoke-WebRequest -Uri 'http://localhost:3000/' -UseBasicParsing -TimeoutSec 3
    if ($resp.StatusCode -eq 200) { $frontendOk = $true; break }
  } catch {}
  Start-Sleep -Seconds 1
}
if (-not $frontendOk) {
  Write-Err "Frontend health check failed. Aborting commit."
  exit 1
}

Write-Info "Running backend tests..."
Push-Location "$RepoRoot\epistula\backend"
try {
  python -m pytest -q --tb=short
} catch {
  Pop-Location
  Write-Err "Tests failed. Aborting commit."
  exit 1
}
Pop-Location

Write-Info "Staging changes..."
git add -A

Write-Info "Committing with message: $Message"
git commit -m "$Message"

if ($Push) {
  Write-Info "Pushing branch..."
  git push
}

Write-Info "Done."
exit 0
