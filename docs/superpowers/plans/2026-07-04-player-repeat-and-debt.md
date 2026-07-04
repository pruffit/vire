# План: режим повтора, перемотка мини-бара и долг v1.8.0

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрыть два пользовательских бага плеера (нет режима повтора; перемотка в мини-баре не работает — скраб-зона перекрыта слоем `z-10`) и весь осознанный долг переработки v1.8.0 из `docs/roadmap/TODO.md` §«Долг переработки плеера/рекомендаций».

**Architecture:** Плеер — Zustand-стор `apps/web/store/player.ts` (persist `vire-player`) + императивный движок `apps/web/components/player/audio-engine.ts` (`controls.*`) + UI-модули `apps/web/components/player/*`. Серверная часть вкуса — `packages/db/src/queries/taste.ts`. Правки локальны этим слоям; новых API-роутов и миграций нет.

**Tech Stack:** Next.js 15, TS strict, Zustand persist, hls.js, motion/react, Vitest.

## Global Constraints

- Никаких `min-h-screen`/`h-screen` на страницах/лейаутах (app-shell).
- Минимум комментариев — только неочевидное «почему».
- Мобильная вёрстка проверяется для каждого UI-изменения (узкий вьюпорт).
- Перед новым компонентом — поиск готового в `packages/ui` и `apps/web/components`.
- Иконки — через существующую систему `components/icon.tsx` (спрайт, `pnpm icons:build` если добавляется новая) либо инлайн-SVG в `player-icons.tsx` рядом с соседними.
- Гейты после каждой задачи: `pnpm --filter @vire/web typecheck && lint && test`; при UI — `audit:design`; в конце — `build`.
- Коммит после каждой задачи (Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>).
- Плеер персистится с `version: 1` — новые персист-поля должны переживать гидрацию старого снапшота без падения (отсутствующее поле → дефолт из initial state; zustand persist мержит поверх initial, этого достаточно, миграция не нужна).

---

### Task 1: Режим повтора + починка перемотки мини-бара + очередь на мобилке

**Files:**
- Modify: `apps/web/store/player.ts` (+ `apps/web/store/player.test.ts`)
- Modify: `apps/web/components/player/audio-engine.ts`
- Modify: `apps/web/components/player/controls.tsx`
- Modify: `apps/web/components/player/mini-bar.tsx`
- Modify: `apps/web/components/player/fullscreen.tsx`
- Modify: `apps/web/components/player/use-player-hotkeys.ts`
- Modify: `apps/web/components/player/player-icons.tsx` (иконка Repeat, если нет в спрайте `components/icon.tsx` — проверить сначала)
- Modify/Create: `apps/web/lib/player/queue.ts` — чистый хелпер `nextQueueIndex` (+ тест в `apps/web/lib/player/queue.test.ts` или рядом с существующими)

**Interfaces:**
- Produces: `State.repeat: 'off' | 'all' | 'one'` (persisted), `controls.cycleRepeat(): void`, `nextQueueIndex(queueIndex: number, queueLength: number, repeat: Repeat): number | null` (null = очередь кончилась).

**Требования:**

1. **Стор.** Поле `repeat: 'off' | 'all' | 'one'`, дефолт `'off'`, добавить в `PersistedState`/`partialize`.
2. **Семантика повтора** (как у Spotify):
   - `ended` при `repeat === 'one'` → `flushPlayEvent()` уже сработал в ended-хендлере; после него `controls.seek(0)` + `audio.play()` — трек играет заново (heartbeat/play-event перевзведутся в `playing`, т.к. `playStartedTrackId` сброшен flush'ем).
   - Конец очереди (и в `ended`→`next()`, и при ручном next): `repeat === 'all'` и НЕ `waveMode` → переход на индекс 0 (`playAt(queue, 0)`). В `waveMode` волна главнее — поведение не меняется.
   - Ручной `next()` при `repeat === 'one'` — обычный переход к следующему (повтор не залипает на треке).
   - `prev()` не меняется.
   - Логику «какой индекс следующий» вынести чистой функцией `nextQueueIndex(queueIndex, queueLength, repeat)` в `apps/web/lib/player/queue.ts`: `queueIndex+1 < queueLength` → `queueIndex+1`; иначе `repeat === 'all'` и `queueLength > 0` → `0`; иначе `null`. `next()` в движке: `repeat==='all'` учитывается только когда НЕ waveMode (волна дозапрашивает буфер как сейчас).
3. **`controls.cycleRepeat()`**: off → all → one → off.
4. **UI-кнопка** на базе `PlayerToggleButton` (controls.tsx): иконка repeat, `active = repeat !== 'off'`; при `'one'` — бейдж «1» (мелкий индекс поверх иконки, абсолютным спаном). `aria-label`: «Повтор выключен / Повтор очереди / Повтор трека».
   - **Фуллскрин:** строка Controls становится [Shuffle] [prev][play][next] [Repeat]; кнопка «Поделиться» (текущий `trailing`) переезжает в `FullscreenExtras` рядом с кнопкой очереди. Пропы `Controls` упростить/расширить соответственно (например `showShuffle`/`showRepeat`), лишний `trailing`-проп убрать, если больше не нужен.
   - **Мини-бар:** на `sm+` транспорт расширяется до [Shuffle] [prev][play][next] [Wave] [Repeat] (Shuffle и Repeat скрыты `<sm`, чтобы не тесниться). На мобилке транспорт как был.
5. **Хоткей** `KeyR` → `controls.cycleRepeat()` в `use-player-hotkeys.ts` (без preventDefault-конфликтов; гварды как у соседей). Добавить строку в таблицу хоткеев `/about` (`about-content.tsx`, секция 06), если она перечисляет клавиши плеера.
6. **Фикс перемотки мини-бара:** `TopProgressLine` в `mini-bar.tsx` лежит ПОД контентным слоем `relative z-10` → pointer-события не доходят. Дать скраб-зоне `z-20`. Плюс discoverability: на `group-hover` полоска утолщается как при драге (`h-[3px]`) и появляется кружок-плейхед на текущей позиции (только desktop hover, без него на таче).
7. **Очередь на мобилке:** кнопка очереди сейчас в блоке `hidden sm:flex`. Добавить компактную кнопку `QueueIcon` видимой `<sm` (например, `sm:hidden` рядом с Controls, tap-target ≥40px), открывает ту же панель (`onOpenQueue`). Показывать при `queue.length > 1`.

**Тесты:**
- `nextQueueIndex`: 4+ кейса (середина очереди; конец + off → null; конец + all → 0; пустая очередь → null; конец + one → null).
- `player.test.ts`: `repeat` входит в partialize; дефолт `'off'`.

**Шаги:** тест `nextQueueIndex` (fail) → реализация → стор+persist тест → движок (`ended`/`next`/`cycleRepeat`) → UI (controls/фуллскрин/мини-бар) → хоткей → фикс TopProgressLine z-index/hover → мобильная кнопка очереди → гейты (typecheck, lint, test, audit:design) → коммит `feat(player): режим повтора (off/all/one), фикс перемотки мини-бара, очередь на мобилке`.

---

### Task 2: Персист-доводка и память: duration после F5, originalQueue, кап live-очереди, sid волны

**Files:**
- Modify: `apps/web/store/player.ts` (+ `apps/web/store/player.test.ts`)
- Modify: `apps/web/components/player/audio-engine.ts`
- Modify: `apps/web/lib/player/use-audio-time.ts`
- Modify: `apps/web/lib/player/queue.ts` (чистый хелпер капа очереди + тест)

**Interfaces:**
- Consumes: `sliceQueueForPersist`, `PERSISTED_QUEUE_LIMIT=100`, `PERSISTED_QUEUE_WINDOW_BEFORE=20` из `store/player.ts`; `mintWaveSessionId`/`growWaveBuffer` из движка.
- Produces: `capLiveQueue(queue, queueIndex, originalQueue)` → `{ queue, queueIndex, originalQueue }` (чистая, в `lib/player/queue.ts`).

**Требования:**

1. **Restored показывает 0:00 (TODO §7).** Персистить `duration` (добавить в `PersistedState`/`partialize`). `useAudioTime` до первого подключения движка возвращает 0 — в состоянии `restored` (нет аудио) хук должен отдавать `store.currentTime` (fallback: `hasAudio === false && restored === true` → стор). После F5 мини-бар и фуллскрин показывают сохранённые время/длительность, `TopProgressLine` и waveform — сохранённую позицию. Ничего не должно дёргаться при первом реальном запуске (`resumeRestored`).
2. **`originalQueue` без среза (TODO §3).** В `partialize` резать `originalQueue` тем же окном: найти индекс текущего трека в `originalQueue` и применить `sliceQueueForPersist`-логику вокруг него (вынести общее, не копипастить). Тест: originalQueue длиной 300 → персистится ≤100 и содержит текущий трек.
3. **Кап live-очереди (TODO §6).** Константа `LIVE_QUEUE_LIMIT = 300`. Чистая функция `capLiveQueue` в `lib/player/queue.ts`: если `queue.length > LIVE_QUEUE_LIMIT` — отрезать голову так, чтобы перед текущим осталось ≥20 треков (сдвинуть `queueIndex`; `originalQueue`, если не null, резать той же логикой по позиции текущего трека). Вызывать в `growWaveBuffer` после мержа. Тест: очередь 310, index 305 → длина ≤300, текущий трек на месте, index скорректирован.
4. **Сирота-sid волны (TODO §2).** `startWave` сейчас ротирует sid в sessionStorage ДО фетча — неудачный старт оставляет играющую волну без серверного анти-повтора. Разделить: `crypto.randomUUID()` кандидат → передать в `fetchWaveTracks` → писать в sessionStorage только при `tracks.length > 0` (успех). `mintWaveSessionId` соответственно переделать/убрать.

**Тесты:** partialize (duration входит; originalQueue ≤100 с текущим треком), `capLiveQueue` (3+ кейса: короткая очередь не тронута; длинная режется с сохранением текущего; originalQueue режется согласованно).

**Шаги:** тесты partialize/capLiveQueue (fail) → реализация стора → `capLiveQueue` + вызов в growWaveBuffer → фикс sid → use-audio-time fallback → гейты → **runtime-проверка restored**: dev-сервер, включить трек, F5, убедиться что время/длительность/прогресс показываются до первого play (Playwright или ручной прогон — по мандату `project-vire-runtime-verification`) → коммит `fix(player): duration после F5, срез originalQueue, кап live-очереди, sid волны только при успехе`.

---

### Task 3: Кэш getTasteProfile

**Files:**
- Modify: `packages/db/src/queries/taste.ts`
- Test: рядом с существующими тестами db/core, если инфраструктура позволяет; иначе — чистый кэш-хелпер с тестом в `packages/db` (проверить, есть ли там vitest; если нет — хелпер в `packages/core` с тестом там)

**Требования:**
- In-memory TTL-кэш на процесс (один VPS-инстанс): `Map<userId, { value: TasteProfile; expiresAt: number }>`, TTL 60 сек, потолок ~500 записей (при переполнении — выбрасывать протухшие, затем самые старые). Время — инъектируемое (параметр `now` с дефолтом `Date.now`) для тестируемости, НЕ `new Date()` в логике.
- Кэш оборачивает `getTasteProfile`; промахи идут в БД как сейчас. Экспортировать `clearTasteProfileCache()` для тестов.
- Инвалидация не нужна (TTL 60с — лаг вкуса незаметен).

**Тесты:** hit в пределах TTL не дёргает БД повторно (мок-фетчер), протухание по TTL, вытеснение при переполнении.

**Шаги:** тест кэш-хелпера (fail) → реализация → обёртка getTasteProfile → гейты (`pnpm --filter @vire/db typecheck` + тесты пакета, где они есть, + web-гейты) → коммит `perf(db): TTL-кэш профиля вкуса getTasteProfile`.

---

### Task 4: Унификация трек-строк

**Files:**
- Create: `apps/web/components/track-row.tsx` — параметризуемая строка трека
- Modify: `apps/web/components/track-list.tsx` (Row → на общий компонент)
- Modify: `apps/web/components/listener/liked-track-row.tsx`
- Modify: `apps/web/app/(listener)/playlists/[id]/playlist-track-row.tsx`
- Modify: `apps/web/app/(listener)/profile/purchased-track-row.tsx`

**Требования:**
- Прочитать все 4 файла ДО дизайна пропов. Общее ядро: обложка с play/pause-оверлеем и состоянием «играет», title + ExplicitBadge, артист, метаданные справа, обработчик клика. Вариативное — слоты/пропы: leading (номер в трек-листе), trailing (лайк / добавить в плейлист / удалить / скачать / длительность), subtitle, href-обёртки.
- Каждый из 4 потребителей становится тонкой обёрткой над `TrackRow` (данные + слоты) — без визуальных регрессий (те же классы/размеры, где они совпадали; где расходились — привести к единому виду осознанно, зафиксировав это в отчёте).
- FSD: общий компонент в `apps/web/components/` (shared-слой) — не тянуть в него зависимостей из route-специфичных модулей.
- Никаких новых фич — чистый рефактор, поведение и разметка эквивалентны.

**Тесты:** существующие web-тесты зелёные; если у строк есть тесты — обновить импорты. Runtime-смоук: dev-сервер, открыть /library/liked, плейлист, страницу релиза — строки рендерятся, play из строки работает.

**Шаги:** чтение 4 файлов → дизайн пропов → `TrackRow` → миграция потребителей по одному (typecheck после каждого) → гейты (вкл. audit:design) → runtime-смоук → коммит `refactor(web): единый TrackRow вместо 4 дублей строк трека`.

---

### Task 5 (закрытие): актуализация долга и доков

**Files:**
- Modify: `docs/roadmap/TODO.md` — отметить закрытые пункты долга §«Долг переработки плеера/рекомендаций» (все 7; «кнопка очереди мини-бара <sm» закрыта мобильной кнопкой из Task 1)
- Modify: `docs/features/player.md` — режим повтора (семантика off/all/one, хоткей R, wave-приоритет), перемотка мини-бара, мобильная кнопка очереди, персист duration
- Modify: `docs/features/wave.md` — sid коммитится только при успешном старте; кап live-очереди
- Modify: `docs/features/curated-playlists.md` — упомянуть TTL-кэш профиля вкуса (60с)

**Шаги:** правки доков → гейты не нужны (только md) → коммит `docs: повтор/перемотка/кэш вкуса — актуализация после закрытия долга v1.8.0`.
