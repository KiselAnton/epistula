<#
.SYNOPSIS
  Cleans ephemeral build artifacts and temporary files from the repo.

.DESCRIPTION
  Removes the following by default:
    - work/ directory (build outputs)
    - any files matching check_*.sql anywhere
    - common checksum and intermediate files (md5sum.txt, boot.catalog)

  ISO cache:
    - isos/ is preserved by default to avoid re-downloading
    - pass -PurgeIso to also delete isos/

  Dry-run is enabled by default. Use -Force to actually delete.

.EXAMPLE
  # Dry run (what would be removed)
  ./scripts/clean_workspace.ps1

  # Perform deletion
  ./scripts/clean_workspace.ps1 -Force
#>
param(
  [switch]$Force,
  [switch]$Stash,
  [switch]$PurgeIso
)

$ErrorActionPreference = 'Stop'

function Write-Section($title) {
  Write-Host "`n=== $title ===" -ForegroundColor Cyan
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$targets = @()
$filesToStash = @()

# Directories to remove wholesale
$dirCandidates = @()
$dirCandidates += (Join-Path $repoRoot 'work')
if ($PurgeIso) {
  $dirCandidates += (Join-Path $repoRoot 'isos')
}

foreach ($d in $dirCandidates) {
  if (Test-Path $d) {
    $targets += @{ Path = $d; Type = 'Directory' }
  }
}

# Files that are safe to remove when present
$fileGlobs = @(
  'check_*.sql',
  'md5sum.txt',
  'boot.catalog'
)

foreach ($glob in $fileGlobs) {
  Get-ChildItem -Path $repoRoot -Recurse -File -Filter $glob -ErrorAction SilentlyContinue | ForEach-Object {
    $targets += @{ Path = $_.FullName; Type = 'File' }
    if ($Stash) { $filesToStash += $_.FullName }
  }
}

# Root-level *.js artifacts (keep only at repo root; do not recurse)
Get-ChildItem -Path $repoRoot -File -Filter '*.js' -ErrorAction SilentlyContinue | ForEach-Object {
  $targets += @{ Path = $_.FullName; Type = 'File' }
  if ($Stash) { $filesToStash += $_.FullName }
}

Write-Section "Cleanup Targets"
if ($targets.Count -eq 0) {
  Write-Host "Nothing to clean."
  return
}

$targets | ForEach-Object {
  Write-Host ("- {0}: {1}" -f $_.Type, $_.Path)
}

if (-not $Force -and -not $Stash) {
  Write-Host "`nDry run complete. Use -Force to delete these items." -ForegroundColor Yellow
  return
}

if ($Stash) {
  $stashDir = Join-Path $repoRoot 'temp'
  if (-not (Test-Path $stashDir)) { New-Item -ItemType Directory -Path $stashDir | Out-Null }
  Write-Section "Stashing files to $stashDir"
  foreach ($f in $filesToStash) {
    try {
      $dest = Join-Path $stashDir (Split-Path $f -Leaf)
      Move-Item -Path $f -Destination $dest -Force -ErrorAction Stop
      Write-Host ("Stashed: {0}" -f $dest) -ForegroundColor Green
      # Remove from deletion list to avoid double handling
      $targets = $targets | Where-Object { $_.Path -ne $f }
    } catch {
      Write-Host ("Failed to stash file: {0} -> {1}" -f $f, $_.Exception.Message) -ForegroundColor Red
    }
  }
}

if ($Force) {
  Write-Section "Deleting"
  foreach ($t in $targets) {
    try {
      if ($t.Type -eq 'Directory') {
        Remove-Item -Path $t.Path -Recurse -Force -ErrorAction Stop
      } else {
        Remove-Item -Path $t.Path -Force -ErrorAction Stop
      }
      Write-Host ("Removed {0}: {1}" -f $t.Type, $t.Path) -ForegroundColor Green
    } catch {
      Write-Host ("Failed to remove {0}: {1} -> {2}" -f $t.Type, $t.Path, $_.Exception.Message) -ForegroundColor Red
    }
  }
}

Write-Host "`nCleanup completed." -ForegroundColor Green
