# План реализации — Срез 1 (трек-действия и списки)

Спека: `docs/superpowers/specs/2026-07-25-mobile-slice-1-track-actions-design.md`
Ветка: `feat/mobile-first` (продолжение). BASE = `cdd3c57`. Не пушить/тегать без команды.
TDD: тест → реализация → зелёные гейты.

## Task 1 — `TrackShare` → `AdaptiveMenu`
Файл: `components/track-share.tsx` (+ `components/track-share.test.tsx` новый).
- Убрать `useState open`/`copied`/`timerRef` инлайн-морф; ввести `open` state под `AdaptiveMenu`.
- `items`: `[{label:'Ссылка на трек', icon:link, onClick: copy('link')}]` + (при `moment != null`)
  `{label:'С текущего момента', hint: formatDuration(moment), onClick: copy('moment')}`.
- `copy(kind)`: как сейчас (base = `trackUrl ?? location.href.split('?')[0]`, moment → `?t=`),
  далее `toast('Ссылка скопирована')` вместо inline-состояния.
- Триггер — прежняя motion-`ShareIcon` кнопка через `trigger={({open,toggle,ref})=>…}`; сохранить
  `size`/`align`/`variant` (bordered → та же рамка/scale-hover).
- Тест: пункты; «С момента» появляется только при `currentTime>2`; `navigator.clipboard.writeText`
  получает верный URL; `toast` вызван (мокнуть `@/lib/toast`).

## Task 2 — `AddToPlaylistButton` адаптивно (Sheet на таче)
Файл: `components/add-to-playlist-button.tsx` (+ `.test.tsx` новый).
- Вынести контент панели (заголовок, пустое состояние, список плейлистов с чекбоксами,
  строка создания/инлайн-инпут) в локальный рендер, переиспользуемый обеими ветками — без дублей.
- `const desktop = useIsDesktopPointer();`
  - desktop: текущий `AnimatePresence`+motion-popover, контент = общий рендер.
  - тач: `<Sheet open={open} onClose={()=>setOpen(false)} anchor="bottom">` с заголовком
    «Плейлисты» (`shrink-0`), списком `flex-1 min-h-0 overflow-y-auto`, строкой создания `shrink-0`.
- Триггер (motion-кнопка `touchTargetClass('md')`) — без изменений.
- `useEffect` outside-click (mousedown) оставить только для десктоп-ветки (Sheet сам ловит
  overlay-click/esc) — не вешать mousedown-листенер, когда открыт Sheet.
- Тест: мок `@/lib/is-desktop-pointer` → `useIsDesktopPointer=false`; открытие рендерит контент
  в диалоге (Sheet role=dialog); toggle плейлиста шлёт POST/DELETE, optimistic-set сохранён.

## Task 3 — Видимость экшенов строк на таче (`pointer-coarse:opacity-100`)
Одна добавка токена на сайт (десктоп hover через `pointer-fine` не трогаем):
- `components/track-list.tsx:90`
- `components/listener/liked-track-row.tsx:50`
- `app/(listener)/u/[userId]/friend-liked-track-row.tsx:43`
- `app/(listener)/artists/[slug]/artist-popular-tracks.tsx:116`
- `components/sortable-track-row.tsx` — ветка `default` для drag-хендла (l.79) и remove (l.102);
  `roomy` НЕ трогать.
Проверить, что `pointer-coarse:` вариант зарегистрирован (Срез 0 его уже использует) — build подтвердит.

## Task 4 — Доки + ledger
- `docs/features/mobile-patterns.md` — раздел «Действия строк»: правило «hover-reveal +
  `pointer-coarse:opacity-100`»; отметить, что `TrackShare`/`AddToPlaylist` адаптивны.
- `.superpowers/sdd/progress.md` — новый блок Среза 1, ledger по задачам.

## Гейты (после всех задач)
`pnpm --filter @vire/web typecheck && lint && check:routes && test && audit:design && build`.

## Самокритика
Отдельный Sonnet-сабагент по дифу: мобилка/дубли/утечки листенеров/layout-shell/краевые
(Sheet scroll-lock, focus-return, moment-хинт, optimistic откат).
