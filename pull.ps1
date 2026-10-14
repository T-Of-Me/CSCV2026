# Always run from the folder containing this script (the repo root)
Set-Location -Path $PSScriptRoot

$repo = "https://github.com/T-Of-Me/test.git"

# Make sure 'origin' points at the right repo (set it up if the folder is fresh)
$originUrl = (git remote get-url origin 2>$null)
if (-not $originUrl) {
    git remote add origin $repo *> $null
} elseif ($originUrl.Trim() -ne $repo) {
    git remote set-url origin $repo *> $null
}

$branch = (git rev-parse --abbrev-ref HEAD 2>$null).Trim()
if (-not $branch) { $branch = "main" }

git pull origin $branch *> $null

exit $LASTEXITCODE
