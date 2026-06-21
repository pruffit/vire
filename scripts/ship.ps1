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

# Имена образов = как в docker-compose.prod.yml (GHCR), чтобы compose их нашёл
$web = "ghcr.io/pruffit/vire-web:latest"
$worker = "ghcr.io/pruffit/vire-worker:latest"

Write-Host "==> Сборка vire-web и vire-worker" -ForegroundColor Cyan
docker build -f apps/web/Dockerfile    -t $web    .
if ($LASTEXITCODE) { throw "build web failed" }
docker build -f apps/worker/Dockerfile -t $worker .
if ($LASTEXITCODE) { throw "build worker failed" }

Write-Host "==> Экспорт образов в tar" -ForegroundColor Cyan
docker save $web $worker -o vire-images.tar
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
Write-Host "==> Готово. Не забудь миграции при изменении схемы (см. docs/ops/deployment.md)." -ForegroundColor Green
