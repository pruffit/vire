# Мониторинг и алерты

Наблюдаемость без внешних платных сервисов: **алерты** (факт ошибки →
Telegram/webhook) + **health-эндпоинт** + структурированный лог в stderr.
Всегда включены, RAM на проде не едят.

> Внешний приёмник ошибок (Sentry/self-hosted GlitchTip) **намеренно не подключён** —
> решение принято на VPS с 1 ГБ; после апгрейда до 2 ГБ место появилось, остаётся
> только блокировка sentry.io в РФ (закрывается self-hosted GlitchTip). Тема — в бэклоге
> до апгрейда сервера (`../roadmap/TODO.md`).

## Что делает
- **Health-эндпоинт** `GET /api/health` — публичный, пингует Postgres и Redis.
  `200 {status:'ok'}` если всё живо, `503 {status:'degraded'}` если БД/Redis
  недоступны. Отдаёт версию. Подключается к внешнему uptime-чеку (UptimeRobot и т.п.).
- **Трекинг ошибок web** — `instrumentation.ts → onRequestError` ловит
  необработанные ошибки серверных роутов и передаёт в `captureError`.
  **Фильтр известного шума** (`isKnownNoise`): два паттерна апстрим-ошибок не
  алертятся (в stderr пишутся как `level:warn` + `knownNoise:true`):
  - `…transformAlgorithm is not a function` — спорадический баг Node ≥20.16
    webstreams при обрыве SSR-стрима (vercel/next.js#68319, #75994), фикса
    нет, на пользователей не влияет;
  - `Failed to find Server Action …` — вкладка со старым деплоем шлёт
    action-id, которого нет в новом билде; штатно после каждого релиза.
  Пустой `error.message` (брошен `new Error()`, объект, пустая строка) не даёт
  алерта вида «`🔴 [web] POST /ru:`»: `describeError` падает на имя ошибки и
  `digest`. Хвостом идёт `[routeType routePath renderSource]` (`formatAlertText`):
  `routeType` различает server action, рендер страницы, route handler и proxy,
  `renderSource` — RSC-рендер от SSR клиентских компонентов. **При пустом message**
  под основной строкой идут ещё и шесть верхних кадров стека (`stackHead`) — без них
  место стоит похода по SSH в логи контейнера, а деплой их стирает. Ключ анти-шторма
  при этом остаётся текстом **без** кадров — иначе разошедшийся верхний кадр развалил
  бы схлопывание дубликатов. Полный стек (обрезка 2000) идёт в structured-лог и полем
  `stack` в payload вебхука; прод-релей это поле отбрасывает (читает только `text`),
  оно пригодится, если `ALERT_WEBHOOK_URL` будет указывать прямо на Slack/Discord.

  Ради чего это сделано: production-сборка **next-intl** оборачивает
  `useTranslations`/`useFormatter` в `try{...}catch{throw new Error(void 0)}`
  (`dist/esm/production/react-client/index.js`) — оригинал теряется целиком, и любой
  сбой внутри этих хуков приходит безмолвным. Разбор повторяющегося алерта
  `POST /ru … digest=3916268529` — `../superpowers/specs/2026-09-19-silent-error-alert-location.md`
  (там же: почему `routeType: action` на главной не означает наш server action).
- **Алерты воркера** — пять уровней:
  - `failed` всех очередей (transcode, analyze, play-events, notify-release) →
    `alertJobFailure` (🔴 упавший джоб);
  - `error` воркера, если это не обрыв соединения (например, `Missing lock …
    moveToFinished` — потеря работы, а не связи) → `alertWorkerError` (🟠) со
    своей очередью в тексте;
  - **обрыв соединения с Redis** — сведён в один общий инцидент `redis`,
    независимо от того, кто из двенадцати воркеров его первым заметил: и
    `close`/`ready` общего инстанса (`connection.ts`), и `error` каждого
    отдельного воркера (у каждого своё блокирующее соединение), если ошибка
    классифицируется как обрыв (по `err.code` — `ECONNREFUSED`, `EAI_AGAIN`,
    `ECONNRESET` и т.п., либо по узким текстам ioredis), — 🟠 один раз на
    инцидент, восстановление → `alertRecovered` (🟢) с длительностью простоя.
    🟢 придерживается на минуту: обрыв внутри этого окна — продолжение той же
    серии, а не новый инцидент, иначе моргающая сеть вернула бы веер с другой
    стороны (у каждого блипа своя длительность в тексте, и троттл по тексту
    его не ловит).
    Без этого свода один обрыв 20.09 дал шестнадцать сообщений за три минуты (по
    одному на очередь, часть — дважды), а `maxRetriesPerRequest: null`,
    обязательный для блокирующих команд bullmq, всё равно прятал сам факт
    обрыва в момент, когда он произошёл (инциденты 06.09.2026 и 20.09.2026);
  - **сторож живости** (`heartbeat.ts`) — раз в 15с пингует Redis отдельным
    клиентом с `commandTimeout` и без офлайн-очереди (общий инстанс с
    `maxRetriesPerRequest: null` для этого не годится: его `PING` повиснет
    так же, как всё остальное, и сторож унаследует ту слепоту, которую должен
    закрывать). Неудачный/зависший `PING` открывает тот же инцидент `redis`;
    если Redis не ответил ни разу за минуту после старта процесса, инцидент
    открывается и без предшествующего успеха — воркер, поднявшийся в мёртвый
    Redis, иначе молчал бы совсем.
    Отдельно: если сам тик пришёл с опозданием больше 15 минут — алерт
    «процесс или хост стояли N» (🟠, `kind: stall`). Это единственный сигнал,
    видящий заморозку хоста целиком (своп, снапшот, завис весь VPS): пока
    машина не исполняется, ошибок не возникает, а после разморозки таймер
    просыпается с опозданием на всю длину простоя. Порог выбран выше самого
    длинного лока процесса (10 минут у transcode/analyze/analyze-genre) —
    иначе штатная блокировка event loop на ffmpeg/ONNX давала бы ложный алерт
    на каждом тяжёлом релизе;
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
  `alertWorkerError`, `alertRecovered`, `alertStall`, `alertCrash`),
  подключение — `apps/worker/src/index.ts`; состояние инцидента Redis —
  `apps/worker/src/lib/redis-incident.ts` (общее для соединения bullmq и
  сторожа); слушатели соединения — `apps/worker/src/queues/connection.ts`;
  сторож живости — `apps/worker/src/queues/heartbeat.ts`
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
- **Внешний приёмник ошибок (Sentry/GlitchTip) не подключён.** sentry.io блокирует РФ,
  а self-hosted GlitchTip не разворачивали (решение принято ещё на 1 ГБ). Поэтому детального
  стектрейса/группировки и **клиентских JS-ошибок** пока нет — только факт ошибки в
  Telegram + структурированный лог. Вернуться к теме после апгрейда сервера (`../roadmap/TODO.md`).
- Троттлинг (Telegram/webhook) — per-process, in-memory: при нескольких репликах web/worker
  один и тот же алерт может прийти от каждой реплики.
- Стейджинг-окружение (отдельный VPS) — отложено до роста нагрузки.
