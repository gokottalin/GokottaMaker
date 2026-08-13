[CmdletBinding(DefaultParameterSetName = "DataDir")]
param(
  [Parameter(Mandatory = $true, ParameterSetName = "DataDir")]
  [ValidateNotNullOrEmpty()]
  [string]$DataDir,

  [Parameter(Mandatory = $true, ParameterSetName = "Split")]
  [ValidateNotNullOrEmpty()]
  [string]$DatabasePath,

  [Parameter(Mandatory = $true, ParameterSetName = "Split")]
  [ValidateNotNullOrEmpty()]
  [string]$UploadsPath,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$OutputPath,

  [System.Security.SecureString]$Passphrase,

  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ContainerMagic = "LARKIX-HANDOFF1"
$ContainerFormat = "larkix.encrypted-data.v1"
$ManifestFormat = "larkix.encrypted-data-manifest.v1"
$KdfIterations = 310000
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$RepositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))

function Get-NormalizedFullPath {
  param([Parameter(Mandatory = $true)][string]$PathValue)
  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return [System.IO.Path]::GetFullPath($PathValue)
  }
  return [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $PathValue))
}

function Test-PathInside {
  param(
    [Parameter(Mandatory = $true)][string]$Candidate,
    [Parameter(Mandatory = $true)][string]$Root
  )
  $candidateFull = (Get-NormalizedFullPath $Candidate).TrimEnd([char[]]@('\', '/'))
  $rootFull = (Get-NormalizedFullPath $Root).TrimEnd([char[]]@('\', '/'))
  if ($candidateFull.Equals($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $true
  }
  return $candidateFull.StartsWith(
    $rootFull + [System.IO.Path]::DirectorySeparatorChar,
    [System.StringComparison]::OrdinalIgnoreCase
  )
}

function Assert-NoReparsePoints {
  param([Parameter(Mandatory = $true)][string]$RootPath)
  $rootItem = Get-Item -LiteralPath $RootPath -Force
  if (($rootItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "Source path must not be a symbolic link or reparse point: $RootPath"
  }
  if ($rootItem.PSIsContainer) {
    foreach ($item in Get-ChildItem -LiteralPath $RootPath -Force -Recurse) {
      if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Source tree contains a symbolic link or reparse point: $($item.FullName)"
      }
    }
  }
}

function Assert-NoReparseAncestors {
  param([Parameter(Mandatory = $true)][string]$PathValue)
  $current = Get-NormalizedFullPath $PathValue
  while (-not [string]::IsNullOrWhiteSpace($current)) {
    if (Test-Path -LiteralPath $current) {
      $item = Get-Item -LiteralPath $current -Force
      if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Output path must not traverse a symbolic link or reparse point: $current"
      }
    }
    $parent = Split-Path -Parent $current
    if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $current) { break }
    $current = $parent
  }
}

function Convert-ToArchivePath {
  param([Parameter(Mandatory = $true)][string]$RelativePath)
  $normalized = $RelativePath.Replace('\', '/').TrimStart('/')
  if ([string]::IsNullOrWhiteSpace($normalized) -or
      [System.IO.Path]::IsPathRooted($normalized) -or
      $normalized -match '(^|/)\.\.(/|$)' -or
      $normalized.Contains(':')) {
    throw "Unsafe relative path: $RelativePath"
  }
  return $normalized
}

function Get-RelativeChildPath {
  param(
    [Parameter(Mandatory = $true)][string]$RootPath,
    [Parameter(Mandatory = $true)][string]$ChildPath
  )
  $rootFull = (Get-NormalizedFullPath $RootPath).TrimEnd([char[]]@('\', '/'))
  $childFull = Get-NormalizedFullPath $ChildPath
  if (-not (Test-PathInside -Candidate $childFull -Root $rootFull) -or
      $childFull.Equals($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Path is not a child of the declared source root: $ChildPath"
  }
  return Convert-ToArchivePath $childFull.Substring($rootFull.Length).TrimStart([char[]]@('\', '/'))
}

function Copy-SourceFile {
  param(
    [Parameter(Mandatory = $true)][string]$SourcePath,
    [Parameter(Mandatory = $true)][string]$StagingRoot,
    [Parameter(Mandatory = $true)][string]$ArchiveRelativePath
  )
  $safeRelativePath = Convert-ToArchivePath $ArchiveRelativePath
  $sourceBefore = Get-Item -LiteralPath $SourcePath -Force
  if ($sourceBefore.PSIsContainer) { throw "Expected a file but received a directory: $SourcePath" }
  $destination = Join-Path $StagingRoot ($safeRelativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
  [System.IO.Directory]::CreateDirectory((Split-Path -Parent $destination)) | Out-Null
  Copy-Item -LiteralPath $SourcePath -Destination $destination -Force
  $sourceAfter = Get-Item -LiteralPath $SourcePath -Force
  if ($sourceBefore.Length -ne $sourceAfter.Length -or
      $sourceBefore.LastWriteTimeUtc -ne $sourceAfter.LastWriteTimeUtc) {
    throw "Source changed during export; stop the application and retry: $SourcePath"
  }
  $copied = Get-Item -LiteralPath $destination -Force
  return [pscustomobject][ordered]@{
    relativePath = $safeRelativePath
    bytes = [long]$copied.Length
    sha256 = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
    lastWriteTimeUtc = $sourceBefore.LastWriteTimeUtc.ToString("o")
  }
}

function Convert-SecureStringToUtf8Bytes {
  param([Parameter(Mandatory = $true)][System.Security.SecureString]$SecureValue)
  $pointer = [IntPtr]::Zero
  $plainText = $null
  try {
    $pointer = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    $plainText = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    return [System.Text.Encoding]::UTF8.GetBytes($plainText)
  }
  finally {
    $plainText = $null
    if ($pointer -ne [IntPtr]::Zero) {
      [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
  }
}

function Get-RandomBytes {
  param([Parameter(Mandatory = $true)][int]$Length)
  $bytes = New-Object byte[] $Length
  $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
  try {
    $rng.GetBytes($bytes)
    return $bytes
  }
  finally { $rng.Dispose() }
}

function Get-DerivedKeys {
  param(
    [Parameter(Mandatory = $true)][byte[]]$PasswordBytes,
    [Parameter(Mandatory = $true)][byte[]]$Salt,
    [Parameter(Mandatory = $true)][int]$Iterations
  )
  $kdf = New-Object System.Security.Cryptography.Rfc2898DeriveBytes(
    $PasswordBytes,
    $Salt,
    $Iterations,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256
  )
  try {
    $material = $kdf.GetBytes(64)
    $encryptionKey = New-Object byte[] 32
    $authenticationKey = New-Object byte[] 32
    [System.Array]::Copy($material, 0, $encryptionKey, 0, 32)
    [System.Array]::Copy($material, 32, $authenticationKey, 0, 32)
    [System.Array]::Clear($material, 0, $material.Length)
    return @($encryptionKey, $authenticationKey)
  }
  finally { $kdf.Dispose() }
}

function Protect-Archive {
  param(
    [Parameter(Mandatory = $true)][string]$ArchivePath,
    [Parameter(Mandatory = $true)][string]$CiphertextPath,
    [Parameter(Mandatory = $true)][byte[]]$EncryptionKey,
    [Parameter(Mandatory = $true)][byte[]]$InitializationVector
  )
  $aes = [System.Security.Cryptography.Aes]::Create()
  $inputStream = $null
  $outputStream = $null
  $cryptoStream = $null
  try {
    $aes.KeySize = 256
    $aes.BlockSize = 128
    $aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
    $aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7
    $aes.Key = $EncryptionKey
    $aes.IV = $InitializationVector
    $inputStream = [System.IO.File]::OpenRead($ArchivePath)
    $outputStream = New-Object System.IO.FileStream(
      $CiphertextPath,
      [System.IO.FileMode]::CreateNew,
      [System.IO.FileAccess]::Write,
      [System.IO.FileShare]::None
    )
    $cryptoStream = New-Object System.Security.Cryptography.CryptoStream(
      $outputStream,
      $aes.CreateEncryptor(),
      [System.Security.Cryptography.CryptoStreamMode]::Write
    )
    $inputStream.CopyTo($cryptoStream)
    $cryptoStream.FlushFinalBlock()
  }
  finally {
    if ($null -ne $cryptoStream) { $cryptoStream.Dispose() }
    if ($null -ne $outputStream) { $outputStream.Dispose() }
    if ($null -ne $inputStream) { $inputStream.Dispose() }
    $aes.Dispose()
  }
}

function Write-AuthenticatedContainer {
  param(
    [Parameter(Mandatory = $true)][string]$DestinationPath,
    [Parameter(Mandatory = $true)][byte[]]$MagicBytes,
    [Parameter(Mandatory = $true)][byte[]]$HeaderBytes,
    [Parameter(Mandatory = $true)][string]$CiphertextPath,
    [Parameter(Mandatory = $true)][byte[]]$AuthenticationKey
  )
  $headerLengthBytes = [System.BitConverter]::GetBytes([int]$HeaderBytes.Length)
  if (-not [System.BitConverter]::IsLittleEndian) { [System.Array]::Reverse($headerLengthBytes) }
  $output = $null
  $ciphertext = $null
  $hmac = New-Object System.Security.Cryptography.HMACSHA256
  $hmac.Key = $AuthenticationKey
  try {
    $output = New-Object System.IO.FileStream(
      $DestinationPath,
      [System.IO.FileMode]::CreateNew,
      [System.IO.FileAccess]::Write,
      [System.IO.FileShare]::None
    )
    foreach ($block in @($MagicBytes, $headerLengthBytes, $HeaderBytes)) {
      $output.Write($block, 0, $block.Length)
      [void]$hmac.TransformBlock($block, 0, $block.Length, $block, 0)
    }
    $ciphertext = [System.IO.File]::OpenRead($CiphertextPath)
    $buffer = New-Object byte[] 1048576
    while (($read = $ciphertext.Read($buffer, 0, $buffer.Length)) -gt 0) {
      $output.Write($buffer, 0, $read)
      [void]$hmac.TransformBlock($buffer, 0, $read, $buffer, 0)
    }
    [void]$hmac.TransformFinalBlock((New-Object byte[] 0), 0, 0)
    $tag = $hmac.Hash
    $output.Write($tag, 0, $tag.Length)
    $output.Flush($true)
  }
  finally {
    if ($null -ne $ciphertext) { $ciphertext.Dispose() }
    if ($null -ne $output) { $output.Dispose() }
    $hmac.Dispose()
  }
}

$stagingRoot = $null
$archivePath = $null
$ciphertextPath = $null
$temporaryOutputPath = $null
$passwordBytes = $null
$encryptionKey = $null
$authenticationKey = $null

try {
  $outputFull = Get-NormalizedFullPath $OutputPath
  if (Test-PathInside -Candidate $outputFull -Root $RepositoryRoot) {
    throw "Encrypted handoff output must be outside the Git repository: $outputFull"
  }
  $outputParent = Split-Path -Parent $outputFull
  if ([string]::IsNullOrWhiteSpace($outputParent)) { throw "OutputPath must include a parent directory." }
  [System.IO.Directory]::CreateDirectory($outputParent) | Out-Null
  Assert-NoReparseAncestors $outputFull
  if ((Test-Path -LiteralPath $outputFull) -and -not $Force) {
    throw "Output already exists. Choose a new path or explicitly use -Force: $outputFull"
  }

  if ($null -eq $Passphrase) {
    $Passphrase = Read-Host "Handoff passphrase (minimum 16 characters)" -AsSecureString
    $confirmation = Read-Host "Confirm handoff passphrase" -AsSecureString
    $firstBytes = Convert-SecureStringToUtf8Bytes $Passphrase
    $secondBytes = Convert-SecureStringToUtf8Bytes $confirmation
    try {
      if ($firstBytes.Length -ne $secondBytes.Length) { throw "Passphrase confirmation does not match." }
      $difference = 0
      for ($index = 0; $index -lt $firstBytes.Length; $index += 1) {
        $difference = $difference -bor ($firstBytes[$index] -bxor $secondBytes[$index])
      }
      if ($difference -ne 0) { throw "Passphrase confirmation does not match." }
    }
    finally {
      [System.Array]::Clear($firstBytes, 0, $firstBytes.Length)
      [System.Array]::Clear($secondBytes, 0, $secondBytes.Length)
    }
  }
  if ($Passphrase.Length -lt 16) {
    throw "Passphrase must contain at least 16 characters; use a randomly generated value."
  }

  $operationId = [Guid]::NewGuid().ToString("N")
  $stagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) "larkix-handoff-stage-$operationId"
  $archivePath = Join-Path ([System.IO.Path]::GetTempPath()) "larkix-handoff-archive-$operationId.zip"
  $ciphertextPath = Join-Path ([System.IO.Path]::GetTempPath()) "larkix-handoff-cipher-$operationId.bin"
  $temporaryOutputPath = Join-Path $outputParent ("." + [System.IO.Path]::GetFileName($outputFull) + ".tmp-$operationId")
  [System.IO.Directory]::CreateDirectory((Join-Path $stagingRoot "data")) | Out-Null
  $entries = New-Object System.Collections.Generic.List[object]
  $directories = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)

  if ($PSCmdlet.ParameterSetName -eq "DataDir") {
    $sourceMode = "dataDir"
    $dataDirFull = Get-NormalizedFullPath $DataDir
    if (-not (Test-Path -LiteralPath $dataDirFull -PathType Container)) {
      throw "DataDir does not exist or is not a directory: $dataDirFull"
    }
    if (Test-PathInside -Candidate $outputFull -Root $dataDirFull) {
      throw "Encrypted handoff output must not be placed inside the source DataDir."
    }
    Assert-NoReparsePoints $dataDirFull
    foreach ($directory in Get-ChildItem -LiteralPath $dataDirFull -Force -Recurse -Directory) {
      [void]$directories.Add((Get-RelativeChildPath -RootPath $dataDirFull -ChildPath $directory.FullName))
    }
    foreach ($file in Get-ChildItem -LiteralPath $dataDirFull -Force -Recurse -File | Sort-Object FullName) {
      $relative = Get-RelativeChildPath -RootPath $dataDirFull -ChildPath $file.FullName
      [void]$entries.Add((Copy-SourceFile -SourcePath $file.FullName -StagingRoot $stagingRoot -ArchiveRelativePath "data/$relative"))
    }
  }
  else {
    $sourceMode = "databaseAndUploads"
    $databaseFull = Get-NormalizedFullPath $DatabasePath
    $uploadsFull = Get-NormalizedFullPath $UploadsPath
    if (-not (Test-Path -LiteralPath $databaseFull -PathType Leaf)) {
      throw "DatabasePath does not exist or is not a file: $databaseFull"
    }
    if (-not (Test-Path -LiteralPath $uploadsFull -PathType Container)) {
      throw "UploadsPath does not exist or is not a directory: $uploadsFull"
    }
    if ($outputFull.Equals($databaseFull, [System.StringComparison]::OrdinalIgnoreCase) -or
        (Test-PathInside -Candidate $outputFull -Root $uploadsFull)) {
      throw "Encrypted handoff output must not replace the database or be placed inside uploads."
    }
    Assert-NoReparsePoints $databaseFull
    Assert-NoReparsePoints $uploadsFull
    [void]$directories.Add("database")
    [void]$directories.Add("uploads")
    foreach ($directory in Get-ChildItem -LiteralPath $uploadsFull -Force -Recurse -Directory) {
      $relativeDirectory = Get-RelativeChildPath -RootPath $uploadsFull -ChildPath $directory.FullName
      [void]$directories.Add("uploads/$relativeDirectory")
    }
    $databaseName = Convert-ToArchivePath ([System.IO.Path]::GetFileName($databaseFull))
    [void]$entries.Add((Copy-SourceFile -SourcePath $databaseFull -StagingRoot $stagingRoot -ArchiveRelativePath "data/database/$databaseName"))
    foreach ($file in Get-ChildItem -LiteralPath $uploadsFull -Force -Recurse -File | Sort-Object FullName) {
      $relative = Get-RelativeChildPath -RootPath $uploadsFull -ChildPath $file.FullName
      [void]$entries.Add((Copy-SourceFile -SourcePath $file.FullName -StagingRoot $stagingRoot -ArchiveRelativePath "data/uploads/$relative"))
    }
  }

  $entryArray = @($entries | Sort-Object relativePath)
  $totalBytes = [long](($entryArray | Measure-Object -Property bytes -Sum).Sum)
  $manifest = [ordered]@{
    format = $ManifestFormat
    sourceMode = $sourceMode
    createdAtUtc = [DateTime]::UtcNow.ToString("o")
    fileCount = $entryArray.Count
    totalBytes = $totalBytes
    directories = @($directories | Sort-Object)
    files = $entryArray
  }
  $manifestPath = Join-Path $stagingRoot "manifest.json"
  [System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 8), $Utf8NoBom)
  $manifestSha256 = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::CreateFromDirectory(
    $stagingRoot,
    $archivePath,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
  )
  $archiveSha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $salt = Get-RandomBytes 32
  $initializationVector = Get-RandomBytes 16
  $passwordBytes = Convert-SecureStringToUtf8Bytes $Passphrase
  $keys = Get-DerivedKeys -PasswordBytes $passwordBytes -Salt $salt -Iterations $KdfIterations
  $encryptionKey = $keys[0]
  $authenticationKey = $keys[1]
  Protect-Archive -ArchivePath $archivePath -CiphertextPath $ciphertextPath -EncryptionKey $encryptionKey -InitializationVector $initializationVector

  $ciphertextBytes = (Get-Item -LiteralPath $ciphertextPath).Length
  $header = [ordered]@{
    format = $ContainerFormat
    cipher = "AES-256-CBC"
    authentication = "HMAC-SHA256-ETM"
    kdf = "PBKDF2-HMAC-SHA256"
    kdfIterations = $KdfIterations
    salt = [Convert]::ToBase64String($salt)
    iv = [Convert]::ToBase64String($initializationVector)
    archiveSha256 = $archiveSha256
    ciphertextBytes = [long]$ciphertextBytes
  }
  $headerBytes = $Utf8NoBom.GetBytes(($header | ConvertTo-Json -Compress))
  Write-AuthenticatedContainer `
    -DestinationPath $temporaryOutputPath `
    -MagicBytes ([System.Text.Encoding]::ASCII.GetBytes($ContainerMagic)) `
    -HeaderBytes $headerBytes `
    -CiphertextPath $ciphertextPath `
    -AuthenticationKey $authenticationKey

  if (Test-Path -LiteralPath $outputFull) {
    [System.IO.File]::Replace($temporaryOutputPath, $outputFull, $null)
  }
  else {
    [System.IO.File]::Move($temporaryOutputPath, $outputFull)
  }
  $temporaryOutputPath = $null

  [pscustomobject]@{
    Status = "encrypted"
    OutputPath = $outputFull
    SourceMode = $sourceMode
    FileCount = $entryArray.Count
    PlaintextBytes = $totalBytes
    ContainerBytes = (Get-Item -LiteralPath $outputFull).Length
    ManifestSha256 = $manifestSha256
  }
}
finally {
  foreach ($secretBytes in @($passwordBytes, $encryptionKey, $authenticationKey)) {
    if ($null -ne $secretBytes) { [System.Array]::Clear($secretBytes, 0, $secretBytes.Length) }
  }
  foreach ($filePath in @($temporaryOutputPath, $ciphertextPath, $archivePath)) {
    if ($null -ne $filePath -and (Test-Path -LiteralPath $filePath)) {
      Remove-Item -LiteralPath $filePath -Force -ErrorAction SilentlyContinue
    }
  }
  if ($null -ne $stagingRoot -and (Test-Path -LiteralPath $stagingRoot)) {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
