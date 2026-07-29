# План: убрать лаги звука в джеме (переработка синхронизации)

## Диагноз

1. **Стартовое отставание.** `use-playback-sync` при смене трека делает
   `load() → seek(derivePositionMs(...)) → play()`. Позиция считается ДО того, как HLS
   реально начал звучать: манифест + первый сегмент (6с чанки) грузятся 1–3с, и всё это
   время серверные часы уходят вперёд. Клиент стабильно отстаёт на время буферизации.
2. **Постоянная подгонка.** Отставание из п.1 попадает в диапазон rate-коррекции —
   браузер гонит звук через тайм-стретчер (`preservesPitch`) минутами. Это слышно как
   «каша». При отставании >2с — жёсткий seek, слышен как заикание.
3. **Одиночный джем.** Ничего из этого не нужно, когда звуковое устройство одно —
   синхронизировать не с кем, но коррекция всё равно работает.

## Фикс

### A. Отказ от rate-коррекции (`packages/core/src/services/jam-sync.ts`)

Тайм-стретч убирается совсем: `DriftAction` = `{ kind: 'none' } | { kind: 'seek'; toMs }`.
- Удалить `RATE_DELTA`, `RATE_CORRECT_MIN_MS`, `CONVERGED_MS`, `RATE_STUCK_MS`,
  `msInRateCorrection` и ветки rate из `decideDriftCorrection` (сигнатура теряет
  `currentRate`; поправить всех вызывающих).
- Остаётся: буферизация/кулдаун → `none`; `|drift| > HARD_SEEK_MS` (2000) → `seek`; иначе `none`.
- `SEEK_COOLDOWN_MS` 3000 → 10_000.
- Тесты `jam-sync.test.ts` переписать под новый контракт (rate-кейсы удалить).

### B. Привязка позиции к реальному старту звука

`apps/web/lib/jam/jam-audio.ts`:
- Добавить в `JamAudioEngine` подписку `onPlaying(listener): () => void` (событие `playing`
  у элемента уже слушается для `buffering` — переиспользовать тот же обработчик).

`apps/web/lib/jam/use-playback-sync.ts`:
- При смене трека и при возобновлении с паузы: после `play()` дождаться первого `playing`
  и ТОЛЬКО тогда выставить `engine.seek(derivePositionMs(playback, serverNow()))` —
  позиция считается в момент, когда звук фактически пошёл, а не до буферизации.
  Начальный `seek` до `play()` оставить (грубая наводка, чтобы не грузить трек с нуля),
  ресинк по `playing` — точная.
- Подписку снимать при смене трека/размонтировании (staleness-guard как у `load`).
- Интервал периодической проверки `SYNC_INTERVAL_MS` 2000 → 10_000.
- Убрать `rateRef` и вызовы `setRate` (кроме сброса в 1 при создании — можно удалить и
  метод `setRate` из движка, если он больше не используется).

### C. Коррекция только когда звуковых устройств больше одного

Сервер должен сказать клиенту, кто реально в комнате (открытый SSE), а не кто когда-то
заходил.

- `packages/core/src/ports/jam-state.ts` + `apps/web/lib/jam/jam-state.ts`:
  новый `dropPresence(jamId, participantKey)` (ZREM; деградирует молча, как соседи).
- `packages/core/src/services/jam.ts`: `heartbeat` уже пишет presence — добавить
  `listPresent(jamId)`-обёртку и метод `leave(jamId, identity)`, который дропает presence
  и бродкастит `{ type: 'jam:presence', participantIds }`. `getState` дополняется
  `presentParticipantIds` (из `state.listPresent`).
- `apps/web/app/api/v1/jam/[code]/stream/route.ts`: после `heartbeat` в `start()` —
  бродкаст `jam:presence` со свежим списком; в `cleanup()` — `service.leave(...)`
  (осторожно: cleanup зовётся и при обрыве — это ровно тот случай).
- `apps/web/lib/jam/use-jam-room.ts`: `presentParticipantIds: string[]` в состоянии
  (из снапшота + событие `jam:presence`).
- `apps/web/app/(listener)/jam/[code]/jam-room.tsx`: `audioDeviceCount` —
  в SPEAKER всегда 1, в SYNCED = число присутствующих участников;
  `driftCorrection={room.mode === 'SYNCED' && audioDeviceCount > 1}`.

Деградация: Redis лёг → `listPresent` вернёт `[]` → считаем 1 устройство → коррекции нет.
Это безопасный дефолт (лучше без коррекции, чем каша).

## Тесты

- `packages/core`: `jam-sync.test.ts` под новый контракт; в `jam.test.ts` — `leave`
  дропает presence и бродкастит.
- `apps/web`: `use-playback-sync.test.ts` — позиция выставляется по `playing`, а не сразу;
  при `driftCorrection: false` интервал не вешается; `use-jam-room.test.ts` — событие
  `jam:presence`; `jam-room.test.tsx` — одиночный участник не включает коррекцию.

## Доки

`docs/features/jam.md` — раздел синхронизации переписать под новую модель (нет rate-warp,
ресинк по `playing`, коррекция только при 2+ звуковых устройствах).

## Гейты (гонит главная сессия)

typecheck (web/core/db) · lint · check:routes · test (web+core) · audit:design · build.
