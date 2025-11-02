param()

$ErrorActionPreference = 'Stop'

function Write-Info($msg) { Write-Host "[hooks] $msg" -ForegroundColor Cyan }

$RepoRoot = git rev-parse --show-toplevel
if (-not $RepoRoot) { throw "Not a git repository" }

Set-Location $RepoRoot
Write-Info "Setting core.hooksPath to .githooks"
git config core.hooksPath .githooks

# Ensure hooks are executable in *nix environments (no-op on Windows)
try {
  bash -lc "chmod +x .githooks/*" | Out-Null
} catch {}

Write-Info "Hooks installed."
