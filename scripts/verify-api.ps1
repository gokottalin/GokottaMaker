param(
  [int]$Port = 5497,
  [string]$AdminUsername = "Larkix",
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

  $requestFile = [System.IO.Path]::GetTempFileName()
  $responseFile = [System.IO.Path]::GetTempFileName()
  try {
    [System.IO.File]::WriteAllText($requestFile, ($Body | ConvertTo-Json -Depth 8 -Compress), [System.Text.UTF8Encoding]::new($false))
    $statusOutput = & curl.exe -sS -H "Content-Type: application/json" --data-binary "@$requestFile" --output $responseFile --write-out "%{http_code}" $Uri
    $curlExitCode = $LASTEXITCODE
    if ($curlExitCode -ne 0) {
      throw "curl request failed with exit code $curlExitCode"
    }
    $statusText = (($statusOutput | ForEach-Object { [string]$_ }) -join "").Trim()
    $statusCode = 0
    if (-not [int]::TryParse($statusText, [ref]$statusCode)) {
      throw "curl returned an invalid HTTP status: $statusText"
    }
    $bodyText = [System.IO.File]::ReadAllText($responseFile, [System.Text.UTF8Encoding]::new($false, $true))
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
    foreach ($tmp in @($requestFile, $responseFile)) {
      if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
    }
  }
}

function Assert-JsonStatus {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Uri,
    [string]$Method = "GET",
    [object]$Body = $null,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session = $null,
    [hashtable]$Headers = @{},
    [Parameter(Mandatory = $true)]
    [int]$ExpectedStatus,
    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  try {
    Invoke-Json -Uri $Uri -Method $Method -Body $Body -Session $Session -Headers $Headers | Out-Null
    throw "$Label expected HTTP $ExpectedStatus but request succeeded"
  } catch {
    $response = $_.Exception.Response
    if (-not $response) { throw }
    $actual = [int]$response.StatusCode.value__
    if ($actual -ne $ExpectedStatus) {
      throw "$Label expected HTTP $ExpectedStatus but got $actual"
    }
  }
}

function Remove-IsolatedDataDir {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PathToRemove,
    [Parameter(Mandatory = $true)]
    [string]$RootPath
  )

  if (-not (Test-Path -LiteralPath $PathToRemove)) { return }
  $fullPath = [System.IO.Path]::GetFullPath($PathToRemove)
  $fullRoot = [System.IO.Path]::GetFullPath($RootPath)
  $fullRoot = $fullRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  $requiredPrefix = $fullRoot + [System.IO.Path]::DirectorySeparatorChar
  if (-not $fullPath.StartsWith($requiredPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove non-isolated DATA_DIR path: $fullPath"
  }

  for ($attempt = 1; $attempt -le 8; $attempt++) {
    try {
      Remove-Item -LiteralPath $fullPath -Recurse -Force
      return
    } catch {
      if ($attempt -eq 8) { throw }
      Start-Sleep -Milliseconds (250 * $attempt)
    }
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
    Remove-IsolatedDataDir -PathToRemove $testData -RootPath $root
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
  if (-not $health.gitCommit -or $health.gitCommit -eq "unknown") {
    throw "API verify failed: health endpoint did not resolve gitCommit"
  }

  $publicContent = Invoke-Json -Uri "$base/api/content"
  if ($publicContent.posts.Count -lt 1) { throw "API verify failed: public posts are empty" }
  if ($null -eq $publicContent.publicFocusMode) { throw "API verify failed: public content missing publicFocusMode" }
  if ($publicContent.publicFocusMode.enabled -ne $true) { throw "API verify failed: public focus mode must be enabled by default" }
  if ($publicContent.publicFocusMode.ownerConfigured -ne $false) { throw "API verify failed: fresh focus mode must not be marked owner-configured" }
  if ((@($publicContent.publicFocusMode.visibleScopes) -join ",") -ne "electronics-basics,derivations,projects") {
    throw "API verify failed: public focus mode scopes are not canonical"
  }

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
  if ($null -eq $adminContent.knowledgeNodes) { throw "API verify failed: admin content missing knowledgeNodes" }
  if ($null -eq $adminContent.publicFocusMode) { throw "API verify failed: admin content missing publicFocusMode" }
  if ($adminContent.publicFocusMode.enabled -ne $publicContent.publicFocusMode.enabled) {
    throw "API verify failed: public/admin focus mode values differ"
  }

  $focusDisabled = Invoke-Json -Uri "$base/api/admin/focus-mode" -Method "POST" -Session $session -Headers $csrfHeaders -Body @{
    enabled = $false
  }
  if ($focusDisabled.publicFocusMode.enabled -ne $false -or $focusDisabled.publicFocusMode.ownerConfigured -ne $true) {
    throw "API verify failed: owner focus-mode disable did not persist canonical state"
  }
  if ($focusDisabled.reasonCode -ne "FOCUS_MODE_DISABLED_BY_OWNER") {
    throw "API verify failed: focus-mode disable missing stable reason code"
  }
  $session.Headers.Remove("X-CSRF-Token") | Out-Null
  $publicContentAfterFocusDisable = Invoke-Json -Uri "$base/api/content"
  if ($publicContentAfterFocusDisable.publicFocusMode.enabled -ne $false) {
    throw "API verify failed: public focus-mode state did not update after owner disable"
  }

  $adminContent = Invoke-Json -Uri "$base/api/admin/content" -Session $session
  if ($null -eq $adminContent.carousel) { throw "API verify failed: admin content missing carousel buffer state" }
  $featuredItems = @(@($adminContent.posts + $adminContent.projects) | Where-Object { $_.featured -eq $true -and -not $_.deletedAt })
  $bufferedItems = @($adminContent.carousel.buffered)
  if ($featuredItems.Count -ne 1) {
    throw "API verify failed: focus disable must not auto-restore seed carousel items; expected 1 active, got $($featuredItems.Count)"
  }
  if ($bufferedItems.Count -ne 3) {
    throw "API verify failed: expected 3 persistent seed carousel buffer items, got $($bufferedItems.Count)"
  }
  if (@($bufferedItems | Where-Object { $_.bufferedReason -ne "CAROUSEL_FOCUS_SCOPE_OUTSIDE" }).Count -ne 0) {
    throw "API verify failed: seed carousel buffer reason codes are not stable"
  }
  $carouselBufferView = Invoke-Json -Uri "$base/api/admin/carousel-buffer" -Session $session
  if ($carouselBufferView.carousel.summary.activeCount -ne 1 -or $carouselBufferView.carousel.summary.bufferedCount -ne 3) {
    throw "API verify failed: carousel buffer list API did not preserve active=1/buffered=3 after focus disable"
  }
  $featuredOrders = $featuredItems | ForEach-Object { [int]$_.featuredOrder } | Sort-Object
  if ((@($featuredOrders) -join ",") -ne "3") {
    throw "API verify failed: expected only preserved eligible featured slot 3 but got $((@($featuredOrders) -join ','))"
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

  Assert-JsonStatus -Uri "$base/api/admin/knowledge-nodes" -Method "POST" -Session $session -Headers $csrfHeaders -ExpectedStatus 400 -Label "knowledge invalid slug" -Body @{
    id = "verify-api-invalid-slug"
    slug = "Invalid Slug"
    nodeType = "derivation"
    symbol = "D.bad"
    title = "Invalid Slug"
    summary = "Invalid slug test"
    markdown = "# Invalid"
    publishStatus = "draft"
    visibilityStatus = "public"
  }
  Assert-JsonStatus -Uri "$base/api/admin/knowledge-nodes" -Method "POST" -Session $session -Headers $csrfHeaders -ExpectedStatus 400 -Label "knowledge invalid color" -Body @{
    id = "verify-api-invalid-color"
    slug = "verify-api-invalid-color"
    nodeType = "derivation"
    symbol = "D.bad"
    title = "Invalid Color"
    summary = "Invalid color test"
    markdown = "# Invalid"
    accentColor = "mauve"
    publishStatus = "draft"
    visibilityStatus = "public"
  }
  Assert-JsonStatus -Uri "$base/api/admin/knowledge-nodes" -Method "POST" -Session $session -Headers $csrfHeaders -ExpectedStatus 400 -Label "knowledge invalid node type" -Body @{
    id = "verify-api-invalid-type"
    slug = "verify-api-invalid-type"
    nodeType = "concept"
    symbol = "D.bad"
    title = "Invalid Type"
    summary = "Invalid type test"
    markdown = "# Invalid"
    publishStatus = "draft"
    visibilityStatus = "public"
  }
  Assert-JsonStatus -Uri "$base/api/admin/knowledge-nodes" -Method "POST" -Session $session -Headers $csrfHeaders -ExpectedStatus 400 -Label "knowledge invalid cover" -Body @{
    id = "verify-api-invalid-cover"
    slug = "verify-api-invalid-cover"
    nodeType = "derivation"
    symbol = "D.bad"
    title = "Invalid Cover"
    summary = "Invalid cover test"
    markdown = "# Invalid"
    cover = "data:image/png;base64,iVBORw0KGgo="
    publishStatus = "draft"
    visibilityStatus = "public"
  }
  Assert-JsonStatus -Uri "$base/api/admin/knowledge-nodes" -Method "POST" -Session $session -Headers $csrfHeaders -ExpectedStatus 400 -Label "knowledge publish completeness" -Body @{
    id = "verify-api-incomplete-node"
    slug = "verify-api-incomplete-node"
    nodeType = "derivation"
    symbol = "D.bad"
    title = "Incomplete Node"
    summary = ""
    markdown = ""
    publishStatus = "published"
    visibilityStatus = "public"
  }

  $draftNodeId = "verify-api-node-draft"
  $privateNodeId = "verify-api-node-private"
  $archivedNodeId = "verify-api-node-archived"
  $unlistedNodeId = "verify-api-node-unlisted"
  $nodeId = "verify-api-node"

  Invoke-Json -Uri "$base/api/admin/knowledge-nodes" -Method "POST" -Session $session -Headers $csrfHeaders -Body @{
    id = $draftNodeId
    slug = $draftNodeId
    nodeType = "derivation"
    symbol = "D.draft"
    title = "Verify Draft Node"
    summary = "Draft node should stay hidden"
    markdown = "# Verify Draft Node"
    publishStatus = "draft"
    visibilityStatus = "public"
  } | Out-Null
  Invoke-Json -Uri "$base/api/admin/knowledge-nodes" -Method "POST" -Session $session -Headers $csrfHeaders -Body @{
    id = $privateNodeId
    slug = $privateNodeId
    nodeType = "derivation"
    symbol = "D.private"
    title = "Verify Private Node"
    summary = "Private node should stay hidden"
    markdown = "# Verify Private Node"
    publishStatus = "published"
    visibilityStatus = "private"
  } | Out-Null
  Invoke-Json -Uri "$base/api/admin/knowledge-nodes" -Method "POST" -Session $session -Headers $csrfHeaders -Body @{
    id = $archivedNodeId
    slug = $archivedNodeId
    nodeType = "derivation"
    symbol = "D.archived"
    title = "Verify Archived Node"
    summary = "Archived node should stay hidden"
    markdown = "# Verify Archived Node"
    publishStatus = "archived"
    visibilityStatus = "public"
  } | Out-Null
  Invoke-Json -Uri "$base/api/admin/knowledge-nodes" -Method "POST" -Session $session -Headers $csrfHeaders -Body @{
    id = $unlistedNodeId
    slug = $unlistedNodeId
    nodeType = "derivation"
    symbol = "D.unlisted"
    title = "Verify Unlisted Node"
    summary = "Unlisted node allows direct detail only"
    markdown = "# Verify Unlisted Node"
    publishStatus = "published"
    visibilityStatus = "unlisted"
  } | Out-Null

  $nodeResult = Invoke-Json -Uri "$base/api/admin/knowledge-nodes" -Method "POST" -Session $session -Headers $csrfHeaders -Body @{
    id = $nodeId
    slug = $nodeId
    nodeType = "derivation"
    symbol = "D.verify"
    title = "Verify Knowledge Node"
    summary = "Published public derivation node"
    markdown = "# Verify Knowledge Node`n`n{{derive:missing-node|Missing Node|purple}}"
    cover = $upload.url
    accentColor = "purple"
    tags = "verify, derive"
    publishStatus = "published"
    visibilityStatus = "public"
  }
  if ($nodeResult.node.publishStatus -ne "published" -or $nodeResult.node.visibilityStatus -ne "public") {
    throw "API verify failed: knowledge node save did not return canonical status fields"
  }
  if (-not (@($nodeResult.warnings) -match "missing-node")) {
    throw "API verify failed: knowledge node save did not warn about dangling derive target"
  }
  if (-not ($nodeResult.nodes | Where-Object { $_.id -eq $nodeId })) {
    throw "API verify failed: knowledge node save not visible in admin list"
  }

  $nodeUpdate = Invoke-Json -Uri "$base/api/admin/knowledge-nodes" -Method "POST" -Session $session -Headers $csrfHeaders -Body @{
    id = $nodeId
    slug = $nodeId
    nodeType = "derivation"
    symbol = "D.verify"
    title = "Verify Knowledge Node Updated"
    summary = "Updated public derivation node"
    markdown = "# Verify Knowledge Node Updated`n`n{{derive:missing-node|Missing Node|blue}}"
    cover = $upload.url
    accentColor = "blue"
    tags = "verify, derive"
    publishStatus = "published"
    visibilityStatus = "public"
  }
  if ($nodeUpdate.node.accentColor -ne "blue") { throw "API verify failed: knowledge node update did not persist accentColor" }

  $revisionResult = Invoke-Json -Uri "$base/api/admin/knowledge-nodes/$nodeId/revisions" -Session $session
  if (@($revisionResult.revisions).Count -lt 1) { throw "API verify failed: knowledge node revisions were not recorded" }
  $revisionId = [int]$revisionResult.revisions[0].id
  $revisionRestore = Invoke-Json -Uri "$base/api/admin/knowledge-nodes/$nodeId/revisions/$revisionId/restore" -Method "POST" -Session $session -Headers $csrfHeaders -Body @{}
  if (-not $revisionRestore.node.id) { throw "API verify failed: knowledge node revision restore did not return node" }

  $publicNodes = Invoke-Json -Uri "$base/api/knowledge-nodes"
  $publicNodeIds = @($publicNodes.nodes | ForEach-Object { $_.id })
  if (-not ($publicNodeIds -contains $nodeId)) { throw "API verify failed: public knowledge list missing published public node" }
  foreach ($hiddenId in @($draftNodeId, $privateNodeId, $archivedNodeId, $unlistedNodeId)) {
    if ($publicNodeIds -contains $hiddenId) { throw "API verify failed: public knowledge list leaked hidden node $hiddenId" }
  }

  $publicNodeDetail = Invoke-Json -Uri "$base/api/knowledge-nodes/$nodeId"
  if ($publicNodeDetail.node.slug -ne $nodeId) { throw "API verify failed: public knowledge detail returned wrong node" }
  if (-not ($publicNodeDetail.node.links | Where-Object { $_.targetSlug -eq "missing-node" -and $_.resolved -eq $false })) {
    throw "API verify failed: public knowledge detail missing safe dangling link summary"
  }
  $unlistedDetail = Invoke-Json -Uri "$base/api/knowledge-nodes/$unlistedNodeId"
  if ($unlistedDetail.node.visibilityStatus -ne "unlisted") { throw "API verify failed: unlisted direct detail did not return canonical visibilityStatus" }
  foreach ($hiddenId in @($draftNodeId, $privateNodeId, $archivedNodeId)) {
    Assert-JsonStatus -Uri "$base/api/knowledge-nodes/$hiddenId" -ExpectedStatus 404 -Label "knowledge public detail hides $hiddenId"
  }

  $deletedKnowledgeNode = Invoke-Json -Uri "$base/api/admin/knowledge-nodes/$nodeId" -Method "DELETE" -Session $session -Headers $csrfHeaders
  if (-not $deletedKnowledgeNode.node.deletedAt) { throw "API verify failed: knowledge node soft delete did not set deletedAt" }
  Assert-JsonStatus -Uri "$base/api/knowledge-nodes/$nodeId" -ExpectedStatus 404 -Label "knowledge public detail hides soft-deleted node"
  $restoredKnowledgeNode = Invoke-Json -Uri "$base/api/admin/knowledge-nodes/$nodeId/restore" -Method "POST" -Session $session -Headers $csrfHeaders -Body @{}
  if ($restoredKnowledgeNode.node.deletedAt) { throw "API verify failed: knowledge node restore still has deletedAt" }

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

  $invalidMathResponse = Invoke-CurlJson -Uri "$base/api/md2file/convert" -Body @{
    markdown = '$$' + "`n" + '\frac{a}{b}'
    format = "docx"
  }
  $invalidMathDiagnostic = if ($invalidMathResponse.Json -and $invalidMathResponse.Json.diagnostics -and $invalidMathResponse.Json.diagnostics.Count -gt 0) {
    $invalidMathResponse.Json.diagnostics[0]
  } else {
    $null
  }
  if ($invalidMathResponse.StatusCode -ne 422 -or -not $invalidMathDiagnostic -or $invalidMathDiagnostic.code -ne "math.delimiter.unclosed") {
    throw "API verify failed: invalid md2file math was not blocked with located diagnostics"
  }
  if ([int]$invalidMathDiagnostic.range.line -ne 1) {
    throw "API verify failed: invalid md2file diagnostic did not preserve source line"
  }

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
  if ($null -eq $export.publicFocusMode) { throw "API verify failed: export missing publicFocusMode" }

  $sitemap = Invoke-WebRequest -Uri "$base/sitemap.xml" -TimeoutSec 10
  if ($sitemap.StatusCode -ne 200) { throw "API verify failed: sitemap.xml returned $($sitemap.StatusCode)" }
  $rss = Invoke-WebRequest -Uri "$base/rss.xml" -TimeoutSec 10
  if ($rss.StatusCode -ne 200) { throw "API verify failed: rss.xml returned $($rss.StatusCode)" }

  Invoke-Json -Uri "$base/api/logout" -Method "POST" -Session $session -Headers $csrfHeaders -Body @{} | Out-Null

  [pscustomobject]@{
    ok = $true
    baseUrl = $base
    versionLabel = $health.versionLabel
    gitCommit = $health.gitCommit
    publicPosts = $publicContent.posts.Count
    publicProjects = $publicContent.projects.Count
    publicKnowledgeNodes = $publicNodes.nodes.Count
    publicFocusMode = $publicContent.publicFocusMode.enabled
    publicFocusModeOwnerDisabled = $publicContentAfterFocusDisable.publicFocusMode.enabled
    featuredSlots = (@($featuredOrders) -join ",")
    bufferedCarouselItems = $bufferedItems.Count
    uploadUrl = $upload.url
    csrfBlocked = $csrfBlocked
    carouselOrderBlocked = $featuredOrderBlocked
    knowledgeNodeId = $nodeId
    md2fileChecks = "success, empty blocked, format blocked, size blocked"
    utf8Checked = $true
    verified = "login, csrf, default-enabled public focus mode, owner disable without carousel auto-restore, carousel active/buffer list, upload, knowledge node public/admin boundary, md2file, post CRUD, project CRUD, export, sitemap, rss, logout"
  } | Format-List
} finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
    $serverProcess.WaitForExit(5000) | Out-Null
  }
  $env:PORT = $previousEnv.PORT
  $env:DATA_DIR = $previousEnv.DATA_DIR
  $env:ADMIN_USERNAME = $previousEnv.ADMIN_USERNAME
  $env:ADMIN_PASSWORD = $previousEnv.ADMIN_PASSWORD
  if (-not $UseCurrentData -and (Test-Path -LiteralPath $testData)) {
    Remove-IsolatedDataDir -PathToRemove $testData -RootPath $root
  }
}
