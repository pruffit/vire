# План: джем-аудио, оверлеи, мобильный бэклог (27.07.2026)

Спека: `docs/superpowers/specs/2026-07-27-jam-audio-overlays-mobile-backlog-design.md`.
Ветка: `main` (локально), деплой/тег — только по команде Danya.
Срезы идут последовательно, каждый — свой сабагент (Sonnet), гейты после каждого.

## Срез A — джем: убрать заикание

1. `apps/web/lib/player/hls-runtime.ts` (новый): экспорт `HLS_TUNING`
   (`{ maxBufferHole: 0.5, nudgeOffset: 0.2, nudgeMaxRetry: 8 }`) и
   `attachStallRecovery(hls, audio, Hls)` — обработчик non-fatal `bufferStalledError`
   с прыжком на `buffered.start(0) + 0.01`, вынесенный из `audio-engine.ts:309-334`.
2. `audio-engine.ts` — перевести на общий модуль без смены поведения.
3. `jam-audio.ts:66` — `new Hls(HLS_TUNING)` + `attachStallRecovery`; non-fatal ошибки
   больше не игнорируются молча.
4. `packages/core/src/services/jam-sync.ts` — демпфер петли: `decideDriftCorrection`
   получает признак «идёт буферизация / только что был seek» и в этом состоянии
   возвращает `none` вместо `seek`. Cooldown после жёсткого seek — константа рядом с
   `HARD_SEEK_MS`. Чистая функция, тесты на: обычный дрейф → seek; дрейф во время
   буферизации → none; дрейф внутри cooldown → none; после cooldown → снова seek.
5. `apps/web/lib/jam/use-playback-sync.ts` — прокинуть состояние буферизации
   (`readyState`/`waiting`+`playing`) и отметку времени последнего seek.
6. Тесты: обновить `apps/web/lib/jam/jam-audio.test.ts` (ожидание recovery на
   non-fatal), новые кейсы в тестах `jam-sync`.

## Срез B — оверлеи не уходят за экран

1. `apps/web/components/popover.tsx` — горизонтальный клэмп: после открытия мерить
   панель (`getBoundingClientRect`) и сдвигать трансформом внутрь вьюпорта с полем 8px.
   Логику сдвига вынести чистой функцией (`clampPanelX({ panelLeft, panelWidth,
   viewportWidth, margin })` → `offsetX`) + юнит-тесты.
2. `components/notifications/notification-bell.tsx` — на `AdaptivePopover` (тач → `Sheet`).
3. Клэмпы ширины там, где их нет: `components/color-field.tsx:196`,
   `components/date-field.tsx:155`, `app/admin/artists/members-manager.tsx:106`
   (`max-w-[calc(100vw-2rem)]`).
4. Проверить, что `playlist-settings-menu.tsx:167` после правки примитива не выезжает.

## Срез C — `PageContainer` + карточки артиста

Один срез: пересекаются файлы (`artist-catalog.tsx`, `search/page.tsx`).

1. `apps/web/components/page-container.tsx` (новый): `variant: 'default' | 'overlap' |
   'detail' | 'compact'`, `spaceY`, `as`, `className`. База —
   `w-full max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8`.
2. Перевести 15 файлов из спеки; 4 расходящихся `loading.tsx`
   (`profile`, `artists/[slug]`, `releases/[releaseId]`, `tracks/[trackId]`) привести к
   контейнеру своей живой страницы. Удалить мёртвый `app/feed/loading.tsx`.
3. `apps/web/components/artist-card.tsx` (новый): пропсы
   `{ id, slug, name, avatarUrl, coverFallbackUrl?, verified, stat?, sizes?, variant? }`,
   `variant="chip"` — с hover-попапом из `artist-hover-chip.tsx`.
4. Перевести `artist-catalog.tsx`, `search/page.tsx`, `artist-hover-chip.tsx`,
   `taste-section.tsx`. `followed-artists.tsx` не трогать.
5. Тест на маппинг пропсов карточки (verified/stat/фолбэк обложки).

## Срез D — тач-реордер + `ArtistSwitcher` на мобилке

1. `apps/web/lib/reorder.ts` (новый): чистая `swapAdjacent(list, id, dir)` + тесты
   (границы списка, отсутствующий id).
2. `components/sortable-track-row.tsx` — опциональные кнопки ↑/↓
   (`onMoveUp`/`onMoveDown`/`canMoveUp`/`canMoveDown`), видимы на `pointer-coarse`,
   тач-таргет 44px. Подключить в плейлисте (`playlist-view.tsx`, PUT полного порядка) и
   в джем-очереди (`use-jam-queue.ts`: резолвить соседа по индексу → существующий
   `moveTrack(activeId, overId)`).
3. `app/dashboard/releases/[id]/track-manager.tsx:325` — те же кнопки рядом с грипом,
   через существующий `handleReorder`/`commitOrder` с его optimistic/rollback.
4. `components/player/queue-panel.tsx` — дорисовать видимые кнопки к готовому
   `moveTrack(id, dir)`.
5. `app/dashboard/layout.tsx:53` — мобильный триггер артиста (аватар + имя) в топ-баре
   при `allArtists.length > 1`, открывает `Sheet`: список артистов (переключение через
   существующий POST `/api/v1/dashboard/active-artist`) + ссылка «Открыть страницу».
   Десктопный сайдбар не трогать.

## Отклонения при реализации

- `MobileArtistSwitcher` рендерится при любом активном артисте, а не только при
  `allArtists.length > 1`: при одном артисте это ссылка «аватар + имя» на публичную
  страницу. Так на мобилку возвращаются все три потерянных элемента (имя, ссылка,
  переключение), а не только третий; сам `Sheet` со списком по-прежнему только при >1.

## Порядок и приёмка

A → B → C → D. После каждого среза — все гейты; `audit:design` обязателен на B/C/D.
После D — один прожарочный прогон по всему дифу (Sonnet, свежий контекст), затем коммиты.
Деплой не делаем.
