# Деплой Vire на один VPS

Стек целиком в Docker Compose на одном сервере **Timeweb Cloud 1 vCPU / 1 ГБ / 40 ГБ + swap**.
Образы собираются **не на сервере** (1 ГБ не потянет `next build`), а локально/в CI и
переносятся готовыми. Наружу торчит только Caddy (80/443) с авто-TLS.

```
Caddy ──┬─ vire.example.ru      → web (Next.js standalone, :3000)
        └─ cdn.vire.example.ru  → minio (:9000, публичный bucket: обложки + HLS)
web / worker ── postgres · redis · minio   (внутренняя сеть, наружу не торчат)
```

## 0. Что нужно заранее
- VPS с Ubuntu 24.04, root/sudo по SSH.
- Домен и **две A-записи** на IP сервера: `vire.example.ru` и `cdn.vire.example.ru`.
- Docker Desktop на рабочей машине (для сборки образов).

## 1. Подготовка сервера (один раз)

```bash
# Docker + compose-plugin
curl -fsSL https://get.docker.com | sh

# Swap 4 ГБ — подушка от OOM на пиках транскода (на NVMe почти незаметна)
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
# меньше агрессии свопа: трогать только при реальной нехватке
echo 'vm.swappiness=10' >> /etc/sysctl.conf && sysctl -p

mkdir -p /opt/vire && cd /opt/vire
```

Скопируй на сервер в `/opt/vire`: `docker-compose.prod.yml`, `Caddyfile`, `scripts/backup.sh`.

## 2. Конфиг окружения

На сервере: `cp .env.production.example .env` и заполни (`.env.production.example` —
в репозитории). Критично:
- `DOMAIN`, `CDN_DOMAIN`, `ACME_EMAIL` — Caddy выпустит по ним TLS.
- `POSTGRES_PASSWORD` и `DATABASE_URL` — пароль должен совпадать в обоих.
- `S3_SECRET_KEY` — длинный; `S3_PUBLIC_ENDPOINT=https://<CDN_DOMAIN>`.
- `AUTH_SECRET` — `openssl rand -base64 32`.
- OAuth redirect URI в кабинетах провайдеров → `https://<DOMAIN>/api/auth/callback/<provider>`.

## 3. Сборка образов (на рабочей машине)

Из корня репо. PowerShell:
```powershell
docker build -f apps/web/Dockerfile    -t vire-web:latest    .
docker build -f apps/worker/Dockerfile -t vire-worker:latest .
docker save vire-web:latest vire-worker:latest -o vire-images.tar
```
Или одной командой — `scripts/ship.ps1` (сборка + перенос + загрузка + рестарт).

## 4. Перенос и запуск

```powershell
scp vire-images.tar root@SERVER_IP:/opt/vire/
```
На сервере:
```bash
cd /opt/vire
docker load -i vire-images.tar

# Поднять инфраструктуру и приложение
docker compose -f docker-compose.prod.yml --env-file .env up -d

# Миграции БД (ops-образ = worker: в нём tsx + @vire/db)
docker compose -f docker-compose.prod.yml run --rm worker \
  pnpm --filter @vire/db exec tsx src/migrate.ts

# Выдать себе админа (после первого входа на сайте)
docker compose -f docker-compose.prod.yml run --rm worker \
  pnpm --filter @vire/db exec tsx src/make-admin.ts you@example.com SUPERADMIN
```

Проверка: `docker compose -f docker-compose.prod.yml ps` — все healthy;
`https://<DOMAIN>` открывается с валидным TLS.

## 5. Бэкапы (обязательно)

Единственная защита от смерти диска. Заполни `BACKUP_S3_*` в `.env` (внешний холодный
S3 — Timeweb S3 или Backblaze B2), затем cron:
```bash
chmod +x scripts/backup.sh
crontab -e
# 0 4 * * *  cd /opt/vire && ./scripts/backup.sh >> /var/log/vire-backup.log 2>&1
```
> Имя сети в `backup.sh` (`vire_default`) = `<имя_папки>_default`. Папка `/opt/vire`
> → проект `vire` → сеть `vire_default`. Проверь: `docker network ls`.

## 6. Обновление (выкатка новой версии)
Повтори шаги 3–4 (`ship.ps1`), затем при изменении схемы — миграции из шага 4.
`docker compose ... up -d` пересоздаёт только изменившиеся контейнеры.

## Заметки
- **Скачивание FLAC (Этап 2)** в UI выключено, но presigned-ссылки уже подписываются под
  публичный хост (`S3_PUBLIC_ENDPOINT`, через Caddy → MinIO), так что заработают сразу при
  включении продаж. `cdn`-сабдомен проксирует весь MinIO; приватный vault защищён тем, что
  без валидной подписи отдаёт AccessDenied.
- **Транскод** идёт на 1 ядре с `concurrency` воркера — заливки редкие, это норма.
  Если станет узким местом — добавь 2-е ядро в Timeweb (без переезда).
- **Рост:** первым кончится диск (vault FLAC). Тогда — `S3_ENDPOINT`/`S3_PUBLIC_ENDPOINT`
  на внешний S3 (одна правка `.env`), MinIO можно убрать.
