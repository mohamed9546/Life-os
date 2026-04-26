[CmdletBinding(DefaultParameterSetName = 'Run')]
param(
  [Parameter(Mandatory = $true, ParameterSetName = 'Run')]
  [string]$Recipient,

  [Parameter(ParameterSetName = 'Run')]
  [switch]$DryRun,

  [Parameter(Mandatory = $true, ParameterSetName = 'Help')]
  [switch]$Help
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

function Get-LifeOsRelativePath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BasePath,

    [Parameter(Mandatory = $true)]
    [string]$FullPath
  )

  $baseFullPath = [System.IO.Path]::GetFullPath($BasePath)
  $targetFullPath = [System.IO.Path]::GetFullPath($FullPath)

  if (-not $baseFullPath.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
    $baseFullPath = $baseFullPath + [System.IO.Path]::DirectorySeparatorChar
  }

  $baseUri = New-Object System.Uri($baseFullPath)
  $targetUri = New-Object System.Uri($targetFullPath)

  $relativeUri = $baseUri.MakeRelativeUri($targetUri)
  $relativePath = [System.Uri]::UnescapeDataString($relativeUri.ToString())

  return $relativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
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
    $p -match '(^|/)(gmail-token\.json|gcp-oauth\.keys\.json)$' -or
    $p -match '(^|/)([^/]*[-_.])?(oauth|token|credentials?|credential)([-_.][^/]*)?\.(json|txt|key|pem)$' -or
    $p -match '^private(?:/|$)' -or
    $p -match '^data/generated-cvs(?:/|$)' -or
    $p -match '^data/playwright-auto-apply(?:/|$)' -or
    $p -match '^life-os-workspace\.json$' -or
    $p -match '^life-os-source\.json$'
  )
}

if ($Help) {
  Write-Host 'Usage: .\scripts\opencode\backup-life-os.ps1 -Recipient "<AGE_PUBLIC_RECIPIENT>" [-DryRun]'
  Write-Host 'Requires the age CLI on PATH and writes encrypted backups to private\exports\.'
  return
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$timestamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$stagingRoot = Join-Path $repoRoot "backups\staging\backup-$timestamp"
$payloadRoot = Join-Path $stagingRoot 'payload'
$zipPath = Join-Path $stagingRoot 'life-os-backup.zip'
$privateExports = Join-Path $repoRoot 'private\exports'
$encryptedPath = Join-Path $privateExports "backup-$timestamp.age"
$manifestPath = Join-Path $payloadRoot 'manifest.json'

Require-Age

$files = Get-ChildItem -Path (Join-Path $repoRoot 'data') -File -Recurse | ForEach-Object {
  $relative = Normalize-RelativePath (Get-LifeOsRelativePath -BasePath $repoRoot -FullPath $_.FullName)
  [PSCustomObject]@{
    RelativePath = $relative
    FullPath = $_.FullName
    SizeBytes = $_.Length
  }
} | Where-Object { -not (Should-ExcludePath $_.RelativePath) }

if ($files.Count -eq 0) {
  throw 'No eligible files were selected for backup.'
}

$fileCount = ($files | Measure-Object).Count
$byteCount = [long](($files | Measure-Object -Property SizeBytes -Sum).Sum)

$manifest = [ordered]@{
  backupVersion = 1
  createdAt = (Get-Date).ToString('o')
  sourceRoot = '.'
  includedPaths = @('data', 'data/opencode')
  excludedPatterns = @(
    '.env*',
    'gmail-token.json (any folder)',
    'gcp-oauth.keys.json (any folder)',
    'credential or token filenames',
    'private plaintext files',
    'node_modules/',
    '.next/',
    '.logs/',
    '*.log',
    'python-ai/.venv/',
    'python-ai/**/__pycache__/',
    'data/generated-cvs/',
    'data/playwright-auto-apply/'
  )
  fileCount = $fileCount
  byteCount = $byteCount
  encryptionMethod = 'zip+age'
  restoreInstructionsVersion = 1
  appName = 'Life-OS'
}

if ($DryRun) {
  Write-Host "Dry run only. Selected $fileCount files ($byteCount bytes)."
  Write-Host "Would write encrypted backup to: $encryptedPath"
  return
}

New-Item -ItemType Directory -Force -Path $payloadRoot | Out-Null
New-Item -ItemType Directory -Force -Path $privateExports | Out-Null

foreach ($file in $files) {
  $target = Join-Path $payloadRoot $file.RelativePath
  $targetDir = Split-Path -Parent $target
  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
  Copy-Item -Path $file.FullPath -Destination $target -Force
}

$manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -Encoding UTF8

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $payloadRoot '*') -DestinationPath $zipPath -Force

age --encrypt --recipient $Recipient --output $encryptedPath $zipPath

if (-not (Test-Path $encryptedPath)) {
  throw 'Encrypted backup file was not created.'
}

Remove-Item $stagingRoot -Recurse -Force

Write-Host "Encrypted backup created: $encryptedPath"
Write-Host "Files: $fileCount"
Write-Host "Bytes: $byteCount"
