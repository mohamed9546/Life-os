param(
  [string]$Model = "qwen3.5:2b",
  [int]$NextPort = 3000,
  [int]$SidecarPort = 8800
)

$ErrorActionPreference = "Stop"

$env:LIFE_OS_LOCAL_ONLY = "true"
$env:NEXT_PUBLIC_LIFE_OS_LOCAL_ONLY = "true"
$env:OLLAMA_BASE_URL = "http://127.0.0.1:11434"
$env:OLLAMA_MODEL = $Model
$env:USE_PYTHON_AI = "true"
$env:PYTHON_AI_URL = "http://127.0.0.1:$SidecarPort"
$env:PYTHON_AI_AUTH = "none"
$env:LLM_URL = "http://127.0.0.1:11434/v1"
$env:LLM_MODEL = $Model
$env:LLM_JSON_MODE = "false"

function Pass([string]$Message) {
  Write-Host "[ok] $Message" -ForegroundColor Green
}

function Fail([string]$Message) {
  throw "[fail] $Message"
}

function Get-Json([string]$Url) {
  Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 15
}

function Post-Json([string]$Url, [object]$Body, [int]$TimeoutSec = 90) {
  Invoke-RestMethod `
    -Uri $Url `
    -Method Post `
    -ContentType "application/json" `
    -Body ($Body | ConvertTo-Json -Depth 10) `
    -TimeoutSec $TimeoutSec
}

Write-Host "Checking Life OS local stack..." -ForegroundColor Cyan

if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
  Fail "Ollama is not on PATH"
}

$ollamaTags = Get-Json "http://127.0.0.1:11434/api/tags"
$availableModels = @($ollamaTags.models | ForEach-Object { $_.name })
if ($availableModels -notcontains $Model) {
  Fail "Ollama model $Model is missing"
}
Pass "Ollama is running with $Model"

$sidecarHealth = Get-Json "http://127.0.0.1:$SidecarPort/health"
if (-not $sidecarHealth.ok) {
  Fail "Python sidecar is not healthy"
}
Pass "Python sidecar health is ok"

$settings = Get-Json "http://127.0.0.1:$NextPort/api/settings"
if (-not $settings.profile -or -not $settings.savedSearches) {
  Fail "Settings API returned an unexpected shape"
}
Pass "Settings API returns a normalized bundle"

$aiHealth = Get-Json "http://127.0.0.1:$NextPort/api/ai/health"
if ($aiHealth.config.provider -ne "ollama" -or $aiHealth.config.model -ne $Model) {
  Fail "Next AI config is not using Ollama/$Model"
}
Pass "Next AI health reports Ollama/$Model"

$rawJob = "Clinical Trial Assistant wanted in Glasgow. Entry-level role supporting trial master file maintenance and site activation paperwork. GCP awareness preferred. Full-time permanent role. Hybrid working."
$parse = Post-Json "http://127.0.0.1:$NextPort/api/ai/parse-job" @{ rawText = $rawJob } 300
if (-not $parse.success -or -not $parse.data.title) {
  Fail "parse-job failed"
}
Pass "parse-job completed with model $($parse.meta.model)"

$evaluate = Post-Json "http://127.0.0.1:$NextPort/api/ai/evaluate-job" @{ job = $parse.data } 360
if (-not $evaluate.success -or -not $evaluate.data.priorityBand) {
  Fail "evaluate-job failed"
}
Pass "evaluate-job completed with model $($evaluate.meta.model)"

Write-Host ""
Write-Host "Local stack looks good." -ForegroundColor Cyan
