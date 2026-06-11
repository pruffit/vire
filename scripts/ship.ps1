# Сборка образов локально и выкатка на VPS.
# Использование:  .\scripts\ship.ps1 -Server root@SERVER_IP
# Образы собираются здесь (на сервере 1 ГБ next build не потянет), переносятся готовыми.
param(
  [Parameter(Mandatory = $true)][string]$Server,
  [string]$RemoteDir = "/opt/vire"
)
$ErrorActionPreference = "Stop"
$repo = Split-Path $PSScriptRoot -Parent
Set-Location $repo

Write-Host "==> Сборка vire-web и vire-worker" -ForegroundColor Cyan
docker build -f apps/web/Dockerfile    -t vire-web:latest    .
if ($LASTEXITCODE) { throw "build web failed" }
docker build -f apps/worker/Dockerfile -t vire-worker:latest .
if ($LASTEXITCODE) { throw "build worker failed" }

Write-Host "==> Экспорт образов в tar" -ForegroundColor Cyan
docker save vire-web:latest vire-worker:latest -o vire-images.tar
if ($LASTEXITCODE) { throw "docker save failed" }

Write-Host "==> Перенос на $Server`:$RemoteDir" -ForegroundColor Cyan
scp vire-images.tar "$Server`:$RemoteDir/"
if ($LASTEXITCODE) { throw "scp failed" }

Write-Host "==> Загрузка и рестарт на сервере" -ForegroundColor Cyan
$remote = @"
cd $RemoteDir
docker load -i vire-images.tar
docker compose -f docker-compose.prod.yml --env-file .env up -d
rm -f vire-images.tar
"@
ssh $Server $remote
if ($LASTEXITCODE) { throw "remote deploy failed" }

Remove-Item vire-images.tar -ErrorAction SilentlyContinue
Write-Host "==> Готово. Не забудь миграции при изменении схемы (см. docs/deployment.md)." -ForegroundColor Green
