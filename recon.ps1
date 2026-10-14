param(
    [string]$Message = ""
)

# Always run from the folder containing this script (the repo root)
Set-Location -Path $PSScriptRoot

if (-not $Message) {
    $Message = "update " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
}

# Git does not track empty folders -> drop a .gitkeep into each empty one
Get-ChildItem -Directory -Recurse -Force |
    Where-Object { $_.FullName -notmatch '\\\.git(\\|$)' } |
    Where-Object { -not (Get-ChildItem -LiteralPath $_.FullName -Force) } |
    ForEach-Object {
        New-Item -ItemType File -Path (Join-Path $_.FullName ".gitkeep") | Out-Null
        Write-Host "Added .gitkeep to $($_.Name)"
    }

git add -A

# Commit only if something is staged
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    git commit -m $Message
    if ($LASTEXITCODE -ne 0) { Write-Host "Commit failed" -ForegroundColor Red; exit 1 }
} else {
    Write-Host "Nothing new to commit" -ForegroundColor Yellow
}

$branch = git rev-parse --abbrev-ref HEAD
git push -u origin $branch
if ($LASTEXITCODE -eq 0) {
    Write-Host "Pushed to origin/$branch" -ForegroundColor Green
} else {
    Write-Host "Push failed" -ForegroundColor Red
    exit 1
}
