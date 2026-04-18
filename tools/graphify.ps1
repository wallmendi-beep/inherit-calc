$ErrorActionPreference = 'Stop'

$graphifyExe = Join-Path $env:APPDATA 'Python\Python314\Scripts\graphify.exe'

if (-not (Test-Path $graphifyExe)) {
  throw "graphify.exe를 찾을 수 없습니다: $graphifyExe"
}

if ($args.Count -eq 0) {
  & $graphifyExe --help
  exit $LASTEXITCODE
}

if ($args[0] -match '^[./\\]' -and -not (Test-Path $args[0])) {
  New-Item -ItemType Directory -Force -Path $args[0] | Out-Null
}

& $graphifyExe @args
exit $LASTEXITCODE
