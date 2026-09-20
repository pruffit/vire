# План: единый инцидент Redis + сторож живости воркера

Спека: `../specs/2026-09-20-worker-stall-watchdog.md`. Всё внутри `apps/worker`.

## 1. `src/lib/redis-incident.ts` (новый)

Состояние инцидента переезжает сюда из `connection.ts` — его теперь ведут два источника
(события соединения и сторож), и владелец должен быть один.

```ts
export function isConnectionError(err: unknown): boolean
export function armRedisIncidents(): void          // первый успех: до него молчим
export function noteRedisDown(err: Error, now?: number): void   // идемпотентно в рамках инцидента
export function noteRedisUp(now?: number): void                 // закрывает 🟢, без инцидента — молчит
export function beginRedisShutdown(): void
export function reportWorkerError(queue: string, err: Error): void  // connection → инцидент, иначе → alertWorkerError
export function resetRedisIncident(): void         // только для тестов
```

Правила, которые обязаны сохраниться из текущего `connection.ts`: до первого `ready`
молчим (медленный старт Redis при деплое не должен давать ложную пару); при shutdown
молчим; повторный `down` внутри открытого инцидента нового алерта не даёт.

`now` — необязательный параметр, дефолт `Date.now()`: без него длительность простоя
не проверить тестом.

## 2. `src/queues/connection.ts`

Снять локальные `downSince`/`everReady`/`shuttingDown`, делегировать в трекер:
`close` → `noteRedisDown`, `ready` → `armRedisIncidents` + `noteRedisUp`,
`closeConnection` → `beginRedisShutdown`. Опции клиента не трогать.

## 3. `src/lib/alert.ts`

Добавить `alertStall(stalledMs: number)` — 🟠 «процесс или хост стоял N»,
`kind: 'stall'`. Остальные функции без изменений.

## 4. `src/queues/heartbeat.ts` (новый)

```ts
const INTERVAL_MS = 15_000;
const COMMAND_TIMEOUT_MS = 5_000;
const STALL_MS = 15 * 60_000;   // выше самого длинного лока (10 мин)
export function startHeartbeat(): void
export async function stopHeartbeat(): Promise<void>
```

Клиент — свой: `new Redis(REDIS_URL, { maxRetriesPerRequest: 1, commandTimeout: 5000,
enableOfflineQueue: false, connectTimeout: 5000, protocol: 2 })` + глухой `on('error')`
(без него ioredis роняет процесс необработанным событием).

Тик: сперва опоздание (`now - expectedAt > STALL_MS` → `alertStall`; больше минуты →
`console.warn`), затем `PING` — успех `armRedisIncidents` + `noteRedisUp`, ошибка
`noteRedisDown`. Тик не бросает наружу: `unhandledRejection` в этом процессе = `exit(1)`.
Провал `PING` дольше `STARTUP_GRACE_MS` (минута) от старта армит инцидент сам —
иначе после свода ошибок очередей старт в мёртвый Redis не даёт ни одного алерта.

## 5. `src/index.ts`

Все двенадцать `worker.on('error', …)` и шесть `.catch(…)` у `upsertJobScheduler`
переводятся с `void alertWorkerError(q, err)` на `reportWorkerError(q, err)`.
`startHeartbeat()` после создания воркеров, `stopHeartbeat()` — в `shutdown` перед
`closeConnection`.

## 6. Тесты

`src/lib/redis-incident.test.ts` — по образцу `alert.test.ts` (мок `fetch`,
`ALERT_WEBHOOK_URL`, `resetRedisIncident` в `beforeEach`):
- двенадцать `reportWorkerError` с разных очередей на `EAI_AGAIN` → ровно один POST;
- не-connection ошибка (`Missing lock … moveToFinished`) → уходит со своей очередью в тексте;
- `noteRedisUp` после простоя → один 🟢 с `downMs`; без открытого инцидента → тишина;
- до `armRedisIncidents` и после `beginRedisShutdown` → тишина;
- классификатор: `err.code` из списка и узкие тексты — да, произвольный текст — нет.

`src/queues/heartbeat.test.ts` — `vi.useFakeTimers()`, клиент замокан:
- тик с опозданием больше порога → `alertStall` с длительностью; в пределах порога → тишина;
- `PING` отвалился → 🟠 один раз на серию тиков; ответил → 🟢;
- ошибка внутри тика не всплывает наружу.

## 7. Документация

`docs/features/monitoring.md`, блок «Алерты воркера»: уровень «обрыв Redis» дополняется
тем, что в него вливаются ошибки очередей, и новым уровнем «сторож живости» с порогом
и его обоснованием. В «Где код» — два новых файла.

## Гейты

`pnpm --filter @vire/worker typecheck`, `pnpm --filter @vire/worker test`, плюс общий
`pnpm turbo run typecheck` и `pnpm --filter @vire/web test` (UI не трогаем — `audit:design`
не нужен).
