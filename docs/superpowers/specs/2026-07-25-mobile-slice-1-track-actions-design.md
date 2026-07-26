# Срез 1 — Трек-действия и списки (мобильная раскатка)

**Дата:** 2026-07-25
**Программа:** `docs/superpowers/specs/2026-07-22-mobile-first-program.md` (Срез 1)
**Фундамент:** `docs/features/mobile-patterns.md` (Срез 0 — `AdaptiveMenu`, `Sheet`,
`useIsDesktopPointer`, `touchTargetClass`).

## Проблема

На таче hover'а нет, а действия трек-строк спрятаны под `opacity-0 group-hover:opacity-100`
→ на мобилке лайк/удаление/скачивание **недоступны**. Два действия (`TrackShare`,
`AddToPlaylistButton`) раскрываются десктопным поповером — на узком экране это не
bottom-sheet, а мелкий дропдаун у края.

`TrackQueueMenu` уже переведён на `AdaptiveMenu` в Срезе 0 — эталон.

## Цель

На таче все существующие действия трек-строк доступны без hover; поповеры действий
share / add-to-playlist адаптивны (sheet на таче, поповер на десктопе). Десктоп-плотность
и поведение не меняются.

## Объём

### 1. `TrackShare` → `AdaptiveMenu`
Заменить сырой `Popover` на `AdaptiveMenu` (sheet на таче / popover на десктопе).
Пункты:
- «Ссылка на трек» — copy + `toast('Ссылка скопирована')`.
- «С текущего момента» (иконка/хинт `M:SS`) — только при `currentTime > 2`; copy `?t=<сек>` + toast.

Инлайновый морф «Скопировано» заменяется на `toast` (единый фидбэк на обеих ветках —
`AdaptiveMenu` закрывает меню при выборе, инлайн-состояние показать негде). Триггер —
прежняя `ShareIcon` кнопка (motion) через render-prop `trigger`. Пропы `size`/`align`/`variant`
сохранить. Используется в `player/fullscreen.tsx` и на странице трека (waveform-player) —
меняется только компонент, хосты не трогаем.

### 2. `AddToPlaylistButton` → адаптивно (Sheet на таче)
Панель (список плейлистов с чекбоксами + строка «Новый плейлист») — это под-флоу, не плоский
список `MenuItem`. Поэтому НЕ `AdaptiveMenu`, а ветка по `useIsDesktopPointer()`:
- **десктоп:** текущий motion-popover без изменений;
- **тач:** `Sheet anchor="bottom"`, заголовок «Плейлисты» (`shrink-0`), список плейлистов
  `flex-1 min-h-0 overflow-y-auto` (задействует scroll-фикс Sheet из Среза 0), строка
  «Новый плейлист» / инлайн-создание `shrink-0` снизу. Тот же state/fetch/optimistic-логика —
  вынести контент панели в общий рендер, обе ветки его переиспользуют (без дублей).

Триггер уже 44px (`touchTargetClass('md')`, Срез 0) — не трогаем.

### 3. Видимость экшенов строк на таче
К hover-gated обёрткам действий добавить `pointer-coarse:opacity-100` (десктоп hover-reveal
сохраняется через `pointer-fine`, вариант уже есть в Tailwind-конфиге):
- `components/track-list.tsx:90` (лайк)
- `components/listener/liked-track-row.tsx:50` (лайк)
- `app/(listener)/u/[userId]/friend-liked-track-row.tsx:43` (лайк)
- `app/(listener)/artists/[slug]/artist-popular-tracks.tsx:116` (лайк)
- `components/sortable-track-row.tsx` — ветка `default` (drag-хендл l.79, remove l.102);
  ветка `roomy` уже видима на таче (`opacity-70`) — не трогать.

## Вне объёма (следующие срезы)

- Расширять НАБОР действий per-row (вложенные меню share/playlist в ⋮ списков) — этот срез
  только переносит существующие действия и чинит видимость, новых не добавляет.
- Косметические оверлеи play на обложках (`track-row.tsx:74` и т.п.) — тап по обложке/строке
  и так играет; оверлей декоративен, форсить тёмную заливку на каждой обложке не нужно.
- Плеер (fullscreen/mini/scrubber) — Срез 2; страница трека/артиста шапки — Срез 3;
  dashboard-строки (`posts-manager`) — Срез 4; purchase-строки — Этап 2 (UI отвязан).

## Переиспользование

`AdaptiveMenu`, `Sheet`, `useIsDesktopPointer`, `touchTargetClass`, `toast` — всё готово
(Срез 0 / существующее). Новых примитивов не заводим.

## Тесты

- `track-share.test.tsx` — рендерит пункты, «С момента» только при `currentTime > 2`,
  copy пишет верный URL (link vs `?t=`), toast вызывается (мок).
- `add-to-playlist-button.test.tsx` — на тач-ветке (мок `useIsDesktopPointer=false`) контент
  панели рендерится внутри Sheet (роль dialog); toggle/optimistic сохранены.
- Существующий `adaptive-menu.test`/`sheet.test` уже покрывают примитивы.

## Гейты

typecheck (web) · lint · check:routes · test · audit:design · build.
