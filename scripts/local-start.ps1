param(
  [string]$Model = "qwen3.5:2b",
  [int]$NextPort = 3000,
  [int]$SidecarPort = 8800
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$PythonDir = Join-Path $Root "python-ai"
$PythonExe = Join-Path $PythonDir ".venv\Scripts\python.exe"

function Test-HttpOk([string]$Url) {
  try {
    Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 4 | Out-Null
    return $true
  } catch {
    return $false
  }
}

Write-Host "Life OS local stack" -ForegroundColor Cyan
Write-Host "Model: $Model"

if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
  throw "Ollama is not installed or not on PATH. Install Ollama, then rerun this script."
}

if (-not (Test-HttpOk "http://127.0.0.1:11434/api/tags")) {
  Write-Host "Starting Ollama..." -ForegroundColor Yellow
  Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Minimized | Out-Null
  Start-Sleep -Seconds 4
}

$models = (& ollama list) -join "`n"
if ($models -notmatch [regex]::Escape($Model)) {
  Write-Host "Pulling missing model $Model..." -ForegroundColor Yellow
  & ollama pull $Model
}

if (-not (Test-Path $PythonExe)) {
  Write-Host "Creating Python virtualenv..." -ForegroundColor Yellow
  Push-Location $PythonDir
  python -m venv .venv
  & $PythonExe -m pip install -q -e ".[dev]"
  Pop-Location
}

$envBlock = @"
`$env:LIFE_OS_LOCAL_ONLY='true'
`$env:NEXT_PUBLIC_LIFE_OS_LOCAL_ONLY='true'
`$env:OLLAMA_BASE_URL='http://127.0.0.1:11434'
`$env:OLLAMA_MODEL='$Model'
`$env:USE_PYTHON_AI='true'
`$env:PYTHON_AI_URL='http://127.0.0.1:$SidecarPort'
`$env:PYTHON_AI_AUTH='none'
`$env:LLM_URL='http://127.0.0.1:11434/v1'
`$env:LLM_MODEL='$Model'
`$env:LLM_JSON_MODE='false'
"@

$sidecarCommand = @"
$envBlock
`$env:PORT='$SidecarPort'
Set-Location '$PythonDir'
& '$PythonExe' -m life_os_ai
"@

$nextCommand = @"
$envBlock
Set-Location '$Root'
npm run dev -- --port $NextPort
"@

Write-Host "Starting Python sidecar on :$SidecarPort..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", $sidecarCommand | Out-Null
Start-Sleep -Seconds 3

Write-Host "Starting Next.js on :$NextPort..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", $nextCommand | Out-Null

Write-Host ""
Write-Host "Open http://127.0.0.1:$NextPort/settings" -ForegroundColor Cyan
Write-Host "Run npm run local:doctor after the two terminals finish starting."

