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

function Get-JsonErrorBody {
  param(
    [Parameter(Mandatory = $true)]
    $ErrorRecord
  )

  $response = $ErrorRecord.Exception.Response
  if (-not $response) { return $null }
  try {
    $stream = $response.GetResponseStream()
    if (-not $stream) { return $null }
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
    $content = $reader.ReadToEnd()
    if (-not $content) { return $null }
    return $content | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Invoke-CurlJson {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Uri,
    [Parameter(Mandatory = $true)]
    [object]$Body
  )

  $tmp = [System.IO.Path]::GetTempFileName()
  try {
    [System.IO.File]::WriteAllText($tmp, ($Body | ConvertTo-Json -Depth 8 -Compress), [System.Text.UTF8Encoding]::new($false))
    $result = & curl.exe -sS -H "Content-Type: application/json" --data-binary "@$tmp" -w "`nHTTPSTATUS:%{http_code}" $Uri
    $statusLine = ($result | Select-Object -Last 1)
    $contentLines = @($result | Select-Object -SkipLast 1)
    $statusCode = [int](($statusLine -replace '^HTTPSTATUS:', ''))
    $bodyText = ($contentLines -join "`n")
    $bodyJson = $null
    if ($bodyText) {
      try { $bodyJson = $bodyText | ConvertFrom-Json } catch { }
    }
    return [pscustomobject]@{
      StatusCode = $statusCode
      BodyText = $bodyText
      Json = $bodyJson
    }
  } finally {
    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
  }
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

  $contentResponse = Invoke-WebRequest -Uri "$base/api/content" -TimeoutSec 10
  if ("$($contentResponse.Headers['Content-Type'])" -notmatch "charset=utf-8") {
    throw "API verify failed: /api/content is missing utf-8 charset"
  }
  $contentPayload = $contentResponse.Content | ConvertFrom-Json
  if (-not ($contentPayload.posts | Where-Object { $_.title -match '\p{IsCJKUnifiedIdeographs}' })) {
    throw "API verify failed: public content did not include expected UTF-8 Chinese text"
  }

  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $login = Invoke-Json -Uri "$base/api/login" -Method "POST" -Session $session -Body @{
    username = $AdminUsername
    password = $AdminPassword
  }
  if (-not $login.csrfToken) { throw "API verify failed: login did not return csrfToken" }
  $csrfHeaders = @{ "X-CSRF-Token" = $login.csrfToken }

  $adminContent = Invoke-Json -Uri "$base/api/admin/content" -Session $session
  $featuredItems = @($adminContent.posts + $adminContent.projects) | Where-Object { $_.featured -eq $true -and -not $_.deletedAt }
  if ($featuredItems.Count -ne 4) { throw "API verify failed: expected 4 featured items in seed data, got $($featuredItems.Count)" }
  $featuredOrders = $featuredItems | ForEach-Object { [int]$_.featuredOrder } | Sort-Object
  if ((@($featuredOrders) -join ",") -ne "0,1,2,3") {
    throw "API verify failed: expected featured slots 0,1,2,3 but got $((@($featuredOrders) -join ','))"
  }

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

  $featuredOrderBlocked = $false
  try {
    Invoke-Json -Uri "$base/api/posts" -Method "POST" -Session $session -Headers $csrfHeaders -Body @{
      id = "verify-api-featured-order"
      slug = "verify-api-featured-order"
      title = "Verify API Featured Order"
      category = "STM32"
      markdown = "# featured order"
      publishStatus = "published"
      featured = $true
      featuredOrder = 4
    } | Out-Null
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) { $featuredOrderBlocked = $true } else { throw }
  }
  if (-not $featuredOrderBlocked) { throw "API verify failed: carousel order outside 0-3 was not blocked" }

  $upload = Invoke-Json -Uri "$base/api/uploads" -Method "POST" -Session $session -Headers $csrfHeaders -Body @{
    filename = "verify-api.png"
    dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
  }
  if (-not $upload.url) { throw "API verify failed: upload did not return url" }
  $uploadAsset = Invoke-WebRequest -Uri "$base/$($upload.url.TrimStart('./'))" -TimeoutSec 10
  if ($uploadAsset.StatusCode -ne 200) { throw "API verify failed: uploaded image returned $($uploadAsset.StatusCode)" }
  if ("$($uploadAsset.Headers['Content-Type'])" -notmatch "image/") { throw "API verify failed: uploaded image content-type is $($uploadAsset.Headers['Content-Type'])" }

  $zhTitle = [string]::Concat([char]0x4E2D, [char]0x6587, [char]0x5BFC, [char]0x51FA, [char]0x9A8C, [char]0x8BC1)
  $zhParagraph = [string]::Concat([char]0x8FD9, [char]0x662F, [char]0x4E00, [char]0x6BB5, [char]0x4E2D, [char]0x6587, [char]0x5185, [char]0x5BB9, [char]0x3002)
  $md2docMarkdown = @"
# Heading

$zhParagraph
"@
  $md2doc = Invoke-WebRequest -Uri "$base/api/md2file/convert" -Method POST -ContentType "application/json" -Body (@{
    title = $zhTitle
    markdown = $md2docMarkdown
    filename = "utf8-check"
    options = @{ pageSize = "a4"; margin = "normal"; lineSpacing = "relaxed" }
  } | ConvertTo-Json -Depth 8) -TimeoutSec 20
  if ($md2doc.StatusCode -ne 200) { throw "API verify failed: md2file convert returned $($md2doc.StatusCode)" }
  if ("$($md2doc.Headers['Content-Type'])" -notmatch "wordprocessingml\.document") {
    throw "API verify failed: md2file content-type is $($md2doc.Headers['Content-Type'])"
  }
  if ("$($md2doc.Headers['Content-Disposition'])" -notmatch "utf8-check\.docx") {
    throw "API verify failed: md2file filename header is $($md2doc.Headers['Content-Disposition'])"
  }

  $emptyMarkdownBlocked = $false
  $emptyMarkdownResponse = Invoke-CurlJson -Uri "$base/api/md2file/convert" -Body @{ markdown = "" }
  $emptyMarkdownCode = if ($emptyMarkdownResponse.Json -and $emptyMarkdownResponse.Json.diagnostics -and $emptyMarkdownResponse.Json.diagnostics.Count -gt 0) { $emptyMarkdownResponse.Json.diagnostics[0].code } else { "" }
  if ($emptyMarkdownResponse.StatusCode -eq 400 -and (($emptyMarkdownCode -eq "MARKDOWN_REQUIRED") -or -not $emptyMarkdownCode)) {
    $emptyMarkdownBlocked = $true
  }
  if (-not $emptyMarkdownBlocked) { throw "API verify failed: empty markdown was not blocked" }

  $unsupportedFormatBlocked = $false
  $unsupportedFormatResponse = Invoke-CurlJson -Uri "$base/api/md2file/convert" -Body @{ markdown = "# ok"; format = "pdf" }
  $unsupportedFormatCode = if ($unsupportedFormatResponse.Json -and $unsupportedFormatResponse.Json.diagnostics -and $unsupportedFormatResponse.Json.diagnostics.Count -gt 0) { $unsupportedFormatResponse.Json.diagnostics[0].code } else { "" }
  if ($unsupportedFormatResponse.StatusCode -eq 400 -and (($unsupportedFormatCode -eq "FORMAT_UNSUPPORTED") -or -not $unsupportedFormatCode)) {
    $unsupportedFormatBlocked = $true
  }
  if (-not $unsupportedFormatBlocked) { throw "API verify failed: unsupported md2file format was not blocked" }

  $largeMarkdown = ("# T`n" + ("0123456789" * 53000))
  $largeMarkdownBlocked = $false
  $largeMarkdownResponse = Invoke-CurlJson -Uri "$base/api/md2file/convert" -Body @{ markdown = $largeMarkdown }
  $largeMarkdownCode = if ($largeMarkdownResponse.Json -and $largeMarkdownResponse.Json.diagnostics -and $largeMarkdownResponse.Json.diagnostics.Count -gt 0) { $largeMarkdownResponse.Json.diagnostics[0].code } else { "" }
  if ($largeMarkdownResponse.StatusCode -eq 413 -and (($largeMarkdownCode -eq "MARKDOWN_TOO_LARGE") -or -not $largeMarkdownCode)) {
    $largeMarkdownBlocked = $true
  }
  if (-not $largeMarkdownBlocked) { throw "API verify failed: oversized markdown was not blocked" }

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
    readTime = "1 minute"
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
    featuredSlots = (@($featuredOrders) -join ",")
    uploadUrl = $upload.url
    csrfBlocked = $csrfBlocked
    carouselOrderBlocked = $featuredOrderBlocked
    md2fileChecks = "success, empty blocked, format blocked, size blocked"
    utf8Checked = $true
    verified = "login, csrf, carousel slots, upload, md2file, post CRUD, project CRUD, export, sitemap, rss, logout"
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
