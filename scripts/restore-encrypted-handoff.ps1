[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$DestinationPath,

  [System.Security.SecureString]$Passphrase
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ContainerMagic = "LARKIX-HANDOFF1"
$ContainerFormat = "larkix.encrypted-data.v1"
$ManifestFormat = "larkix.encrypted-data-manifest.v1"
$AuthenticationTagBytes = 32
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
  if ($candidateFull.Equals($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
  return $candidateFull.StartsWith(
    $rootFull + [System.IO.Path]::DirectorySeparatorChar,
    [System.StringComparison]::OrdinalIgnoreCase
  )
}

function Assert-NoReparseAncestors {
  param([Parameter(Mandatory = $true)][string]$PathValue)
  $current = Get-NormalizedFullPath $PathValue
  while (-not [string]::IsNullOrWhiteSpace($current)) {
    if (Test-Path -LiteralPath $current) {
      $item = Get-Item -LiteralPath $current -Force
      if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Restore path must not traverse a symbolic link or reparse point: $current"
      }
    }
    $parent = Split-Path -Parent $current
    if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $current) { break }
    $current = $parent
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

function Read-ExactBytes {
  param(
    [Parameter(Mandatory = $true)][System.IO.Stream]$Stream,
    [Parameter(Mandatory = $true)][int]$Count
  )
  $buffer = New-Object byte[] $Count
  $offset = 0
  while ($offset -lt $Count) {
    $read = $Stream.Read($buffer, $offset, $Count - $offset)
    if ($read -le 0) { throw "Encrypted handoff is truncated." }
    $offset += $read
  }
  return $buffer
}

function Test-FixedTimeEqual {
  param(
    [Parameter(Mandatory = $true)][byte[]]$Left,
    [Parameter(Mandatory = $true)][byte[]]$Right
  )
  if ($Left.Length -ne $Right.Length) { return $false }
  $difference = 0
  for ($index = 0; $index -lt $Left.Length; $index += 1) {
    $difference = $difference -bor ($Left[$index] -bxor $Right[$index])
  }
  return $difference -eq 0
}

function Test-ContainerAuthentication {
  param(
    [Parameter(Mandatory = $true)][string]$ContainerPath,
    [Parameter(Mandatory = $true)][long]$AuthenticatedLength,
    [Parameter(Mandatory = $true)][byte[]]$ExpectedTag,
    [Parameter(Mandatory = $true)][byte[]]$AuthenticationKey
  )
  $stream = $null
  $hmac = New-Object System.Security.Cryptography.HMACSHA256
  $hmac.Key = $AuthenticationKey
  try {
    $stream = [System.IO.File]::OpenRead($ContainerPath)
    $remaining = $AuthenticatedLength
    $buffer = New-Object byte[] 1048576
    while ($remaining -gt 0) {
      $wanted = [int][Math]::Min([long]$buffer.Length, $remaining)
      $read = $stream.Read($buffer, 0, $wanted)
      if ($read -le 0) { throw "Encrypted handoff is truncated." }
      [void]$hmac.TransformBlock($buffer, 0, $read, $buffer, 0)
      $remaining -= $read
    }
    [void]$hmac.TransformFinalBlock((New-Object byte[] 0), 0, 0)
    return Test-FixedTimeEqual -Left $hmac.Hash -Right $ExpectedTag
  }
  finally {
    if ($null -ne $stream) { $stream.Dispose() }
    $hmac.Dispose()
  }
}

function Unprotect-Archive {
  param(
    [Parameter(Mandatory = $true)][string]$ContainerPath,
    [Parameter(Mandatory = $true)][long]$CiphertextOffset,
    [Parameter(Mandatory = $true)][long]$CiphertextLength,
    [Parameter(Mandatory = $true)][string]$ArchivePath,
    [Parameter(Mandatory = $true)][byte[]]$EncryptionKey,
    [Parameter(Mandatory = $true)][byte[]]$InitializationVector
  )
  $aes = [System.Security.Cryptography.Aes]::Create()
  $input = $null
  $output = $null
  $crypto = $null
  try {
    $aes.KeySize = 256
    $aes.BlockSize = 128
    $aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
    $aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7
    $aes.Key = $EncryptionKey
    $aes.IV = $InitializationVector
    $input = [System.IO.File]::OpenRead($ContainerPath)
    [void]$input.Seek($CiphertextOffset, [System.IO.SeekOrigin]::Begin)
    $output = New-Object System.IO.FileStream(
      $ArchivePath,
      [System.IO.FileMode]::CreateNew,
      [System.IO.FileAccess]::Write,
      [System.IO.FileShare]::None
    )
    $crypto = New-Object System.Security.Cryptography.CryptoStream(
      $output,
      $aes.CreateDecryptor(),
      [System.Security.Cryptography.CryptoStreamMode]::Write
    )
    $remaining = $CiphertextLength
    $buffer = New-Object byte[] 1048576
    while ($remaining -gt 0) {
      $wanted = [int][Math]::Min([long]$buffer.Length, $remaining)
      $read = $input.Read($buffer, 0, $wanted)
      if ($read -le 0) { throw "Encrypted handoff is truncated." }
      $crypto.Write($buffer, 0, $read)
      $remaining -= $read
    }
    $crypto.FlushFinalBlock()
  }
  finally {
    if ($null -ne $crypto) { $crypto.Dispose() }
    if ($null -ne $output) { $output.Dispose() }
    if ($null -ne $input) { $input.Dispose() }
    $aes.Dispose()
  }
}

function Get-SafeExtractionPath {
  param(
    [Parameter(Mandatory = $true)][string]$ExtractionRoot,
    [Parameter(Mandatory = $true)][string]$EntryName
  )
  $normalized = $EntryName.Replace('\', '/').TrimStart('/')
  if ([string]::IsNullOrWhiteSpace($normalized) -or
      [System.IO.Path]::IsPathRooted($normalized) -or
      $normalized -match '(^|/)\.\.(/|$)' -or
      $normalized.Contains(':')) {
    throw "Archive contains an unsafe path."
  }
  $candidate = [System.IO.Path]::GetFullPath((Join-Path $ExtractionRoot $normalized.Replace('/', [System.IO.Path]::DirectorySeparatorChar)))
  if (-not (Test-PathInside -Candidate $candidate -Root $ExtractionRoot)) {
    throw "Archive entry escapes the extraction root."
  }
  return $candidate
}

function Expand-VerifiedArchive {
  param(
    [Parameter(Mandatory = $true)][string]$ArchivePath,
    [Parameter(Mandatory = $true)][string]$ExtractionRoot
  )
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Directory]::CreateDirectory($ExtractionRoot) | Out-Null
  $archive = [System.IO.Compression.ZipFile]::OpenRead($ArchivePath)
  $seenPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  try {
    foreach ($entry in $archive.Entries) {
      $unixType = (($entry.ExternalAttributes -shr 16) -band 0xF000)
      if ($unixType -eq 0xA000) { throw "Archive contains a symbolic link entry." }
      $isDirectory = $entry.FullName.EndsWith('/') -or $entry.FullName.EndsWith('\')
      $entryName = $entry.FullName.TrimEnd([char[]]@('/', '\'))
      if ([string]::IsNullOrWhiteSpace($entryName)) { continue }
      $destination = Get-SafeExtractionPath -ExtractionRoot $ExtractionRoot -EntryName $entryName
      if (-not $seenPaths.Add($destination)) { throw "Archive contains duplicate paths." }
      if ($isDirectory) {
        [System.IO.Directory]::CreateDirectory($destination) | Out-Null
        continue
      }
      [System.IO.Directory]::CreateDirectory((Split-Path -Parent $destination)) | Out-Null
      $input = $entry.Open()
      $output = $null
      try {
        $output = New-Object System.IO.FileStream(
          $destination,
          [System.IO.FileMode]::CreateNew,
          [System.IO.FileAccess]::Write,
          [System.IO.FileShare]::None
        )
        $input.CopyTo($output)
      }
      finally {
        if ($null -ne $output) { $output.Dispose() }
        $input.Dispose()
      }
    }
  }
  finally { $archive.Dispose() }
}

function Assert-RelativeManifestPath {
  param([Parameter(Mandatory = $true)][string]$RelativePath)
  $normalized = $RelativePath.Replace('\', '/')
  if (-not $normalized.StartsWith("data/", [System.StringComparison]::Ordinal) -or
      [System.IO.Path]::IsPathRooted($normalized) -or
      $normalized -match '(^|/)\.\.(/|$)' -or
      $normalized.Contains(':')) {
    throw "Manifest contains an unsafe file path."
  }
  return $normalized
}

function Test-PayloadAgainstManifest {
  param(
    [Parameter(Mandatory = $true)][string]$ExtractionRoot,
    [Parameter(Mandatory = $true)]$Manifest
  )
  if ($Manifest.format -ne $ManifestFormat) { throw "Unsupported encrypted handoff manifest format." }
  if ($Manifest.sourceMode -notin @("dataDir", "databaseAndUploads")) {
    throw "Unsupported source mode in encrypted handoff manifest."
  }
  $declared = [System.Collections.Generic.Dictionary[string,object]]::new([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($entry in @($Manifest.files)) {
    $relative = Assert-RelativeManifestPath ([string]$entry.relativePath)
    if ($declared.ContainsKey($relative)) { throw "Manifest contains duplicate file paths." }
    $declared.Add($relative, $entry)
    $fullPath = Get-SafeExtractionPath -ExtractionRoot $ExtractionRoot -EntryName $relative
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
      throw "A file declared by the manifest is missing."
    }
    $file = Get-Item -LiteralPath $fullPath -Force
    if ([long]$entry.bytes -ne [long]$file.Length) { throw "Payload length validation failed." }
    $actualHash = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne ([string]$entry.sha256).ToLowerInvariant()) {
      throw "Payload checksum validation failed."
    }
    if ($null -ne $entry.lastWriteTimeUtc) {
      $file.LastWriteTimeUtc = [DateTime]::Parse(
        [string]$entry.lastWriteTimeUtc,
        [System.Globalization.CultureInfo]::InvariantCulture,
        [System.Globalization.DateTimeStyles]::RoundtripKind
      ).ToUniversalTime()
    }
  }
  $dataRoot = Join-Path $ExtractionRoot "data"
  if (-not (Test-Path -LiteralPath $dataRoot -PathType Container)) { throw "Payload data directory is missing." }
  $actualPaths = @(
    Get-ChildItem -LiteralPath $dataRoot -Force -Recurse -File | ForEach-Object {
      "data/" + $_.FullName.Substring($dataRoot.Length).TrimStart([char[]]@('\', '/')).Replace('\', '/')
    }
  )
  if ($actualPaths.Count -ne $declared.Count) { throw "Payload file set differs from the signed manifest." }
  foreach ($actualPath in $actualPaths) {
    if (-not $declared.ContainsKey($actualPath)) { throw "Payload contains an undeclared file." }
  }
  $sum = [long](($declared.Values | ForEach-Object { [long]$_.bytes } | Measure-Object -Sum).Sum)
  if ([int]$Manifest.fileCount -ne $declared.Count -or [long]$Manifest.totalBytes -ne $sum) {
    throw "Manifest aggregate counts are inconsistent."
  }
  return [pscustomobject]@{
    SourceMode = [string]$Manifest.sourceMode
    FileCount = $declared.Count
    TotalBytes = $sum
  }
}

$temporaryRoot = $null
$targetStage = $null
$passwordBytes = $null
$encryptionKey = $null
$authenticationKey = $null
$destinationWasEmpty = $false

try {
  $inputFull = Get-NormalizedFullPath $InputPath
  $destinationFull = Get-NormalizedFullPath $DestinationPath
  if (-not (Test-Path -LiteralPath $inputFull -PathType Leaf)) {
    throw "Encrypted handoff does not exist: $inputFull"
  }
  Assert-NoReparseAncestors $inputFull
  if (Test-PathInside -Candidate $destinationFull -Root $RepositoryRoot) {
    throw "Restore destination must be outside the Git repository: $destinationFull"
  }
  if (Test-PathInside -Candidate $inputFull -Root $destinationFull) {
    throw "Restore destination must not contain the encrypted handoff input."
  }
  if (Test-Path -LiteralPath $destinationFull) {
    $destinationItem = Get-Item -LiteralPath $destinationFull -Force
    if (-not $destinationItem.PSIsContainer) {
      throw "Restore destination exists and is not a directory: $destinationFull"
    }
    if (@(Get-ChildItem -LiteralPath $destinationFull -Force).Count -gt 0) {
      throw "Restore destination is not empty; overwrite is intentionally refused: $destinationFull"
    }
    $destinationWasEmpty = $true
  }
  if ($null -eq $Passphrase) { $Passphrase = Read-Host "Handoff passphrase" -AsSecureString }
  $passwordBytes = Convert-SecureStringToUtf8Bytes $Passphrase

  $inputStream = [System.IO.File]::OpenRead($inputFull)
  try {
    $magicBytes = [System.Text.Encoding]::ASCII.GetBytes($ContainerMagic)
    if ($inputStream.Length -lt ($magicBytes.Length + 4 + 2 + $AuthenticationTagBytes)) {
      throw "Encrypted handoff is too short."
    }
    $actualMagic = Read-ExactBytes -Stream $inputStream -Count $magicBytes.Length
    if (-not (Test-FixedTimeEqual -Left $actualMagic -Right $magicBytes)) {
      throw "Unsupported encrypted handoff container."
    }
    $headerLengthBytes = Read-ExactBytes -Stream $inputStream -Count 4
    if (-not [System.BitConverter]::IsLittleEndian) { [System.Array]::Reverse($headerLengthBytes) }
    $headerLength = [System.BitConverter]::ToInt32($headerLengthBytes, 0)
    if ($headerLength -lt 2 -or $headerLength -gt 65536) {
      throw "Encrypted handoff header length is invalid."
    }
    try {
      $header = [System.Text.Encoding]::UTF8.GetString((Read-ExactBytes -Stream $inputStream -Count $headerLength)) | ConvertFrom-Json
    }
    catch { throw "Encrypted handoff header is not valid JSON." }
    if ($header.format -ne $ContainerFormat -or
        $header.cipher -ne "AES-256-CBC" -or
        $header.authentication -ne "HMAC-SHA256-ETM" -or
        $header.kdf -ne "PBKDF2-HMAC-SHA256") {
      throw "Unsupported encrypted handoff cryptographic format."
    }
    $iterations = [int]$header.kdfIterations
    if ($iterations -lt 200000 -or $iterations -gt 2000000) {
      throw "Encrypted handoff KDF parameters are outside the accepted range."
    }
    try {
      $salt = [Convert]::FromBase64String([string]$header.salt)
      $initializationVector = [Convert]::FromBase64String([string]$header.iv)
    }
    catch { throw "Encrypted handoff key parameters are malformed." }
    if ($salt.Length -ne 32 -or $initializationVector.Length -ne 16) {
      throw "Encrypted handoff key parameter lengths are invalid."
    }
    $ciphertextOffset = $magicBytes.Length + 4 + $headerLength
    $authenticatedLength = $inputStream.Length - $AuthenticationTagBytes
    $ciphertextLength = $authenticatedLength - $ciphertextOffset
    if ($ciphertextLength -le 0 -or ($ciphertextLength % 16) -ne 0 -or
        [long]$header.ciphertextBytes -ne $ciphertextLength) {
      throw "Encrypted handoff ciphertext length is invalid."
    }
    [void]$inputStream.Seek($authenticatedLength, [System.IO.SeekOrigin]::Begin)
    $expectedTag = Read-ExactBytes -Stream $inputStream -Count $AuthenticationTagBytes
  }
  finally { $inputStream.Dispose() }

  $keys = Get-DerivedKeys -PasswordBytes $passwordBytes -Salt $salt -Iterations $iterations
  $encryptionKey = $keys[0]
  $authenticationKey = $keys[1]
  if (-not (Test-ContainerAuthentication -ContainerPath $inputFull -AuthenticatedLength $authenticatedLength -ExpectedTag $expectedTag -AuthenticationKey $authenticationKey)) {
    throw "Encrypted handoff authentication failed; the key is wrong or the file was modified."
  }

  $operationId = [Guid]::NewGuid().ToString("N")
  $temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) "larkix-handoff-restore-$operationId"
  $archivePath = Join-Path $temporaryRoot "payload.zip"
  $extractionRoot = Join-Path $temporaryRoot "extracted"
  [System.IO.Directory]::CreateDirectory($temporaryRoot) | Out-Null
  Unprotect-Archive -ContainerPath $inputFull -CiphertextOffset $ciphertextOffset -CiphertextLength $ciphertextLength -ArchivePath $archivePath -EncryptionKey $encryptionKey -InitializationVector $initializationVector
  if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne
      ([string]$header.archiveSha256).ToLowerInvariant()) {
    throw "Decrypted archive checksum validation failed."
  }
  Expand-VerifiedArchive -ArchivePath $archivePath -ExtractionRoot $extractionRoot
  $manifestPath = Join-Path $extractionRoot "manifest.json"
  if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Encrypted handoff manifest is missing."
  }
  try { $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json }
  catch { throw "Encrypted handoff manifest is not valid JSON." }
  $initialValidation = Test-PayloadAgainstManifest -ExtractionRoot $extractionRoot -Manifest $manifest
  foreach ($directory in @($manifest.directories)) {
    if ([string]::IsNullOrWhiteSpace([string]$directory)) { continue }
    [System.IO.Directory]::CreateDirectory(
      (Get-SafeExtractionPath -ExtractionRoot (Join-Path $extractionRoot "data") -EntryName ([string]$directory))
    ) | Out-Null
  }

  $destinationParent = Split-Path -Parent $destinationFull
  [System.IO.Directory]::CreateDirectory($destinationParent) | Out-Null
  Assert-NoReparseAncestors $destinationFull
  $targetStage = Join-Path $destinationParent ("." + [System.IO.Path]::GetFileName($destinationFull) + ".restore-$operationId")
  [System.IO.Directory]::CreateDirectory($targetStage) | Out-Null
  Copy-Item -LiteralPath (Join-Path $extractionRoot "data") -Destination (Join-Path $targetStage "data") -Recurse -Force
  $stageValidation = Test-PayloadAgainstManifest -ExtractionRoot $targetStage -Manifest $manifest
  $stagedData = Join-Path $targetStage "data"
  if ($destinationWasEmpty) { Remove-Item -LiteralPath $destinationFull -Force }
  try {
    [System.IO.Directory]::Move($stagedData, $destinationFull)
    $emptyStageWrapper = $targetStage
    $targetStage = $null
    Remove-Item -LiteralPath $emptyStageWrapper -Force -ErrorAction SilentlyContinue
  }
  catch {
    if ($destinationWasEmpty -and -not (Test-Path -LiteralPath $destinationFull)) {
      [System.IO.Directory]::CreateDirectory($destinationFull) | Out-Null
    }
    throw
  }

  [pscustomobject]@{
    Status = "restored"
    InputPath = $inputFull
    DestinationPath = $destinationFull
    SourceMode = $stageValidation.SourceMode
    FileCount = $stageValidation.FileCount
    RestoredBytes = $stageValidation.TotalBytes
  }
}
finally {
  foreach ($secretBytes in @($passwordBytes, $encryptionKey, $authenticationKey)) {
    if ($null -ne $secretBytes) { [System.Array]::Clear($secretBytes, 0, $secretBytes.Length) }
  }
  if ($null -ne $targetStage -and (Test-Path -LiteralPath $targetStage)) {
    Remove-Item -LiteralPath $targetStage -Recurse -Force -ErrorAction SilentlyContinue
  }
  if ($null -ne $temporaryRoot -and (Test-Path -LiteralPath $temporaryRoot)) {
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
