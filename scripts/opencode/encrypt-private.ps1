param(
  [Parameter(Mandatory = $true)]
  [string]$InputFile,

  [Parameter(Mandatory = $true)]
  [string]$Recipient
)

$resolvedInput = Resolve-Path $InputFile
$outputFile = "$resolvedInput.age"

age --encrypt --recipient $Recipient --output $outputFile $resolvedInput
Write-Host "Encrypted to $outputFile"
