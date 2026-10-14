param(
    [string]$Message = ""
)

# Always run from the folder containing this script (the repo root)
Set-Location -Path $PSScriptRoot

if (-not $Message) {
    $Message = "update " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
}

function Run-Step {
    param([string]$Label, [scriptblock]$Cmd)
    Write-Host ("[+] " + $Label) -ForegroundColor Cyan
    & $Cmd *> $null
    return $LASTEXITCODE
}

$start = Get-Date
Write-Host "Starting git-push at $($start.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor White
Write-Host ""

# Git does not track empty folders -> drop a .gitkeep into each empty one
Get-ChildItem -Directory -Recurse -Force |
    Where-Object { $_.FullName -notmatch '\\\.git(\\|$)' } |
    Where-Object { -not (Get-ChildItem -LiteralPath $_.FullName -Force) } |
    ForEach-Object {
        New-Item -ItemType File -Path (Join-Path $_.FullName ".gitkeep") -Force | Out-Null
    }

Run-Step "git add -A" { git add -A } | Out-Null

# Commit only if something is staged
git diff --cached --quiet *> $null
if ($LASTEXITCODE -ne 0) {
    $rc = Run-Step "git commit -m `"$Message`"" { git commit -m $Message }
    if ($rc -ne 0) { Write-Host "[-] commit failed" -ForegroundColor Red; exit 1 }
} else {
    Write-Host "[*] nothing new to commit" -ForegroundColor Yellow
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$rc = Run-Step "git push -u origin $branch" { git push -u origin $branch }

$elapsed = [math]::Round(((Get-Date) - $start).TotalSeconds, 2)
Write-Host ""
if ($rc -eq 0) {
    Write-Host "git-push done: pushed to origin/$branch in $elapsed seconds" -ForegroundColor Green
} else {
    Write-Host "git-push failed after $elapsed seconds" -ForegroundColor Red
    exit 1
}
