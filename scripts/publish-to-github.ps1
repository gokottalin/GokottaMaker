param(
  [Parameter(Mandatory = $true)]
  [string]$RemoteUrl
)

$ErrorActionPreference = "Stop"

git status --short

$existingRemote = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0 -and $existingRemote) {
  git remote set-url origin $RemoteUrl
} else {
  git remote add origin $RemoteUrl
}

git branch -M main
git push -u origin main
