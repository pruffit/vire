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
- **Алерты воркера** — обработчики `failed` всех очередей (transcode, analyze,
  play-events, notify-release) шлют `alertJobFailure`.
- **Webhook** — если задан `ALERT_WEBHOOK_URL`, ошибки/падения POST-ятся туда
  JSON-ом (поля `text` для Slack, `content` для Discord, плюс structured-поля).
  Анти-шторм: одинаковый текст — не чаще раза в 60с на процесс. Без URL —
  только структурированный лог в stderr.

## Где код
- **API:** `apps/web/app/api/health/route.ts`
- **Web-трекинг:** `apps/web/instrumentation.ts`, `apps/web/lib/observability.ts`
  (`captureError`), `apps/web/lib/rate-limit.ts` (`pingRedis`)
- **Воркер:** `apps/worker/src/lib/alert.ts` (`alertJobFailure`),
  подключение — `apps/worker/src/index.ts`
- **Админ-обзор системы** (дополняет): `apps/web/lib/admin-health.ts` (`/admin` —
  пинг PG/Redis, очереди BullMQ с ошибками, live-слушатели)

## Env
- `ALERT_WEBHOOK_URL` — куда слать алерты (POST JSON). Discord/Slack-вебхук или
  прокси к Telegram-боту. Пусто → только лог. Нужна и web, и worker.
- БД/Redis health использует уже имеющиеся `DATABASE_URL` / `REDIS_URL`.

## Как подключить (прод)
1. **Uptime:** UptimeRobot (free) → HTTP(s)-монитор на `https://viremusic.ru/api/health`,
   ожидать код 200, интервал 5 мин. Алерт на почту/Telegram при не-200.
2. **Webhook ошибок:** создать Incoming Webhook в Discord/Slack (или бот-прокси
   Telegram), положить URL в `ALERT_WEBHOOK_URL` в `.env` web и worker, перезапустить.

## Ограничения / на будущее
- Нет агрегации/трейсов/группировки как у Sentry — только точечные алерты + лог.
  Полноценный Sentry SDK (`@sentry/nextjs` + `@sentry/node`) можно навесить позже
  поверх `captureError`/`alertJobFailure` без переписывания вызовов.
- Троттлинг — per-process, in-memory: при нескольких репликах web/worker один и
  тот же алерт может прийти от каждой реплики.
- Стейджинг-окружение (отдельный VPS) — отложено до роста нагрузки.
