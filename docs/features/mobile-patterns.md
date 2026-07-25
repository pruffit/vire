# Мобильные паттерны (мобайл-фёрст база)

Единый свод паттернов минимального вьюпорта. Фундамент заложен в Срезе 0
(`docs/superpowers/plans/2026-07-22-mobile-slice-0-foundation.md`); срезы 1–6 раскатки
(`docs/superpowers/specs/2026-07-22-mobile-first-program.md`) ссылаются сюда.

## Что делает

Задаёт переиспользуемые примитивы и правила для узкого вьюпорта (<768px), не меняя
десктоп: bottom-sheet-меню действий, тач-таргеты, навигацию, аффордансы прокрутки.

## Где код

- `apps/web/components/sheet.tsx` — `Sheet` (портал в body, drag-dismiss, esc, safe-area,
  offset под плеер), проп `anchor: 'center' | 'bottom'`. `SheetDragHandle` — свайп с шапки
  контента (сама шторка тоже даёт свайп за встроенный граббер сверху).
- `apps/web/components/quick-look-sheet.tsx` — обёртка `Sheet anchor="center"` (peek-карточки).
- `apps/web/components/adaptive-menu.tsx` — `AdaptiveMenu`: `Popover` на десктопе /
  `Sheet anchor="bottom"` со списком на таче (ветка по `useIsDesktopPointer()`). Тип
  `MenuItem`. Примитив сам закрывает меню при выборе пункта на обеих ветках — вызывающему
  коду закрывать не нужно.
- `apps/web/components/popover.tsx` — десктоп-поповер + `touchTargetClass('sm' | 'md')`
  (хит-зона 44px без изменения визуального футпринта кнопки).
- `apps/web/lib/is-desktop-pointer.ts` — `(hover: hover) and (pointer: fine)`,
  `useIsDesktopPointer()` (`useSyncExternalStore`, SSR-safe).
- `apps/web/components/listener/mobile-tab-bar.tsx` — 5 пунктов (`md:hidden`).
- `apps/web/components/scroll-row.tsx` — рейлы: кнопки-шевроны на `pointer-fine`, fade-маска
  на `pointer-coarse`.
- `packages/ui/src/components/{button,input}.tsx` — `pointer-coarse:h-11` (44px на таче) для
  cva-контролов UI-кита.
- `apps/web/components/add-to-playlist-button.tsx` — адаптивно: `Sheet anchor="bottom"` на таче /
  motion-popover на десктопе (ветка по `useIsDesktopPointer()`), контент панели — общий
  `panelContent(dense)`; триггер — произвольная иконка-кнопка на `touchTargetClass('md')` (см. ниже).
- `apps/web/components/track-share.tsx` — `TrackShare` на `AdaptiveMenu` (sheet/popover), пункты
  «ссылка» / «с момента `?t=`»; фидбэк копирования — `toast` (инлайн-морф не показать в sheet).

## Правила

- **Раздел desktop/mobile** — брейкпоинт `md` (768px). Указатель — `pointer-fine`/`pointer-coarse`
  (медиа), НЕ userAgent.
- **Меню действий:** `AdaptiveMenu` — единый примитив; sheet на таче, поповер на десктопе.
  Не заводить новые desktop-поповеры для тач-действий.
- **Тач-таргет 44px — два механизма, не смешивать:**
  - cva-контролы UI-кита (`Button`, `Input` и т.п.) — модификатор `pointer-coarse:h-11`
    (или `size-11` для icon-варианта) прямо в cva-конфиге.
  - произвольные иконки-кнопки вне UI-кита (например `AddToPlaylistButton`) —
    `touchTargetClass('sm' | 'md')` из `components/popover.tsx`: увеличивает только
    хит-зону (`w-11 h-11` с отрицательным margin), не трогая визуальный размер кнопки.
- **safe-area:** нижние закреплённые элементы — `pb-[env(safe-area-inset-bottom)]`
  (таб-бар, bottom-sheet).
- **Плеер-offset:** центрированные шиты (`anchor="center"`) сдвигают `paddingBottom` под
  играющий плеер, чтобы контент не оказывался под мини-баром.
- **App-shell неизменен:** `min-h-screen`/`h-screen` запрещены; высоту даёт скролл-область
  (см. CLAUDE.md § «Лейаут и скролл»). `Sheet` — портал в `document.body`, не внутрь
  скролл-области (иначе `fixed` ловит трансформированного предка).
- **Аффорданс рейлов:** горизонтальная лента с переполнением (`ScrollRow`) показывает
  fade-маску краёв на таче; на десктопе (`pointer-fine`) — кнопки-шевроны поверх маски.
- **Видимость действий строк:** hover-reveal-обёртки действий трек-строк (лайк, удаление,
  drag-хендл) — `opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100`: на десктопе
  появляются по hover, на таче видны всегда (hover'а нет). `pointer-coarse`/`pointer-fine` —
  встроенные варианты Tailwind v4, отдельной регистрации не требуют.

## Навигация

Мобильный таб-бар (5): Главная / Поиск / Медиатека / Друзья / Сообщения. Бейдж входящих
заявок — на Друзьях, непрочитанных — на Сообщениях (live через `useChatUnread`). Джем —
контекстная сессия (не раздел): плитка в Медиатеке (`app/(listener)/library/page.tsx`,
видна только `md:hidden`) + запуск из плеера (раскатка), таб-бару не место.

## Ограничения

- Браузерный хром на мобилке не прячется (нет PWA/WebAPK в Яндекс Браузере) — компенсируется
  плотностью UX.
- `pointer: coarse` — про основной указатель; на гибридах (тач-ноутбуки) контролы могут
  увеличиться — это безопасно, просто больше хит-зона.

## Раскатка

Срезы 1–6 (`docs/superpowers/specs/2026-07-22-mobile-first-program.md`): трек-действия,
плеер, контентные экраны, таблицы дашборда/админки, соц/app-screen, каталоги.
