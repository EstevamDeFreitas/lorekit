[CmdletBinding()]
param(
  [ValidatePattern('^[a-z_][a-z0-9_-]*@[a-zA-Z0-9.-]+$')]
  [string]$Server = 'deploy@api.lorekit.online',

  [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$serverRoot = Split-Path -Parent $PSScriptRoot
$releaseId = [DateTimeOffset]::UtcNow.ToString('yyyyMMddHHmmss')
$archiveName = "lorekit-server-$releaseId.tar.gz"
$archivePath = Join-Path ([System.IO.Path]::GetTempPath()) $archiveName
$remoteArchive = "/tmp/$archiveName"
$remotePublisher = '/tmp/lorekit-publish-release.sh'
$sshOptions = @('-o', 'StrictHostKeyChecking=accept-new')

function Invoke-Checked {
  param(
    [Parameter(Mandatory)]
    [string]$Command,
    [Parameter(ValueFromRemainingArguments)]
    [string[]]$Arguments
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "O comando '$Command' terminou com codigo $LASTEXITCODE."
  }
}

try {
  Write-Host '1/5 Validando o backend...'
  Push-Location $serverRoot
  try {
    Invoke-Checked -Command 'npm.cmd' -Arguments @('run', 'typecheck')
    Invoke-Checked -Command 'npm.cmd' -Arguments @('test')
    Invoke-Checked -Command 'npm.cmd' -Arguments @('run', 'build')
  }
  finally {
    Pop-Location
  }

  Write-Host '2/5 Criando o pacote de publicação...'
  $packageItems = @(
    'Dockerfile',
    'package.json',
    'package-lock.json',
    'nest-cli.json',
    'tsconfig.json',
    'tsconfig.build.json',
    'drizzle.config.ts',
    'src',
    'drizzle',
    'deploy'
  )
  $tarArguments = @('-czf', $archivePath, '-C', $serverRoot) + $packageItems
  Invoke-Checked -Command 'tar.exe' -Arguments $tarArguments

  if ($ValidateOnly) {
    Write-Host 'Pacote local validado; upload ignorado por -ValidateOnly.' -ForegroundColor Green
    return
  }

  Write-Host "3/5 Enviando os arquivos para $Server..."
  Invoke-Checked -Command 'scp' -Arguments ($sshOptions + @(
      $archivePath,
      "${Server}:$remoteArchive"
    ))
  Invoke-Checked -Command 'scp' -Arguments ($sshOptions + @(
      (Join-Path $PSScriptRoot 'publish-release.sh'),
      "${Server}:$remotePublisher"
    ))

  Write-Host '4/5 Construindo e publicando na VPS...'
  $remoteCommand = "sudo -v && sed -i 's/\r$//' $remotePublisher && bash $remotePublisher $remoteArchive"
  Invoke-Checked -Command 'ssh' -Arguments ($sshOptions + @('-tt', $Server, $remoteCommand))

  Write-Host '5/5 Deploy concluído com sucesso.' -ForegroundColor Green
}
finally {
  if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
  }
}
