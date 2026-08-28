# Деплой VireMusic на один VPS

Стек целиком в Docker Compose на одном сервере **Timeweb Cloud 2 × 3.3 ГГц / 2 ГБ / 40 ГБ + swap**.
Образы собирает **CI (GitHub Actions)** и пушит в **GHCR** — сервер их только тянет
(2 ГБ не потянет `next build`). Наружу торчит только Caddy (80/443) с авто-TLS.

> ⚠️ Апгрейд с 1 vCPU / 1 ГБ уже сделан. Решения, принятые под старое железо, требуют
> пересмотра — они перечислены в `../architecture/audit-2026-08.md` §6. Прежде всего:
> тюнинг Postgres (`shared_buffers=96MB` считался от 1 ГБ) и вывод «Sentry не влезает».

```
Caddy ──┬─ vire.example.ru      → web (Next.js standalone, :3000)
        └─ cdn.vire.example.ru  → minio (:9000, публичный bucket: обложки + HLS)
web / worker ── postgres · redis · minio   (внутренняя сеть, наружу не торчат)
```

## 0. Что нужно заранее
- VPS с Ubuntu 24.04, root/sudo по SSH.
- Домен и **две A-записи** на IP сервера: `vire.example.ru` и `cdn.vire.example.ru`.
- **Секреты GitHub** (Settings → Secrets and variables → Actions) для деплоя:
  - `SSH_HOST` — IP сервера
  - `SSH_USER` — пользователь (напр. `root`)
  - `SSH_KEY` — приватный SSH-ключ (публичный добавлен в `~/.ssh/authorized_keys` на сервере)
- (Опц.) Docker Desktop на рабочей машине — только для ручного фолбэка `ship.ps1`.

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

## 3. Деплой через CI/CD (основной путь)

### Ветки

| Ветка | Назначение | Что запускается |
|---|---|---|
| `dev` | текущая разработка | CI (gates) на каждый пуш |
| `main` | стабильный код | только через PR из `dev` |
| тег `vX.Y.Z` | релиз | полный deploy-пайплайн |

### Пайплайны

- **`.github/workflows/ci.yml`** — пуш в `dev` и PR в `main`/`dev`: typecheck · lint · test · design audit · build. Красный CI не мёржится.
- **`.github/workflows/deploy.yml`** — по тегу `vX.Y.Z` (или вручную: Actions → Deploy → Run workflow). Три последовательных job: **gates** → **build-and-push** (собирает образы в раннере, пушит в GHCR) → **deploy** (SSH на сервер: `compose pull && up -d` + миграции). Deploy не запускается если gates упали.

**Первый деплой** (инфраструктура поднимется тем же `up -d`):
```bash
# локально: пометить релиз и запушить тег
git tag v1.0.0
git push origin v1.0.0
```
Деплой-воркфлоу сам: соберёт → запушит в GHCR → зайдёт по SSH → `compose pull && up -d` (поднимет
postgres/redis/minio/caddy/web/worker) → прогонит миграции.

> GHCR-пакеты по умолчанию приватные. Деплой логинится на сервере через `GITHUB_TOKEN`.
> Если pull падает с denied — в GitHub: Packages → vire-web/vire-worker → Package settings →
> сделать **public**, либо связать пакет с репозиторием (Manage Actions access).

После первого деплоя — выдать себе админа (один раз, после входа на сайте):
```bash
docker compose -f docker-compose.prod.yml run --rm worker \
  pnpm --filter @vire/db exec tsx src/make-admin.ts you@example.com SUPERADMIN
```

Проверка: `docker compose -f docker-compose.prod.yml ps` — все healthy;
`https://<DOMAIN>` открывается с валидным TLS.

### Ручной фолбэк (если CI недоступен)
С рабочей машины (нужен Docker Desktop): `.\scripts\ship.ps1 -Server root@SERVER_IP` —
соберёт образы под GHCR-именами, перенесёт tar'ом, загрузит и поднимет. Миграции — командой выше.

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
Поднять версию в `package.json` + `SITE_VERSION` (`lib/site.ts`), затем тег:
```bash
git tag v1.0.1 && git push origin v1.0.1
```
Деплой-воркфлоу соберёт, запушит и накатит сам (включая миграции). `up -d` пересоздаёт
только изменившиеся контейнеры.

## Заметки
- **Скачивание FLAC (Этап 2)** в UI выключено, но presigned-ссылки уже подписываются под
  публичный хост (`S3_PUBLIC_ENDPOINT`, через Caddy → MinIO), так что заработают сразу при
  включении продаж. `cdn`-сабдомен проксирует весь MinIO; приватный vault защищён тем, что
  без валидной подписи отдаёт AccessDenied.
- **Транскод** идёт с `concurrency: 2` воркера на 2 ядрах — по задаче на ядро.
  Второе ядро добавлено (апгрейд выполнен), заливки редкие.
- **Рост:** первым кончится диск (vault FLAC). Тогда — `S3_ENDPOINT`/`S3_PUBLIC_ENDPOINT`
  на внешний S3 (одна правка `.env`), MinIO можно убрать.
