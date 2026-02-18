# Sync main branch to phone branch and push both.
# Run this after making updates to main to keep the phone build up to date.
# Usage: .\scripts\sync-phone-branch.ps1

$ErrorActionPreference = "Stop"
$repoRoot = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $repoRoot

Write-Host "Syncing main -> phone branch..." -ForegroundColor Cyan

# Ensure we're on main and up to date
git checkout main
git pull origin main

# Merge main into phone
git checkout phone
git merge main -m "Sync: merge main into phone"

# Push both branches
git push origin phone
git checkout main
git push origin main

Write-Host "Done. main and phone are now in sync." -ForegroundColor Green
