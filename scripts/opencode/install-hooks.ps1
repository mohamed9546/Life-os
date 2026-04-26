$repoRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repoRoot "scripts\git-hooks\pre-commit"
$target = Join-Path $repoRoot ".git\hooks\pre-commit"

if (-not (Test-Path $source)) {
  throw "Hook template not found: $source"
}

Copy-Item $source $target -Force
Write-Host "Installed pre-commit hook to $target"
