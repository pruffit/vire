# План: Джем-сессии

Спека: `docs/superpowers/specs/2026-07-20-jam-sessions-design.md`. Роадмап: `stage-2.md` §8.

## Решения сверх спеки

1. **Отдельный аудио-движок джема** — `apps/web/lib/jam/jam-audio.ts`, не глобальный
   `lib/player/audio-engine.ts` (он сцеплен с persist-стором, play-events, wave-буфером).
   Переиспользуем `fetchManifest` из `lib/player/manifest-cache.ts`. При входе в звук
   джема глобальный плеер ставится на паузу — два аудио одновременно недопустимы.
2. **`queue_version` в Postgres** (`jam_sessions.queue_version`), инкремент в той же
   транзакции, что мутация. В Redis — только playback. Версия переживает падение Redis.
3. **Обобщение `lib/realtime.ts` аддитивное** — добавляем `publishChannel`/
   `subscribeChannel` на полное имя канала, старые `publish`/`subscribe` переопределяем
   поверх них. Сигнатуры неизменны, PSUBSCRIBE `rt:*` не трогаем. Чат и уведомления в проде.

## Фаза 0 — чистые функции (прод не затронут)

- **0.1** `packages/core/src/services/jam-sync.ts` — `derivePositionMs`,
  `decideDriftCorrection`, `pickClockOffset`. Пороги константами (`HARD_SEEK_MS=2000`,
  `RATE_CORRECT_MIN_MS=150`, `CONVERGED_MS=50`, `RATE_DELTA=0.03`).
  Тонкости: позиция клампится в 0 (клок-скью даёт минус); коррекция **гистерезисная** —
  при `rate!==1` и сходимости возвращаем `rate:1`, иначе застрянет на 1.03; отстаём → `rate>1`.
- **0.2** `packages/core/src/services/jam-code.ts` — алфавит без похожих глифов
  (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`), длина 6, `random` инъектируется.
- **0.3** `apps/web/app/api/v1/jam/time/route.ts` — `{ now: Date.now() }`, no-store, без БД/auth.

Все три параллельны. Тесты — первым делом, таблично, с границами порогов.

## Фаза 1 — данные и сервис (API есть, UI нет)

- **1.1** `packages/db/src/schema/jam.ts` — `jam_sessions` / `jam_participants` /
  `jam_queue_items` (детали полей — в отчёте плана; check-констрейнт «ровно одна
  идентичность», `unique(jam_id, track_id)` НЕ ставим — на тусовке дубль осознан).
  Миграция `0042`.
- **1.2** `IJamRepository` (`packages/core/src/repositories/jam.ts`) + Drizzle-реализация;
  порт `IJamStateStore` (`ports/jam-state.ts`) + Redis-реализация `apps/web/lib/jam/jam-state.ts`
  по образцу `lib/presence.ts` — **молчаливая деградация** при мёртвом Redis.
- **1.3** `JamService` (`packages/core/src/services/jam.ts`) + чистая
  `applyQueueMutation` (add/remove/move; позиции без дыр; несуществующий id — no-op,
  чтобы LWW не ронял). Права: транспорт — только HOST; add/move — любой участник.
  Лимиты: очередь ≤200, участники ≤50, добавления 10/мин.
- **1.4** Роуты `apps/web/app/api/v1/jam/**`. Сегмент везде `[code]` (грабли v1.0.70 —
  `check:routes`). `join`/`stream` — **без `auth()`**, identity через
  `resolveJamIdentity` (`lib/jam/jam-identity.ts`) поверх `verifySessionId`.

## Фаза 2 — комната без синхро-звука (первое полезное состояние)

- **2.1** Обобщение `lib/realtime.ts` + порт `IJamBroadcaster`. Проверка не-регресса:
  тесты чата/уведомлений + ручной `/messages` в двух вкладках.
- **2.2** SSE `app/api/v1/jam/[code]/stream/route.ts` — по образцу существующего стрима,
  но членство вместо `auth()`; в `start` сразу снапшот очереди и playback.
- **2.3** `useRealtime` получает опциональный URL (дефолт = старый, вызовы не меняются);
  `lib/jam/use-jam-room.ts` — применяет `jam:queue` только если `version` больше локальной,
  буферизует входящие при активном drag.
- **2.4** Экран `app/(listener)/jam/[code]`. **Не писать свою строку трека** — вынести
  `SortablePlaylistRow` в `components/sortable-track-row.tsx` и перевести на него и
  плейлист, и джем. Сенсоры dnd-kit копируем 1:1 (мобилка первична).
  Запреты: `min-h-screen`/`h-screen`; скролл на списке (`overflow-y-auto min-h-0`);
  live-индикатор — `animate-live-pulse`, не `animate-ping`; entrance — `fill backwards`.
- **2.5** `jam-share.tsx` по образцу `components/playlist-share.tsx`.

Экран входа строим сразу вокруг тапа «Подключиться к звуку» — в фазе 3 к нему
прицепится разблокировка автоплея, переделывать не придётся.

## Фаза 3 — синхронное воспроизведение (изолированный риск)

- **3.1** `lib/jam/server-clock.ts` — 5 замеров, `pickClockOffset`, ресинк раз в 5 мин.
- **3.2** `lib/jam/jam-audio.ts` — свой Audio + hls.js, `preservesPitch` (+ вендорные).
- **3.3** `lib/jam/use-playback-sync.ts` — цикл 2с, решение берём из core, хук применяет;
  на `visibilitychange` — немедленный прогон.
- **3.4** `POST /api/v1/jam/[code]/playback`, гейт HOST. Автопереход на следующий трек
  инициирует **хост** по `ended` — воркер не нужен.

Провал фазы 3 не откатывает фазу 2: остаётся «общая очередь» (деградация из §9 спеки).

## Фаза 4 — обвязка (параллельно)

- **4.1** QR: зависимость `qrcode`, рендер SVG **на сервере** (`GET /api/v1/jam/[code]/qr`).
- **4.2** Сохранить в плейлист — через `PlaylistService.create`/`addTrack`, не дублируя.
- **4.3** Приглашение друзей — новый тип уведомления `JAM_INVITE` (`ALTER TYPE ADD VALUE`).
- **4.4** Авто-закрытие 12ч — воркер `jam-reaper`. **Порог считать в SQL интервалом**,
  не интерполировать JS-`Date` в raw-`sql`.
- **4.5** `docs/features/jam.md` + отметка в `stage-2.md` §8.

## Порядок

```
Фаза 0:  0.1 ‖ 0.2 ‖ 0.3
Фаза 1:  1.1 → 1.2 → 1.3 → 1.4
Фаза 2:  2.1 → (2.2 ‖ 2.3) → 2.4 → 2.5   [вынос SortableTrackRow ‖ 2.1–2.3]
Фаза 3:  3.1 → 3.2 → 3.3 ; 3.4 ‖ 3.1–3.3
Фаза 4:  4.1 ‖ 4.2 ‖ 4.3 ‖ 4.4 ‖ 4.5
```

Критический путь: 1.1→1.2→1.3→1.4→2.1→2.4. Фаза 0 идёт параллельно 1.1.

## Приоритет тестов

`derivePositionMs`, `decideDriftCorrection` (гистерезис), `applyQueueMutation`
(инвариант позиций), `generateJamCode`/`normalizeJamCode`, `pickClockOffset` — первыми.
Дальше права в `JamService` и права/валидация в роутах.

## Гейты

Каждая фаза заканчивается зелёными: typecheck (web/core/db), lint, check:routes, test,
audit:design (фазы 2+), build. Фаза 3 — плюс ручная проверка на двух устройствах в
одном вайфае и кейс «вкладка минуту в фоне».
