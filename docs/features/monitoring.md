# Мониторинг и алерты

Наблюдаемость без внешних платных сервисов: health-эндпоинт для uptime-чека,
структурированный лог ошибок и опциональные webhook-алерты (ошибки роутов +
упавшие джобы очередей).

## Что делает
- **Health-эндпоинт** `GET /api/health` — публичный, пингует Postgres и Redis.
  `200 {status:'ok'}` если всё живо, `503 {status:'degraded'}` если БД/Redis
  недоступны. Отдаёт версию. Подключается к внешнему uptime-чеку (UptimeRobot и т.п.).
- **Трекинг ошибок web** — `instrumentation.ts → onRequestError` ловит
  необработанные ошибки серверных роутов и передаёт в `captureError`.
- **Алерты воркера** — три уровня:
  - `failed` всех очередей (transcode, analyze, play-events, notify-release) →
    `alertJobFailure` (🔴 упавший джоб);
  - `error` воркера (обрыв Redis, сбой подключения — очередь могла встать) →
    `alertWorkerError` (🟠);
  - **падение процесса** (`uncaughtException` / `unhandledRejection`) →
    `alertCrash` (🛑), затем `process.exit(1)`. Алерт дожидается доставки до
    выхода, иначе воркер умирал бы молча, а загрузки застревали в PROCESSING.
- **Доставка** — алерт уходит во все настроенные каналы (любой/оба/ни одного);
  без настройки — только структурированный лог в stderr. Анти-шторм: одинаковый
  текст — не чаще раза в 60с на процесс (решение принимается один раз, до веера).
  - **Telegram (прямой)** — если заданы `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ALERT_CHAT_ID`,
    POST на `api.telegram.org/.../sendMessage`. ⚠️ С прод-VPS (Timeweb) **не работает**:
    egress на `api.telegram.org` заблокирован. Годится для окружений с доступом.
  - **Generic-webhook** — если задан `ALERT_WEBHOOK_URL`: POST JSON-ом (поля
    `text` для Slack, `content` для Discord, плюс structured-поля).

  **На проде** Telegram достигается через Cloudflare Worker-релей (`VPS → Worker →
  Telegram`), `ALERT_WEBHOOK_URL` указывает на него. Код и настройка —
  `ops/telegram-alert-worker/`. Discord/Slack с VPS доступны напрямую.

## Где код
- **API:** `apps/web/app/api/health/route.ts`
- **Web-трекинг:** `apps/web/instrumentation.ts`, `apps/web/lib/observability.ts`
  (`captureError`), `apps/web/lib/rate-limit.ts` (`pingRedis`)
- **Воркер:** `apps/worker/src/lib/alert.ts` (`alertJobFailure`,
  `alertWorkerError`, `alertCrash`), подключение — `apps/worker/src/index.ts`
- **Админ-обзор системы** (дополняет): `apps/web/lib/admin-health.ts` (`/admin` —
  пинг PG/Redis, очереди BullMQ с ошибками, live-слушатели)

## Env
- `TELEGRAM_BOT_TOKEN` — тот же токен, что для входа через Telegram (переиспользуется).
- `TELEGRAM_ALERT_CHAT_ID` — ID чата для алертов (личка/группа/канал). Пусто →
  Telegram-канал выключен.
- `ALERT_WEBHOOK_URL` — Discord/Slack-вебхук (POST JSON). Пусто → выключен.
- Любой/оба пустые → только лог. Переменные нужны и web, и worker (оба `env_file: .env`).
- БД/Redis health использует уже имеющиеся `DATABASE_URL` / `REDIS_URL`.

## Как подключить (прод)
1. **Uptime:** UptimeRobot (free) → HTTP(s)-монитор на `https://viremusic.ru/api/health`,
   ожидать код 200, интервал 5 мин. Алерт на почту/Telegram при не-200.
2. **Telegram-алерты:** написать боту (нажать Start) — иначе бот не сможет
   инициировать личку. Узнать `chat_id`: открыть
   `https://api.telegram.org/bot<TOKEN>/getUpdates`, взять `message.chat.id`.
   Положить `TELEGRAM_ALERT_CHAT_ID` в `.env` (web и worker), перезапустить.
3. **Discord/Slack (опц.):** создать Incoming Webhook, положить URL в
   `ALERT_WEBHOOK_URL`, перезапустить.

## Ограничения / на будущее
- Нет агрегации/трейсов/группировки как у Sentry — только точечные алерты + лог.
  Полноценный Sentry SDK (`@sentry/nextjs` + `@sentry/node`) можно навесить позже
  поверх `captureError`/`alertJobFailure` без переписывания вызовов.
- Троттлинг — per-process, in-memory: при нескольких репликах web/worker один и
  тот же алерт может прийти от каждой реплики.
- Стейджинг-окружение (отдельный VPS) — отложено до роста нагрузки.
