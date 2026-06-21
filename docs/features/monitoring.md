# Мониторинг и алерты

Два слоя наблюдаемости, работают независимо:
1. **Алерты** (факт ошибки → Telegram/webhook) + health-эндпоинт + структурированный
   лог — без внешних платных сервисов, всегда включены.
2. **Sentry** (детальный стектрейс, группировка, **клиентские JS-ошибки**) —
   опционально, рядом с алертами; включается DSN'ом.

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

- **Sentry (опц., DSN-gated)** — богатый бэкенд ошибок рядом с алертами. Без `SENTRY_DSN`
  полностью выключен (init не вызывается, capture — no-op). Что ловит:
  - **клиентские JS-ошибки** у реальных юзеров (`instrumentation-client.ts` +
    error-boundary'ы `app/error.tsx`/`app/global-error.tsx`) — раньше их не ловил никто;
  - **серверные ошибки роутов/RSC** — `onRequestError → captureRequestError` (рядом с
    существующим `captureError`-алертом);
  - **исключения воркера** — `captureWorkerException` из `alertJobFailure`/
    `alertWorkerError`/`alertCrash`; на крэше `flushSentry()` перед `exit(1)`.

  Telegram даёт «тебя пингнули», Sentry — «полный стектрейс + группировка + частота».
  Выборка трейсов `tracesSampleRate: 0.1`, PII (email/ip) не шлём.

## Где код
- **API:** `apps/web/app/api/health/route.ts`
- **Web-трекинг:** `apps/web/instrumentation.ts`, `apps/web/lib/observability.ts`
  (`captureError`), `apps/web/lib/rate-limit.ts` (`pingRedis`)
- **Воркер:** `apps/worker/src/lib/alert.ts` (`alertJobFailure`,
  `alertWorkerError`, `alertCrash`), подключение — `apps/worker/src/index.ts`
- **Sentry:** web — `apps/web/instrumentation-client.ts` (клиент),
  `apps/web/instrumentation.ts` (сервер + `register()`), error-boundary'ы;
  воркер — `apps/worker/src/lib/sentry.ts` (`initSentry`/`captureWorkerException`/
  `flushSentry`). CSP `connect-src` пропускает `*.ingest.sentry.io` (`next.config.ts`).
- **Админ-обзор системы** (дополняет): `apps/web/lib/admin-health.ts` (`/admin` —
  пинг PG/Redis, очереди BullMQ с ошибками, live-слушатели)

## Env
- `TELEGRAM_BOT_TOKEN` — тот же токен, что для входа через Telegram (переиспользуется).
- `TELEGRAM_ALERT_CHAT_ID` — ID чата для алертов (личка/группа/канал). Пусто →
  Telegram-канал выключен.
- `ALERT_WEBHOOK_URL` — Discord/Slack-вебхук (POST JSON). Пусто → выключен.
- Любой/оба пустые → только лог. Переменные нужны и web, и worker (оба `env_file: .env`).
- БД/Redis health использует уже имеющиеся `DATABASE_URL` / `REDIS_URL`.
- `SENTRY_DSN` — сервер (web-роуты/RSC) + воркер; `NEXT_PUBLIC_SENTRY_DSN` — браузер
  (тот же DSN из проекта Sentry). Пусто → Sentry выключен. `NEXT_PUBLIC_SENTRY_DSN`
  и CSP пекутся на build-time → в Docker передаются build-args (как `S3_PUBLIC_ENDPOINT`).

## Как подключить (прод)
1. **Uptime:** UptimeRobot (free) → HTTP(s)-монитор на `https://viremusic.ru/api/health`,
   ожидать код 200, интервал 5 мин. Алерт на почту/Telegram при не-200.
2. **Telegram-алерты:** написать боту (нажать Start) — иначе бот не сможет
   инициировать личку. Узнать `chat_id`: открыть
   `https://api.telegram.org/bot<TOKEN>/getUpdates`, взять `message.chat.id`.
   Положить `TELEGRAM_ALERT_CHAT_ID` в `.env` (web и worker), перезапустить.
3. **Discord/Slack (опц.):** создать Incoming Webhook, положить URL в
   `ALERT_WEBHOOK_URL`, перезапустить.

## Как подключить (прод) — через GlitchTip, НЕ sentry.io
⚠️ **sentry.io блокирует РФ** (403 Forbidden): ни завести проект, ни слать ingest с
российского VPS/аудитории нельзя. Поэтому приёмник — **self-hosted GlitchTip**
(wire-совместим с Sentry, наш SDK не меняется). Развёртывание и получение DSN —
`ops/glitchtip/README.md`. Дальше:
1. `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` (DSN своего GlitchTip) — `SENTRY_DSN` в
   VPS `.env` (web+worker, рантайм); `NEXT_PUBLIC_SENTRY_DSN` — GitHub-секрет
   (build-arg уже проброшен в `Dockerfile`/`deploy.yml`).
2. CSP пропустит origin сам — `connect-src` берёт его из DSN (`sentryOrigin()`).
3. Перезапуск/деплой — ошибки пойдут в GlitchTip. Тест: кинуть исключение в роуте/клиенте.

## Ограничения / на будущее
- **Source maps не загружаются** — стектрейсы в Sentry минифицированы. Чтобы читались,
  добавить upload (через `withSentryConfig` + `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/
  `SENTRY_PROJECT` в CI, либо `sentry-cli`). Пока пропущено: не блокирует капчер ошибок,
  а Turbopack-сборка + плагин — отдельная настройка. Vars уже зарезервированы в `.env.example`.
- **Дедуп drizzle-orm:** `@sentry/node` тянет OpenTelemetry → drizzle-orm подхватывает
  опц. peer `@opentelemetry/api` и в дереве появляется второй экземпляр, ломавший типы.
  Зафиксировано tsconfig-`paths` в `apps/web` (drizzle-orm резолвится в копию `@vire/db`).
- Троттлинг (Telegram/webhook) — per-process, in-memory: при нескольких репликах web/worker
  один и тот же алерт может прийти от каждой реплики. Sentry группирует сам.
- Стейджинг-окружение (отдельный VPS) — отложено до роста нагрузки.
