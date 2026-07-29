# План: пачка багфиксов джема

Спека: `docs/superpowers/specs/2026-07-29-jam-bugfix-batch-design.md`.
Решения Danya: шевроны реордера убрать ВЕЗДЕ; плеер джема — полный транспорт с перемоткой.

Порядок шагов линейный: 5 из 6 правок сходятся в `jam-room.tsx`, параллелить нельзя.

## 1. Реордер: убрать шевроны (`components/sortable-track-row.tsx`)

Удалить пропы `onMoveUp/onMoveDown/canMoveUp/canMoveDown` и блок
`{(onMoveUp || onMoveDown) && …}` из `leading`. Снять их передачу в трёх местах:
`jam-room.tsx` (+ функция `moveAdjacent` — мёртвая, удалить),
`app/(listener)/playlists/[id]/playlist-track-row.tsx`,
`app/dashboard/releases/[id]/track-manager.tsx` (там же снять соответствующие
хелперы, если после этого не используются). Импорты `Icon`/`touchTargetCoarse`/`cn`
в `sortable-track-row.tsx` подчистить, если стали лишними.

## 2. Панель добавления (`jam-add-panel.tsx` + `jam-room.tsx`)

- Новый проп `addedTrackIds: ReadonlySet<string>`. Для строки с `addedTrackIds.has(t.id)`:
  `<button disabled>`, иконка `check` вместо `plus` (проверить имя в
  `components/icon-manifest.generated.ts`), приглушение (`opacity-50`), убрать hover-фон,
  `aria-label`/подпись «Добавлено».
- В `jam-room.tsx`: `addedTrackIds` = `useMemo(() => new Set(jamQueue.queue.map(i => i.trackId)), [jamQueue.queue])`;
  `handleAdd` выходит сразу, если id уже в сете (гонка двойного тапа).
- Мобильная панель: вместо инлайнового `{adding && <div className="lg:hidden">…}` —
  `components/sheet.tsx` (`anchor="bottom"`, `onClose={() => setAdding(false)}`; Esc,
  тап по подложке и свайп вниз уже внутри). Прочитать `sheet.tsx` целиком, чтобы
  корректно отдать внутренний скролл списка (у панели свой `max-h-72 overflow-y-auto` —
  в шторке заменить на растягивание по высоте контента шторки, без вложенного двойного скролла).
  Десктопный `aside` с `<JamAddPanel autoFocus={false}>` не трогать.
- Подсветка активной строки: сейчас `isActive`/`isPlaying` матчатся по `trackId` — при
  дублях в старых очередях подсвечиваются все копии. Считать индекс первого совпадения
  (`queue.findIndex(i => i.trackId === room.playback?.trackId)`) и сравнивать с `i`.

## 3. Мобильная шапка комнаты (`jam-room.tsx`)

`<header>`: на `<sm` две строки — сверху статус + `h1` + код, снизу ряд действий
(`JamParticipants`, `JamInvite`, `JamSavePlaylist`, `JamShare`, «Завершить джем»);
с `sm` — прежняя однострочная раскладка (`sm:flex-row sm:items-center`). Проверить
на 320px: нет горизонтального скролла, «В сети» не переносится (`whitespace-nowrap`),
код не налезает на заголовок. Никаких `h-screen/min-h-screen`.

## 4. Единый плеер: транспорт джема

**`lib/jam/jam-controls.ts`** — вместо одиночного `toggle` регистр транспорта:

```ts
export interface JamTransport {
  toggle(): void;
  next(): void;
  prev(): void;
  seek(ms: number): void;
  positionMs(): number;
}
export function setJamTransport(t: JamTransport | null): void;
export function getJamTransport(): JamTransport | null;
export function jamToggle(): void; // сохранить: зовётся из audio-engine guard (проверить grep)
```

**`store/player.ts`** — `JamOverride` получает `durationSec: number | null`,
`canPrev: boolean`, `canNext: boolean`. `jamOverride` по-прежнему не персистится.

**`jam-room.tsx`** — удалить внутрикомнатный бар «сейчас играет» (блок `{activeTrack && …}`).
Зарегистрировать транспорт в эффекте (по образцу текущего `setJamToggle`):
- `next/prev` — сосед активного трека в `jamQueue.queue`, `postPlayback({kind:'track', trackId})`;
- `seek(ms)` — `postPlayback` c `{kind:'play', trackId, positionMs: ms}`, а если сейчас
  пауза — `{kind:'pause', positionMs: ms}` (перемотка не должна запускать паузнутый джем);
- `positionMs()` — `derivePositionMs(room.playback, serverNow())`, через реф на актуальные
  значения, чтобы не пересоздавать транспорт на каждый тик;
- в `setPlayerJamOverride` добавить `durationSec` активного трека и `canPrev/canNext`.

**`components/player/progress-line.tsx`** (новый) — вынести `TopProgressLine` из
`mini-bar.tsx` как есть, параметризовав `{ position, duration, onSeek }` (логика
`ratioFromX`, скраб-стейт, hover-утолщение, a11y-слайдер — без изменений). В обычном
режиме мини-бар передаёт `useAudioTime(4, active)` + `store.duration` + `controls.seek`.

**`components/player/mini-bar.tsx` → `JamMiniBar`** — привести к виду обычного бара:
обложка, название + бейдж «Джем», артист, `prev/play-pause/next` (prev/next
`disabled` по `canPrev/canNext`), `ProgressLine` с перемоткой, тайминги на `sm+`.
Позицию тикать новым хуком `lib/jam/use-jam-position.ts` (интервал ~250мс,
`getJamTransport()?.positionMs()`, останавливается при `active=false` — тот же контракт,
что у `useAudioTime`). Кнопки лайка/волны/очереди в режиме джема по-прежнему скрыты.

## 5. Качество звука

**`packages/core/src/services/jam-sync.ts`**: `RATE_DELTA` 0.03 → 0.01,
`RATE_CORRECT_MIN_MS` 150 → 200, `CONVERGED_MS` 50 → 60, новая `RATE_STUCK_MS = 20_000`.
В `DriftDamperState` — поле `msInRateCorrection: number | null`; в `decideDriftCorrection`
после проверки буферизации/кулдауна: если `msInRateCorrection !== null &&
msInRateCorrection >= RATE_STUCK_MS && absDrift >= CONVERGED_MS` → `{kind:'seek', toMs: expectedMs}`.

**`lib/jam/use-playback-sync.ts`**: вести `rateCorrectionStartedAtRef` — ставится при
первом переходе rate≠1, сбрасывается на rate=1 и на hard seek; передавать
`msInRateCorrection` в даммер.

**`lib/jam/jam-audio.ts`**: брать громкость из `usePlayerStore.getState().volume` при
создании и подписываться (`usePlayerStore.subscribe`) — сейчас ползунок в режиме джема
ничего не делает. Отписка — в `destroy()`. Проверить, есть ли `subscribeWithSelector`;
если нет — подписка на весь стор со сравнением предыдущего значения.

## 6. Тесты и доки

- `packages/core` — обновить тесты `jam-sync` под новые константы + кейс «залипшая
  rate-коррекция → hard seek».
- `apps/web/app/(listener)/jam/[code]/jam-room.test.tsx` — снять проверки удалённого
  внутрикомнатного бара, добавить: повторное добавление трека не шлёт второй `add`;
  панель добавления закрывается по `onClose`.
- `docs/features/jam.md` — секции про плеер/дрейф/панель добавления; `docs/features/player.md` —
  джем-режим мини-бара.

## Гейты (гонит главная сессия)

typecheck (web/core/db) · lint · check:routes · test · audit:design · build.
