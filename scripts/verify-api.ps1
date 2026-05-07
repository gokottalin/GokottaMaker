param(
  [int]$Port = 5497,
  [string]$AdminUsername = "Gokotta",
  [string]$AdminPassword = "change-this-before-public-deploy",
  [switch]$UseCurrentData
)

$ErrorActionPreference = "Stop"

function Invoke-Json {
  param(
    [string]$Uri,
    [string]$Method = "GET",
    [object]$Body = $null,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session = $null,
    [hashtable]$Headers = @{}
  )

  $options = @{
    Uri = $Uri
    Method = $Method
    Headers = $Headers
    TimeoutSec = 10
  }
  if ($Session) { $options.WebSession = $Session }
  if ($null -ne $Body) {
    $options.ContentType = "application/json"
    $options.Body = ($Body | ConvertTo-Json -Depth 8)
  }
  return Invoke-RestMethod @options
}

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$base = "http://127.0.0.1:$Port"
$testData = Join-Path $root ".verify-api-data"
$serverProcess = $null
$previousEnv = @{
  PORT = $env:PORT
  DATA_DIR = $env:DATA_DIR
  ADMIN_USERNAME = $env:ADMIN_USERNAME
  ADMIN_PASSWORD = $env:ADMIN_PASSWORD
}

try {
  if (-not $UseCurrentData) {
    if (Test-Path -LiteralPath $testData) { Remove-Item -LiteralPath $testData -Recurse -Force }
    $env:DATA_DIR = $testData
  }
  $env:PORT = [string]$Port
  $env:ADMIN_USERNAME = $AdminUsername
  $env:ADMIN_PASSWORD = $AdminPassword

  $serverProcess = Start-Process -FilePath "node" -ArgumentList @("--experimental-sqlite", "server.js") -WorkingDirectory $root -PassThru -WindowStyle Hidden

  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    try {
      $health = Invoke-Json -Uri "$base/healthz"
      $ready = $true
      break
    } catch {
      Start-Sleep -Milliseconds 300
    }
  }
  if (-not $ready) { throw "API verify failed: server did not become ready on $base" }

  $publicContent = Invoke-Json -Uri "$base/api/content"
  if ($publicContent.posts.Count -lt 1) { throw "API verify failed: public posts are empty" }

  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $login = Invoke-Json -Uri "$base/api/login" -Method "POST" -Session $session -Body @{
    username = $AdminUsername
    password = $AdminPassword
  }
  if (-not $login.csrfToken) { throw "API verify failed: login did not return csrfToken" }
  $csrfHeaders = @{ "X-CSRF-Token" = $login.csrfToken }

  $csrfBlocked = $false
  try {
    Invoke-Json -Uri "$base/api/posts" -Method "POST" -Session $session -Body @{
      id = "verify-api-no-csrf"
      slug = "verify-api-no-csrf"
      title = "Verify API No CSRF"
      category = "STM32"
      markdown = "# blocked"
    } | Out-Null
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 403) { $csrfBlocked = $true } else { throw }
  }
  if (-not $csrfBlocked) { throw "API verify failed: write without CSRF was not blocked" }

  $upload = Invoke-Json -Uri "$base/api/uploads" -Method "POST" -Session $session -Headers $csrfHeaders -Body @{
    filename = "verify-api.png"
    dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
  }
  if (-not $upload.url) { throw "API verify failed: upload did not return url" }

  $postId = "verify-api-post"
  $postResult = Invoke-Json -Uri "$base/api/posts" -Method "POST" -Session $session -Headers $csrfHeaders -Body @{
    id = $postId
    slug = $postId
    title = "Verify API Post"
    category = "STM32"
    excerpt = "Regression test post"
    cover = $upload.url
    markdown = "# Verify API Post"
    publishStatus = "published"
    featured = $false
    featuredOrder = 0
    tags = "verify, api"
    readTime = "1 分钟阅读"
  }
  if (-not ($postResult.posts | Where-Object { $_.id -eq $postId })) { throw "API verify failed: post save not visible in admin list" }

  $projectId = "verify-api-project"
  $projectResult = Invoke-Json -Uri "$base/api/projects" -Method "POST" -Session $session -Headers $csrfHeaders -Body @{
    id = $projectId
    slug = $projectId
    title = "Verify API Project"
    statusKey = "development"
    summary = "Regression test project"
    cover = $upload.url
    markdown = "# Verify API Project"
    visibilityStatus = "published"
    featured = $false
    featuredOrder = 0
    tags = "verify, project"
    progress = 50
  }
  if (-not ($projectResult.projects | Where-Object { $_.id -eq $projectId })) { throw "API verify failed: project save not visible in admin list" }

  $deletedPost = Invoke-Json -Uri "$base/api/posts/$postId" -Method "DELETE" -Session $session -Headers $csrfHeaders
  if (-not (($deletedPost.posts | Where-Object { $_.id -eq $postId }).deletedAt)) { throw "API verify failed: post soft delete did not set deletedAt" }

  $restoredPost = Invoke-Json -Uri "$base/api/posts/$postId/restore" -Method "POST" -Session $session -Headers $csrfHeaders -Body @{}
  if (($restoredPost.posts | Where-Object { $_.id -eq $postId }).deletedAt) { throw "API verify failed: post restore still has deletedAt" }

  $deletedProject = Invoke-Json -Uri "$base/api/projects/$projectId" -Method "DELETE" -Session $session -Headers $csrfHeaders
  if (-not (($deletedProject.projects | Where-Object { $_.id -eq $projectId }).deletedAt)) { throw "API verify failed: project soft delete did not set deletedAt" }

  $restoredProject = Invoke-Json -Uri "$base/api/projects/$projectId/restore" -Method "POST" -Session $session -Headers $csrfHeaders -Body @{}
  if (($restoredProject.projects | Where-Object { $_.id -eq $projectId }).deletedAt) { throw "API verify failed: project restore still has deletedAt" }

  $export = Invoke-Json -Uri "$base/api/admin/export" -Session $session
  if (-not $export.site.versionLabel) { throw "API verify failed: export missing versionLabel" }

  $sitemap = Invoke-WebRequest -Uri "$base/sitemap.xml" -TimeoutSec 10
  if ($sitemap.StatusCode -ne 200) { throw "API verify failed: sitemap.xml returned $($sitemap.StatusCode)" }
  $rss = Invoke-WebRequest -Uri "$base/rss.xml" -TimeoutSec 10
  if ($rss.StatusCode -ne 200) { throw "API verify failed: rss.xml returned $($rss.StatusCode)" }

  Invoke-Json -Uri "$base/api/logout" -Method "POST" -Session $session -Headers $csrfHeaders -Body @{} | Out-Null

  [pscustomobject]@{
    ok = $true
    baseUrl = $base
    versionLabel = $health.versionLabel
    publicPosts = $publicContent.posts.Count
    publicProjects = $publicContent.projects.Count
    uploadUrl = $upload.url
    csrfBlocked = $csrfBlocked
    verified = "login, csrf, upload, post CRUD, project CRUD, export, sitemap, rss, logout"
  } | Format-List
} finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
  }
  $env:PORT = $previousEnv.PORT
  $env:DATA_DIR = $previousEnv.DATA_DIR
  $env:ADMIN_USERNAME = $previousEnv.ADMIN_USERNAME
  $env:ADMIN_PASSWORD = $previousEnv.ADMIN_PASSWORD
  if (-not $UseCurrentData -and (Test-Path -LiteralPath $testData)) {
    Remove-Item -LiteralPath $testData -Recurse -Force
  }
}
