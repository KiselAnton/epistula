# Test Migration Script
# 
# This script helps migrate tests to the new organized structure
# Run from: epistula/frontend

Write-Host "=== Epistula Test Migration ===" -ForegroundColor Cyan
Write-Host ""

$dryRun = $true  # Set to $false to actually move files
$basePath = "d:\epistula\epistula\epistula\frontend"

# Define migration mappings
$migrations = @(
    # Component tests
    @{
        Source = "components\__tests__\*"
        Dest = "__tests__\unit\components"
        Pattern = "*.test.tsx"
    },
    @{
        Source = "components\common\__tests__\*"
        Dest = "__tests__\unit\components\common"
        Pattern = "*.test.tsx"
    },
    @{
        Source = "components\common\MarkdownEditor.test.tsx"
        Dest = "__tests__\unit\components\common\MarkdownEditor.test.tsx"
        Pattern = $null
    },
    
    # Hook tests
    @{
        Source = "__tests__\useLectures.test.tsx"
        Dest = "__tests__\unit\hooks\useLectures.test.tsx"
        Pattern = $null
    },
    
    # Component-specific tests
    @{
        Source = "__tests__\LectureNoteEditor.test.tsx"
        Dest = "__tests__\unit\components\LectureNoteEditor.test.tsx"
        Pattern = $null
    },
    @{
        Source = "__tests__\MyNotesPage.test.tsx"
        Dest = "__tests__\integration\pages\MyNotesPage.test.tsx"
        Pattern = $null
    },
    
    # Layout tests
    @{
        Source = "tests\components-layout\*"
        Dest = "__tests__\unit\components\layout"
        Pattern = "*.test.tsx"
    },
    
    # Utils tests
    @{
        Source = "utils\__tests__\*"
        Dest = "__tests__\unit\utils"
        Pattern = "*.test.ts"
    },
    
    # Page tests (integration)
    @{
        Source = "tests\pages\*"
        Dest = "__tests__\integration\pages"
        Pattern = "*.test.tsx"
    }
)

function Update-ImportPaths {
    param (
        [string]$FilePath,
        [string]$OldLocation,
        [string]$NewLocation
    )
    
    $content = Get-Content $FilePath -Raw
    $updated = $content
    
    # Calculate relative path difference
    $oldDepth = ($OldLocation -split '\\').Count
    $newDepth = ($NewLocation -split '\\').Count
    $depthDiff = $newDepth - $oldDepth
    
    # Update relative imports based on depth change
    if ($depthDiff -gt 0) {
        # Moved deeper, need more ../
        $additionalDots = "../" * $depthDiff
        $updated = $updated -replace '(import .* from [''"])(\.\./)', "`$1$additionalDots`$2"
    } elseif ($depthDiff -lt 0) {
        # Moved shallower, need fewer ../
        $removeDots = [Math]::Abs($depthDiff)
        for ($i = 0; $i -lt $removeDots; $i++) {
            $updated = $updated -replace '(import .* from [''"])\.\./', '$1'
        }
    }
    
    # Update jest.mock paths similarly
    $updated = $updated -replace "(jest\.mock\(['']\.\./)", "jest.mock('../$additionalDots"
    
    if ($updated -ne $content -and -not $dryRun) {
        Set-Content -Path $FilePath -Value $updated
        Write-Host "  Updated imports in: $FilePath" -ForegroundColor Green
    }
}

function Move-TestFile {
    param (
        [string]$Source,
        [string]$Dest
    )
    
    $sourcePath = Join-Path $basePath $Source
    $destPath = Join-Path $basePath $Dest
    
    if (-not (Test-Path $sourcePath)) {
        Write-Host "  Source not found: $sourcePath" -ForegroundColor Yellow
        return
    }
    
    $destDir = Split-Path $destPath -Parent
    if (-not (Test-Path $destDir)) {
        if ($dryRun) {
            Write-Host "  [DRY RUN] Would create: $destDir" -ForegroundColor Cyan
        } else {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            Write-Host "  Created directory: $destDir" -ForegroundColor Green
        }
    }
    
    if ($dryRun) {
        Write-Host "  [DRY RUN] Would move:" -ForegroundColor Cyan
        Write-Host "    From: $sourcePath" -ForegroundColor Gray
        Write-Host "    To:   $destPath" -ForegroundColor Gray
    } else {
        Move-Item -Path $sourcePath -Destination $destPath -Force
        Write-Host "  Moved: $(Split-Path $sourcePath -Leaf) -> $Dest" -ForegroundColor Green
        Update-ImportPaths -FilePath $destPath -OldLocation $Source -NewLocation $Dest
    }
}

# Execute migrations
Write-Host "Migration Plan:" -ForegroundColor Yellow
Write-Host "===============" -ForegroundColor Yellow
Write-Host ""

$totalFiles = 0

foreach ($migration in $migrations) {
    $source = $migration.Source
    $dest = $migration.Dest
    $pattern = $migration.Pattern
    
    Write-Host "Processing: $source" -ForegroundColor White
    
    if ($pattern) {
        # Pattern-based migration (multiple files)
        $sourcePath = Join-Path $basePath $source
        $files = Get-ChildItem -Path $sourcePath -Filter $pattern -ErrorAction SilentlyContinue
        
        foreach ($file in $files) {
            $destFile = Join-Path $dest $file.Name
            Move-TestFile -Source $file.FullName.Replace("$basePath\", "") -Dest $destFile
            $totalFiles++
        }
    } else {
        # Single file migration
        Move-TestFile -Source $source -Dest $dest
        $totalFiles++
    }
    
    Write-Host ""
}

Write-Host "===============" -ForegroundColor Yellow
Write-Host "Summary:" -ForegroundColor Yellow
if ($dryRun) {
    Write-Host "  Mode: DRY RUN (no files moved)" -ForegroundColor Cyan
    Write-Host "  Would migrate: $totalFiles files" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To execute migration, set `$dryRun = `$false in the script" -ForegroundColor Yellow
} else {
    Write-Host "  Migrated: $totalFiles files" -ForegroundColor Green
    Write-Host "  Structure: __tests__/unit/ and __tests__/integration/" -ForegroundColor Green
}
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review moved files and updated imports" -ForegroundColor Gray
Write-Host "  2. Run tests: npm test" -ForegroundColor Gray
Write-Host "  3. Refactor tests to use testUtils from __tests__/setup/" -ForegroundColor Gray
Write-Host "  4. Remove old empty directories" -ForegroundColor Gray
