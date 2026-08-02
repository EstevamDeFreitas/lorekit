[CmdletBinding()]
param(
  [ValidateSet('Server', 'Web', 'All')]
  [string]$Target = 'All',

  [ValidatePattern('^[a-z_][a-z0-9_-]*@[a-zA-Z0-9.-]+$')]
  [string]$Server = 'deploy@api.lorekit.online',

  [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$serverRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = Split-Path -Parent $serverRoot
$frontendRoot = Join-Path $repositoryRoot 'lorekit-frontend'
$sshOptions = @('-o', 'StrictHostKeyChecking=accept-new')

function Invoke-Checked {
  param(
    [Parameter(Mandatory)][string]$Command,
    [Parameter(ValueFromRemainingArguments)][string[]]$Arguments
  )
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "O comando '$Command' terminou com código $LASTEXITCODE."
  }
}

if ($Target -in @('Server', 'All')) {
  Write-Host 'Publicando API e migrations...'
  $serverParameters = @{ Server = $Server }
  if ($ValidateOnly) { $serverParameters['ValidateOnly'] = $true }
  & (Join-Path $PSScriptRoot 'publish-server.ps1') @serverParameters
}

if ($Target -notin @('Web', 'All')) { return }

$releaseId = [DateTimeOffset]::UtcNow.ToString('yyyyMMddHHmmss')
$archiveName = "lorekit-web-$releaseId.tar.gz"
$archivePath = Join-Path ([System.IO.Path]::GetTempPath()) $archiveName
$remoteArchive = "/tmp/$archiveName"
$remotePublisher = '/tmp/lorekit-publish-web-release.sh'

try {
  Write-Host 'Validando e construindo o frontend web...'
  Push-Location $frontendRoot
  try {
    Invoke-Checked -Command 'npm.cmd' -Arguments @('test', '--', '--watch=false', '--browsers=ChromeHeadless')
    Invoke-Checked -Command 'npm.cmd' -Arguments @('run', 'build:web')
  }
  finally {
    Pop-Location
  }

  $webDist = Join-Path $frontendRoot 'dist/lorekit-frontend/browser'
  if (-not (Test-Path -LiteralPath (Join-Path $webDist 'index.html'))) {
    throw "Build web não encontrado em $webDist."
  }

  $tarArguments = @(
    '-czf', $archivePath,
    '-C', $webDist, '.',
    '-C', $PSScriptRoot, 'Caddyfile.production'
  )
  Invoke-Checked -Command 'tar.exe' -Arguments $tarArguments

  if ($ValidateOnly) {
    Write-Host 'Build e pacote web validados; upload ignorado.' -ForegroundColor Green
    return
  }

  Invoke-Checked -Command 'scp' -Arguments ($sshOptions + @($archivePath, "${Server}:$remoteArchive"))
  Invoke-Checked -Command 'scp' -Arguments ($sshOptions + @(
    (Join-Path $PSScriptRoot 'publish-web-release.sh'),
    "${Server}:$remotePublisher"
  ))
  $remoteCommand = "sudo -v && sed -i 's/\r$//' $remotePublisher && bash $remotePublisher $remoteArchive"
  Invoke-Checked -Command 'ssh' -Arguments ($sshOptions + @('-tt', $Server, $remoteCommand))
  Write-Host 'Deploy web concluído com sucesso.' -ForegroundColor Green
}
finally {
  if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
  }
}
