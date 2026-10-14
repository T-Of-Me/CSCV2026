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
        New-Item -ItemType File -Path (Join-Path $_.FullName ".gitkeep") -Force | Out-Null
    }

git add -A *> $null

git diff --cached --quiet *> $null
if ($LASTEXITCODE -ne 0) {
    git commit -m $Message *> $null
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()

# Pull remote work first so push won't be rejected as non-fast-forward
git pull --no-rebase origin $branch *> $null

git push -u origin $branch *> $null

exit $LASTEXITCODE
