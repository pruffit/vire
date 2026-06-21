---
name: vire-queues
description: Use when working with Vire's background jobs and database access — BullMQ queues/workers (transcode, play-events, notify-release, analyze, editorial, scheduled-publish, fulfill-presave) and Drizzle ORM queries, repositories, migrations, transactions. Covers queue/worker setup, retry/backoff, idempotency & jobId dedup, the producer (apps/web/lib/queue.ts) vs consumer (apps/worker) split, Redis connection options, and Drizzle gotchas with raw sql/Date binding. Use when adding a job type, debugging stuck/failed jobs, or writing a repository query.
version: 1.0.0
user-invocable: true
---

# Vire — очереди (BullMQ) + БД (Drizzle)

Producer (web): `apps/web/lib/queue.ts`. Consumer (worker):
`apps/worker/src/workers/*.worker.ts` + `apps/worker/src/queues/connection.ts`.
Имена очередей и типы job-data — в `@vire/core` (`QUEUE_*`, `*JobData`) — единый
источник правды для обеих сторон.

## Разделение producer / consumer

- **Web ставит задачи**, **worker их исполняет**. Оба берут имя очереди и тип
  данных из `@vire/core` — рассинхрона быть не может.
- Очереди в web — **синглтоны через globalThis** (переживают HMR в dev, не плодят
  Redis-соединения):

```ts
const g = globalThis as unknown as { _transcodeQueue?: TranscodeQueue };
export const transcodeQueue = g._transcodeQueue ?? new TranscodeQueue();
if (process.env.NODE_ENV !== 'production') g._transcodeQueue = transcodeQueue;
```

## Redis-соединение

```ts
// apps/worker/src/queues/connection.ts
export const connection = {
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  maxRetriesPerRequest: null,   // ОБЯЗАТЕЛЬНО для блокирующих команд BullMQ
};
```

Тот же `REDIS_URL`, что и presence (`lib/presence.ts`), но presence ходит в Redis
напрямую через ioredis — **отдельно** от BullMQ-очередей.

## defaultJobOptions — задаются на Queue (producer), не на Worker

```ts
new Queue(QUEUE_TRANSCODE, { connection, defaultJobOptions: {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },   // DLQ-поведение: храним N упавших для разбора
}});
```

⚠️ Retry/backoff/removeOnFail — опции **Queue**, не Worker. В воркере задаём только
`concurrency`.

## Идемпотентность и дедупликация

- **Идемпотентность обработчика**: первым делом проверь текущее состояние и выйди,
  если работа уже сделана (transcode: `if status==='READY' return`).
- **Дедуп постановки**: задавай `jobId`, чтобы повторное нажатие кнопки не плодило
  задачи — `analyzeQueue.add(data, { jobId: 'analyze-' + data.trackId })`.
- **Терминальное падение**: ловится `worker.on('failed')`; переход в `FAILED` —
  только из ожидаемого состояния (`where status='PROCESSING'`), хвост **не бросает**.

## Добавить новый тип job

1. Объяви `QUEUE_X` + `XJobData` в `@vire/core`.
2. Producer-класс в `apps/web/lib/queue.ts` (синглтон через globalThis,
   `defaultJobOptions`).
3. `createXWorker()` в `apps/worker/src/workers/x.worker.ts`, зарегистрируй в
   `apps/worker/src/index.ts` + `on('failed')` для терминальной обработки.
4. Тест обработчика чистыми функциями над job.data, эффекты — за интерфейсами.

## Drizzle — грабли (из CLAUDE.md, соблюдать)

- **Не интерполируй JS-`Date` в raw-`sql`-шаблон**: postgres.js получит её как
  нетипизированный bind → `ERR_INVALID_ARG_TYPE: Received an instance of Date`.
  Считай дату в SQL: `now() - interval '7 days'`. Через
  `.set({ updatedAt: new Date() })` на типizированной timestamp-колонке — можно.
- **Не интерполируй колонку (`${tracks.id}`) в `sql` внутри `.select()`** — Drizzle
  рендерит без квалификации (`"id"`): «column reference is ambiguous» или тихий 0 в
  коррелированном подзапросе. Ссылайся на внешнюю таблицу литералом
  (`where f.artist_profile_id = artist_profiles.id`).
- Транзакции: атомарные мульти-таблично записи — `db.transaction(async (tx) => …)`
  (см. transcode READY-транзакцию и `DrizzleReleaseRepository.delete`).
- FK без `ON DELETE CASCADE` — чисти зависимые строки вручную в транзакции
  (см. `release.ts:delete`).
- Гард `isUuid` (`@vire/core`) перед запросом по uuid-PK — иначе Postgres кидает
  `invalid input syntax for type uuid` (исключение, не пустой результат) → 500.

Команды БД: `pnpm --filter @vire/db db:{generate,migrate,studio}`.
