[CmdletBinding()]
param(
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$runRoot = Join-Path $tempBase ("larkix-clean-clone-{0}-{1}" -f $PID, [Guid]::NewGuid().ToString("N"))
$dataDir = Join-Path $runRoot "data"
$stdoutPath = Join-Path $runRoot "server.stdout.log"
$stderrPath = Join-Path $runRoot "server.stderr.log"
$serverProcess = $null
$savedEnvironment = @{}

function New-UrlSafeToken([int]$ByteCount) {
  $bytes = New-Object byte[] $ByteCount
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Get-FreeLoopbackPort {
  $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 0)
  try {
    $listener.Start()
    return ([Net.IPEndPoint]$listener.LocalEndpoint).Port
  } finally {
    $listener.Stop()
  }
}

function Invoke-Checked([string]$FilePath, [string[]]$Arguments) {
  Write-Host ("> {0} {1}" -f (Split-Path $FilePath -Leaf), ($Arguments -join " "))
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $FilePath"
  }
}

function Set-IsolatedEnvironment([int]$Port) {
  $values = [ordered]@{
    NODE_ENV = "test"
    HOST = "127.0.0.1"
    PORT = [string]$Port
    DATA_DIR = $dataDir
    DB_DIR = $null
    DB_PATH = $null
    UPLOAD_DIR = (Join-Path $dataDir "uploads")
    BACKUP_ROOT = (Join-Path $dataDir "backups")
    FORMULA_BACKUP_DIR = (Join-Path $dataDir "formula-backups")
    ELEC_TMP_DIR = (Join-Path $dataDir "tmp\gokotta-elec")
    ADMIN_USERNAME = "CleanCloneVerifier"
    ADMIN_PASSWORD = (New-UrlSafeToken 32)
    ADMIN_RESET_PASSWORD_ON_START = "false"
    PRIVATE_CMS_PATH = (New-UrlSafeToken 48)
    ALLOW_INSECURE_PRIVATE_CMS_LOOPBACK = "true"
    ALLOW_LEGACY_CMS_LOOPBACK = "false"
    ALLOW_HARD_DELETE = "false"
    MAX_BACKUP_AGE_HOURS = "26"
    OFFSITE_BACKUP_TARGET = ""
    SITE_URL = "http://127.0.0.1:$Port"
  }

  foreach ($entry in $values.GetEnumerator()) {
    $savedEnvironment[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key, "Process")
    [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, "Process")
  }
}

function Restore-Environment {
  foreach ($name in $savedEnvironment.Keys) {
    [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], "Process")
  }
}

function Set-RegressionEnvironment {
  # Product tests create their own credentials and DATA_DIR. Do not let the
  # bootstrap service's private gateway hide their explicit loopback fixtures.
  foreach ($name in @(
    "HOST", "PORT", "DATA_DIR", "DB_DIR", "DB_PATH", "UPLOAD_DIR",
    "BACKUP_ROOT", "FORMULA_BACKUP_DIR", "ELEC_TMP_DIR", "ADMIN_USERNAME",
    "ADMIN_PASSWORD", "ADMIN_RESET_PASSWORD_ON_START", "PRIVATE_CMS_PATH",
    "ALLOW_INSECURE_PRIVATE_CMS_LOOPBACK", "ALLOW_LEGACY_CMS_LOOPBACK",
    "ALLOW_HARD_DELETE", "OFFSITE_BACKUP_TARGET", "SITE_URL"
  )) {
    [Environment]::SetEnvironmentVariable($name, $null, "Process")
  }
  [Environment]::SetEnvironmentVariable("NODE_ENV", "test", "Process")
}

function Stop-TestServer {
  if ($null -ne $script:serverProcess -and -not $script:serverProcess.HasExited) {
    Stop-Process -Id $script:serverProcess.Id -Force -ErrorAction SilentlyContinue
    $script:serverProcess.WaitForExit(5000) | Out-Null
  }
}

try {
  Write-Host "=== LarkixMaker clean-clone verification ==="
  $nodePath = (Get-Command node -ErrorAction Stop).Source
  $npmPath = (Get-Command npm.cmd -ErrorAction Stop).Source
  $gitPath = (Get-Command git -ErrorAction Stop).Source

  $nodeVersionText = (& $nodePath -p "process.versions.node").Trim()
  $nodeVersion = [Version]$nodeVersionText
  if ($nodeVersion -lt [Version]"22.5.0") {
    throw "Node.js >=22.5.0 is required; found $nodeVersionText"
  }
  Write-Host "Node.js $nodeVersionText"
  Invoke-Checked $gitPath @("rev-parse", "--is-inside-work-tree")

  foreach ($requiredPath in @("package.json", "package-lock.json", "server.js", "AGENTS.md")) {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $requiredPath) -PathType Leaf)) {
      throw "Required checkout file is missing: $requiredPath"
    }
  }

  Push-Location $repoRoot
  try {
    if (-not $SkipInstall) {
      Invoke-Checked $npmPath @("ci", "--ignore-scripts")
    } elseif (-not (Test-Path -LiteralPath (Join-Path $repoRoot "node_modules"))) {
      throw "-SkipInstall requires an existing node_modules directory"
    }

    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
    $port = Get-FreeLoopbackPort
    Set-IsolatedEnvironment $port

    $serverProcess = Start-Process -FilePath $nodePath `
      -ArgumentList @("--experimental-sqlite", (Join-Path $repoRoot "server.js")) `
      -WorkingDirectory $repoRoot `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath `
      -WindowStyle Hidden `
      -PassThru

    $healthUri = "http://127.0.0.1:$port/healthz"
    $health = $null
    for ($attempt = 1; $attempt -le 40; $attempt++) {
      if ($serverProcess.HasExited) {
        throw "The test service exited before becoming healthy (exit $($serverProcess.ExitCode))"
      }
      try {
        $health = Invoke-RestMethod -Uri $healthUri -TimeoutSec 2
        if ($health.ok -eq $true) { break }
      } catch {
        Start-Sleep -Milliseconds 250
      }
    }
    if ($null -eq $health -or $health.ok -ne $true) {
      throw "Timed out waiting for $healthUri"
    }
    if (-not (Test-Path -LiteralPath (Join-Path $dataDir "database\gokottamaker.sqlite") -PathType Leaf)) {
      throw "The isolated SQLite database was not initialized under DATA_DIR"
    }
    Write-Host "PASS health and isolated empty-data initialization on loopback port $port"

    Stop-TestServer
    $serverProcess = $null
    Set-RegressionEnvironment

    Invoke-Checked $npmPath @("run", "check:version")
    Invoke-Checked $npmPath @("run", "test:markdown")
    Invoke-Checked $npmPath @("run", "test:security-formula-regression")
    Invoke-Checked $npmPath @("run", "codex:contract")
  } finally {
    Pop-Location
  }

  Write-Host "PASS clean-clone install, startup, health, core tests, governance, stop, and isolation"
} catch {
  if (Test-Path -LiteralPath $stderrPath) {
    Write-Host "Server stderr tail (generated credentials are never logged by this script):"
    Get-Content -LiteralPath $stderrPath -Tail 20 -ErrorAction SilentlyContinue
  }
  throw
} finally {
  Stop-TestServer
  Restore-Environment
  if (Test-Path -LiteralPath $runRoot) {
    $resolvedRunRoot = [IO.Path]::GetFullPath($runRoot)
    if ($resolvedRunRoot.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -and
        (Split-Path $resolvedRunRoot -Leaf).StartsWith("larkix-clean-clone-")) {
      Remove-Item -LiteralPath $resolvedRunRoot -Recurse -Force -ErrorAction SilentlyContinue
    } else {
      Write-Warning "Refusing to remove unexpected path: $resolvedRunRoot"
    }
  }
}
