# План: пачка хвостов бэклога (27.07.2026)

Спека: `docs/superpowers/specs/2026-07-27-backlog-tails-design.md`.
Ветка: `main` (локально), тег/деплой — только по команде Danya.
Срезы A, B+C, D независимы по файлам.

## Срез A — клэмп оверлеев

1. `apps/web/components/color-field.tsx` — `useViewportClampX(open)`; на панели
   `ref={panelRef}`, `x: offsetX` в `initial`/`animate`/`exit`; добавить `role="dialog"`
   (сейчас у панели роли нет). `max-w-[calc(100vw-2rem)]` оставить как второй барьер.
2. `apps/web/components/date-field.tsx` — то же (`role="dialog"` уже есть).
3. `apps/web/app/admin/artists/members-manager.tsx` — тот же хук; offsetX применить
   в `style` панели как `transform: translateX(${offsetX}px)`. `place()` и listener'ы
   скролла не трогать.
4. `apps/web/components/add-to-playlist-button.tsx` — десктопная ветка (`:261`), тот же
   хук. Тач-ветку (`Sheet`) не трогать.
5. Гейты: `typecheck`, `lint`, `test`, `audit:design`.

Клэмп в jsdom не проверить (нулевой layout) — чистая `clampPanelX` уже покрыта
`lib/__tests__/clamp-panel-x.test.ts`, новых тестов на позиционирование не пишем.

## Срез B — джем: optimistic pause/play

1. Новый `apps/web/lib/jam/optimistic-playback.ts`:
   - `export interface PendingToggle { paused: boolean; at: number }`
   - `effectivePaused(playback: JamPlaybackState | null, pending: PendingToggle | null): boolean`
   - `resolvePending(pending, serverPaused: boolean, now: number, ttlMs: number): PendingToggle | null`
   - `PENDING_TTL_MS` рядом.
2. `optimistic-playback.test.ts` — pending перекрывает серверное; сервер подтвердил →
   снят; сервер прислал противоположное (чужая команда) → pending остаётся до TTL;
   протух → снят; `pending=null` → серверное как есть.
3. `app/(listener)/jam/[code]/jam-room.tsx`:
   - стейт `pending`, установка в `handleTogglePlayback` и в ветке активного трека
     `handleRowPlay` (клик по **другому** треку — `setPending(null)`);
   - команда считается от `effectivePaused`, а не от `playback.paused`;
   - снятие: эффект на `room.playback` через `resolvePending`, таймер на `PENDING_TTL_MS`,
     и немедленно при неуспехе `postPlayback` (прокинуть колбэк ошибки);
   - `isPlaying` (бар «сейчас играет») и `isPlaying` строк очереди — от `effectivePaused`;
   - `usePlaybackSync` получает **серверный** `room.playback` без изменений.
4. `jam-room.test.tsx` — два быстрых клика по кнопке паузы до SSE: второй POST уходит
   `kind: 'play'`, не второй `pause`; после `jam:playback` с подтверждением поведение
   возвращается к серверному состоянию.

## Срез C — тест ретрай-таймера E2EE

`apps/web/lib/e2ee-client.test.ts`, `vi.useFakeTimers()`: ошибка бутстрапа → `error:true`;
`advanceTimersByTime(15_000)` → второй заход; успех на нём → `ready:true`; unmount до
таймера → повтора нет. Модульный кеш `bootstraps` чистить между кейсами
(`vi.resetModules()` + переимпорт, как в существующих тестах файла).

## Срез D — SEO-аудит разметки

Только чтение прода, кода не трогаем. Скрипт в scratchpad: тянет страницы
(главная, `/artists`, артист, релиз, трек, `/about`, смартлинк, публичный плейлист),
извлекает `application/ld+json` и `og:`/`twitter:`-мета, проверяет обязательные поля
типов, совпадение `canonical` с URL, `HEAD 200` на `og:image`. Отчёт — список находок
с severity; правок в этом срезе нет.

## Хвост документации

- `docs/roadmap/TODO.md` — пункт клэмпа переформулировать (подключение `useViewportClampX`,
  а не перевод на `Popover`), закрыть пункты джема и E2EE-теста, снять устаревший пункт
  про `key={i}`/`inPlaylists`, зафиксировать блокер k6.
- Память `project-vire-ui-audit-backlog` — отметить, что хвост закрыт.
- Ledger цикла — `docs/superpowers/2026-07-27-backlog-tails-ledger.md`.

## Гейты (после каждого среза с кодом)

```
pnpm --filter @vire/web typecheck
pnpm --filter @vire/web lint
pnpm --filter @vire/web check:routes
pnpm --filter @vire/web test
pnpm --filter @vire/web audit:design
pnpm --filter @vire/web build
```
