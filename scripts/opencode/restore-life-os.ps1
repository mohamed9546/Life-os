param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,

  [Parameter(Mandatory = $true)]
  [string]$IdentityFile,

  [switch]$KeepStaging
)

$ErrorActionPreference = 'Stop'

function Require-Age {
  $age = Get-Command age -ErrorAction SilentlyContinue
  if (-not $age) {
    throw 'age CLI is required but was not found on PATH.'
  }
}

function Normalize-RelativePath([string]$Path) {
  return $Path.Replace('\', '/')
}

function Should-ExcludePath([string]$RelativePath) {
  $p = Normalize-RelativePath $RelativePath
  return (
    $p -match '(^|/)\.env(?:\.|$)' -or
    $p -match '^node_modules(?:/|$)' -or
    $p -match '^\.next(?:/|$)' -or
    $p -match '^\.logs(?:/|$)' -or
    $p -match '(^|/).+\.log$' -or
    $p -match '^python-ai/\.venv(?:/|$)' -or
    $p -match '^python-ai(?:/.+)?/__pycache__(?:/|$)' -or
    $p -match '^data/gmail-token\.json$' -or
    $p -match '^data/gcp-oauth\.keys\.json$' -or
    $p -match '^data(?:/.+)?/.+oauth.+\.(json|txt)$' -or
    $p -match '^private(?:/|$)' -or
    $p -match '^data/generated-cvs(?:/|$)' -or
    $p -match '^data/playwright-auto-apply(?:/|$)' -or
    $p -match '^life-os-workspace\.json$' -or
    $p -match '^life-os-source\.json$'
  )
}

function Validate-Manifest($manifest, [string[]]$ExtractedRelativePaths) {
  $errors = [System.Collections.Generic.List[string]]::new()

  if ($null -eq $manifest) { $errors.Add('Manifest is missing.') }
  if ($manifest.backupVersion -ne 1) { $errors.Add("Unsupported backupVersion: $($manifest.backupVersion)") }
  if ([string]::IsNullOrWhiteSpace([string]$manifest.createdAt)) { $errors.Add('Manifest createdAt is missing.') }
  if ([string]::IsNullOrWhiteSpace([string]$manifest.sourceRoot)) { $errors.Add('Manifest sourceRoot is missing.') }
  if ($manifest.encryptionMethod -ne 'zip+age') { $errors.Add("Unsupported encryptionMethod: $($manifest.encryptionMethod)") }
  if ($manifest.restoreInstructionsVersion -ne 1) { $errors.Add("Unsupported restoreInstructionsVersion: $($manifest.restoreInstructionsVersion)") }
  if ($manifest.appName -ne 'Life-OS') { $errors.Add("Unexpected appName: $($manifest.appName)") }

  foreach ($path in ($manifest.includedPaths | ForEach-Object { [string]$_ })) {
    $normalized = Normalize-RelativePath $path
    if (-not ($normalized -eq 'data' -or $normalized -eq 'data/opencode' -or $normalized.StartsWith('data/'))) {
      $errors.Add("Manifest includes forbidden path root: $normalized")
    }
    if (Should-ExcludePath $normalized) {
      $errors.Add("Manifest includes excluded path: $normalized")
    }
  }

  if (-not ($ExtractedRelativePaths | Where-Object { $_ -eq 'data' -or $_.StartsWith('data/') })) {
    $errors.Add('Restored payload does not contain expected data/ structure.')
  }

  foreach ($path in $ExtractedRelativePaths) {
    if (Should-ExcludePath $path) {
      $errors.Add("Restored payload contains forbidden path: $path")
    }
  }

  return $errors
}

Require-Age

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$timestamp = Get-Date -Format 'yyyy-MM-dd-HHmmss'
$restoreRoot = Join-Path $repoRoot "backups\restore-staging\$timestamp"
$zipPath = Join-Path $restoreRoot 'restore.zip'
$extractRoot = Join-Path $restoreRoot 'extracted'
$manifestPath = Join-Path $extractRoot 'manifest.json'
$preRestoreRoot = Join-Path $repoRoot "backups\pre-restore-$timestamp"

$resolvedBackup = (Resolve-Path $BackupFile).Path
$resolvedIdentity = (Resolve-Path $IdentityFile).Path

$repoRootWithSeparator = $repoRoot.TrimEnd('\') + '\'
if (
  $resolvedIdentity.Equals($repoRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
  $resolvedIdentity.StartsWith($repoRootWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)
) {
  throw 'Identity file must be stored outside the repository.'
}

New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null

age --decrypt --identity $resolvedIdentity --output $zipPath $resolvedBackup

if (-not (Test-Path $zipPath)) {
  throw 'Failed to decrypt backup archive.'
}

Expand-Archive -Path $zipPath -DestinationPath $extractRoot -Force

if (-not (Test-Path $manifestPath)) {
  throw 'Restore manifest not found in decrypted archive.'
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

$extractedPaths = Get-ChildItem -Path $extractRoot -Recurse | ForEach-Object {
  Normalize-RelativePath ([System.IO.Path]::GetRelativePath($extractRoot, $_.FullName))
} | Where-Object { $_ -and $_ -ne 'manifest.json' }

$errors = Validate-Manifest $manifest $extractedPaths
if ($errors.Count -gt 0) {
  throw ("Restore validation failed:`n- " + ($errors -join "`n- "))
}

$filesToRestore = Get-ChildItem -Path (Join-Path $extractRoot 'data') -File -Recurse | ForEach-Object {
  $relative = Normalize-RelativePath ([System.IO.Path]::GetRelativePath($extractRoot, $_.FullName))
  [PSCustomObject]@{
    RelativePath = $relative
    FullPath = $_.FullName
  }
}

if ($filesToRestore.Count -eq 0) {
  throw 'No restorable files were found in the archive.'
}

$confirmation = Read-Host "Type RESTORE to overwrite live data from the decrypted backup"
if ($confirmation -ne 'RESTORE') {
  throw 'Restore cancelled by user.'
}

New-Item -ItemType Directory -Force -Path $preRestoreRoot | Out-Null

foreach ($file in $filesToRestore) {
  $livePath = Join-Path $repoRoot $file.RelativePath
  if (Test-Path $livePath) {
    $backupPath = Join-Path $preRestoreRoot $file.RelativePath
    $backupDir = Split-Path -Parent $backupPath
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    Copy-Item -Path $livePath -Destination $backupPath -Force
  }
}

foreach ($file in $filesToRestore) {
  $destination = Join-Path $repoRoot $file.RelativePath
  $destinationDir = Split-Path -Parent $destination
  New-Item -ItemType Directory -Force -Path $destinationDir | Out-Null
  Copy-Item -Path $file.FullPath -Destination $destination -Force
}

if (-not $KeepStaging) {
  Remove-Item $restoreRoot -Recurse -Force
}

Write-Host "Restore complete."
Write-Host "Pre-restore safety copy: $preRestoreRoot"
if ($KeepStaging) {
  Write-Host "Restore staging preserved at: $restoreRoot"
}
