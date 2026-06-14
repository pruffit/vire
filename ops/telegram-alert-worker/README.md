# Telegram-релей алертов (Cloudflare Worker)

Прод-VPS не имеет egress на `api.telegram.org` (заблокирован у Timeweb), поэтому
алерты идут в Telegram через этот Worker: `VPS → Worker (reachable) → Telegram`.
Discord/Slack с VPS доступны напрямую — если устроит другой мессенджер, прокси не нужен,
достаточно вебхука в `ALERT_WEBHOOK_URL` (см. `docs/features/monitoring.md`).

## Деплой через дашборд (без CLI)

1. **dash.cloudflare.com → Workers & Pages → Create → Worker.** Имя, напр. `vire-alert`. Deploy.
2. **Edit code** → вставить `worker.js` из этой папки → Deploy.
3. **Settings → Variables and Secrets:**
   - `ALERT_SECRET` (Secret) — длинная случайная строка, напр. `openssl rand -hex 24`.
   - `TG_TOKEN` (Secret) — токен бота (тот же, что `TELEGRAM_BOT_TOKEN` для входа).
   - `TG_CHAT_ID` (Plaintext) — куда слать (твой user id или id группы).
4. URL воркера: `https://vire-alert.<поддомен>.workers.dev`.
   Полный URL для алертов: `https://vire-alert.<поддомен>.workers.dev/<ALERT_SECRET>`.

## Подключение на VPS (`/opt/vire/.env`)

```
ALERT_WEBHOOK_URL=https://vire-alert.<поддомен>.workers.dev/<ALERT_SECRET>
# TELEGRAM_ALERT_CHAT_ID убрать/оставить пустым — прямой путь с VPS всё равно
# не работает (egress блокирован) и только добавлял бы 5с таймаута на алерт.
```
Затем пересоздать контейнеры:
```
docker compose -f docker-compose.prod.yml --env-file .env up -d --force-recreate web worker
```

## Проверка

```
curl -sS -m 10 -X POST "https://vire-alert.<поддомен>.workers.dev/<ALERT_SECRET>" \
  -H 'Content-Type: application/json' -d '{"text":"проверка релея"}'; echo
```
`{"ok":true,...}` + сообщение в чат → готово. `404` → не тот `ALERT_SECRET` в пути.
`{"ok":false,...Forbidden...}` → не нажат Start у бота.
