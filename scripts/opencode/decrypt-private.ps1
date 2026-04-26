param(
  [Parameter(Mandatory = $true)]
  [string]$InputFile,

  [Parameter(Mandatory = $true)]
  [string]$IdentityFile
)

$resolvedInput = Resolve-Path $InputFile
$outputFile = $resolvedInput -replace '\.age$', ''

age --decrypt --identity $IdentityFile --output $outputFile $resolvedInput
Write-Host "Decrypted to $outputFile"
