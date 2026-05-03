$Root = Split-Path -Parent $PSScriptRoot
$BackupDir = Join-Path $Root "backups"
$Time = Get-Date -Format "yyyy-MM-dd_HH-mm"
$Target = Join-Path $BackupDir "gokottamaker_$Time"

New-Item -ItemType Directory -Force -Path $Target | Out-Null
Copy-Item -Path (Join-Path $Root "database") -Destination $Target -Recurse -Force
Copy-Item -Path (Join-Path $Root "uploads") -Destination $Target -Recurse -Force

Write-Output "Backup created: $Target"
