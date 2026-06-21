# GlitchTip — self-hosted трекинг ошибок (замена sentry.io)

`sentry.io` блокирует доступ из РФ (403 Forbidden), а наш VPS (Timeweb) и аудитория —
в РФ/СНГ. **GlitchTip** — опенсорс, **wire-совместим с Sentry**: наш SDK
(`@sentry/nextjs` + `@sentry/node`) шлёт по тому же протоколу, поэтому **код Vire
не меняется** — только `SENTRY_DSN` указывает на свой GlitchTip.

Что попадёт в GlitchTip (уже подключено в коде, см. `docs/features/monitoring.md`):
клиентские JS-ошибки юзеров, серверные ошибки роутов/RSC, исключения воркера.

## Поднять (на VPS или отдельной мелкой машине, ~1–2 ГБ RAM)

```bash
cd ops/glitchtip
cp .env.example .env
# заполни SECRET_KEY (openssl rand -hex 32), POSTGRES_PASSWORD, GLITCHTIP_DOMAIN
docker compose up -d           # поднимет postgres, redis, web(:8080), worker; migrate отработает разово
docker compose logs -f web     # дождись готовности
```

За Caddy добавь свой домен (пример):
```
glitchtip.viremusic.ru {
    reverse_proxy localhost:8080
}
```

## Создать проект и получить DSN

1. Открой `GLITCHTIP_DOMAIN` в браузере.
2. Первый аккаунт: временно выстави `ENABLE_OPEN_USER_REGISTRATION=true` в `.env`,
   `docker compose up -d`, зарегистрируйся, затем верни `false` и `docker compose up -d`.
   (Письмо подтверждения уходит в `consolemail` → `docker compose logs web` — возьми ссылку.)
3. Создай **Organization** → **Project**, платформа **Next.js** (для web) — получишь **DSN**
   вида `https://<key>@glitchtip.viremusic.ru/<id>`. Один проект годится и для web, и для
   воркера; хочешь раздельно — заведи второй проект (Node) и дай воркеру отдельный DSN.

## Подключить к Vire

- **Сервер + воркер** (рантайм-env, VPS `.env`, оба `env_file`):
  ```
  SENTRY_DSN=https://<key>@glitchtip.viremusic.ru/<id>
  ```
- **Браузер** (build-time): добавь **GitHub-секрет** `NEXT_PUBLIC_SENTRY_DSN` = тот же DSN.
  На следующем деплое запечётся в клиентский бандл (build-arg уже проброшен в
  `apps/web/Dockerfile` и `.github/workflows/deploy.yml`).
- **CSP** разрешит origin автоматически: `connect-src` берёт его из самого DSN
  (`sentryOrigin()` в `apps/web/next.config.ts`) — отдельной правки не нужно.

## Алерты из GlitchTip → Telegram

В проекте GlitchTip → **Alerts** настрой уведомление на webhook → укажи URL
Cloudflare-релея (тот же, что `ALERT_WEBHOOK_URL`, см. `ops/telegram-alert-worker/`).
Так факт ошибки прилетит в Telegram, а детали/группировка останутся в GlitchTip.

## Заметки
- Образ закреплён на `glitchtip/glitchtip:v4.3` — перед апгрейдом сверь актуальный
  релиз на glitchtip.com и читай migration notes.
- Бэкап: том `glitchtip-pg` (Postgres GlitchTip). Не путать с основной БД Vire.
- Ресурсы: worker (celery) — самый прожорливый; на тесном VPS дай swap.
