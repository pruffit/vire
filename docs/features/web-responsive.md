# Адаптив веба (мобайл-фёрст база)

Это про **`apps/web` на узком экране**, а не про мобильное приложение — соседние
`mobile-design-system.md` и `mobile-player.md` описывают React Native. Файл раньше
назывался `mobile-patterns.md` и путался с ними.

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
- `apps/web/components/adaptive-popover.tsx` — `AdaptivePopover`: тот же паттерн ветвления,
  но контентный (произвольные `children`, не список пунктов) — для списков участников/друзей.
  На таче сам оборачивает контент в скролл-обёртку (`flex-1 min-h-0 overflow-y-auto`) — потребителю
  не нужно городить `max-h`/`overflow` под шит. На десктопе поповер получает `role="dialog"`
  (не `menu`) — контент не объявляется скринридеру как пустое меню.
- `apps/web/components/popover.tsx` — десктоп-поповер + `touchTargetClass('sm' | 'md')`
  (хит-зона 44px без изменения визуального футпринта кнопки); `touchPill` — 44px мин-высота
  для текстовых пилюль/чипов/табов (`pointer-coarse:min-h-11` + `inline-flex items-center`),
  десктоп-плотность не трогает.
- `apps/web/components/ui-kit.tsx` — `fieldClass` (базовый инпут/textarea/select форм)
  несёт `pointer-coarse:min-h-11`; тянется во все формы дашборда и в триггеры `Select`/
  `DateField` (оба используют `fieldClass` для кнопки-триггера — отдельно трогать не пришлось).
  `selectClass` (компактные инлайн-селекты админ-таблиц) НЕ тронут — свой плотный контекст.
- `apps/web/components/side-nav.tsx` — пункт `SideNav` (дашборд/листенер-сайдбар) —
  `pointer-coarse:min-h-11`.
- `apps/web/components/color-field.tsx` — live color picker: свотч `pointer-coarse:h-11/w-11`,
  hue-слайдер `pointer-coarse:h-5`, hex-инпут `pointer-coarse:min-h-11`.
- `apps/web/lib/is-desktop-pointer.ts` — `(hover: hover) and (pointer: fine)`,
  `useIsDesktopPointer()` (`useSyncExternalStore`, SSR-safe).
- `apps/web/components/listener/mobile-tab-bar.tsx` — 5 пунктов (`md:hidden`).
- `apps/web/components/scroll-row.tsx` — рейлы: кнопки-шевроны на `pointer-fine`, fade-маска
  на `pointer-coarse`. Помимо рельсов главной (Срез 0) — теперь и `home/cover-rail.tsx`
  (домашний плей-рейл) и жанр-ряд `artist-catalog.tsx` (`/artists`).
- `packages/ui/src/components/{button,input}.tsx` — `pointer-coarse:h-11` (44px на таче) для
  cva-контролов UI-кита.
- `apps/web/components/player/{controls,fullscreen,queue-panel}.tsx`, `components/player-like-button.tsx`
  — тач-таргеты плеера: транспорт/грип/сворачивание `pointer-coarse:min-w-11/min-h-11` (иконки с
  `p-2 -m-1` — маргин компенсирует footprint); play/pause крупнее в фуллскрине через `Controls size="full"`
  (`w-12` / `pointer-coarse:w-14`); like — `pointer-coarse:w-11/h-11/-m-1.5` (хит-зона на таче, десктоп
  не тронут). Ряд Controls `gap-4 sm:gap-5` — влезает на 320px без гориз-скролла.
- `apps/web/components/add-to-playlist-button.tsx` — адаптивно: `Sheet anchor="bottom"` на таче /
  motion-popover на десктопе (ветка по `useIsDesktopPointer()`), контент панели — общий
  `panelContent(dense)`; триггер — произвольная иконка-кнопка на `touchTargetClass('md')` (см. ниже).
- `apps/web/components/track-share.tsx` — `TrackShare` на `AdaptiveMenu` (sheet/popover), пункты
  «ссылка» / «с момента `?t=`»; фидбэк копирования — `toast` (инлайн-морф не показать в sheet).
- **Контентные экраны (Срез 3)** — артист/релиз/трек/профиль под узкий вьюпорт:
  крошки трека `flex-wrap` + `truncate max-w-[16rem]` на сегментах; `MetaRow` (длит./BPM/
  тональность) `flex-wrap`; тач-таргеты на `pointer-coarse` — соц-ссылки артиста
  (`h-11/min-w-11`), «любимый момент» и отписка (`w-11/h-11`), `LikeButton` трека
  (`min-h-11`), кнопки linked-accounts и правки имени/аватара в profile-hero
  (`min-h-11` + coarse-gated `inline-flex items-center`); корни артиста и профиля —
  `overflow-x-clip` (как на релиз/трек). Иконки-хинты (карандаш имени, оверлей камеры)
  — `pointer-coarse:opacity-100`, иначе на таче невидимы.

## Правила

- **Раздел desktop/mobile** — брейкпоинт `md` (768px). Указатель — `pointer-fine`/`pointer-coarse`
  (медиа), НЕ userAgent.
- **Меню действий:** `AdaptiveMenu` — единый примитив; sheet на таче, поповер на десктопе.
  Не заводить новые desktop-поповеры для тач-действий.
- **Контентные поповеры** (списки участников/друзей, не пункты меню): `AdaptivePopover` —
  тот же sheet/поповер по `useIsDesktopPointer()`, но принимает произвольные `children`.
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

## Таблицы (Срез 4)

Общий примитив `components/ui-kit.tsx` (`Table`/`Thead`/`Tr`/`Td`, реэкспорт в
`components/admin/ui.tsx`) сам разворачивает таблицу в **стек карточек под `md`** (<768px):
`<thead>` скрыт, `<table>`/`<tbody>`/`<tr>`/`<td>` становятся блоками, каждая строка — карточка.

- **`<Td label="Колонка">`** — на мобилке рендерит «подпись: значение» (`flex justify-between`);
  на `md`+ подпись скрыта, обычная ячейка. Подпись = дословный текст `<Th>` этой колонки.
- **`<Td>` без `label`** — значение блоком на всю ширину: первичная ячейка (название/email —
  заголовок карточки) и ячейка действий (футер) идут БЕЗ label.
- **`minWidth` передавать `md:`-префиксом** (`minWidth="md:min-w-[880px]"`) — иначе на мобилке
  ширина форсит гориз-скролл и рефлоу не виден. Нельзя строить `md:${minWidth}` в рантайме
  (Tailwind JIT не увидит класс) — только литерал в call-site.
- Пустые состояния — через `<Tr><Td colSpan={N}>`, не сырые `<tr><td>` (иначе на мобилке не карточка).
- Ряд действий с несколькими контролами — `flex-wrap` (в карточке места меньше, чем в строке).
- Значение-обёртка использует `md:contents` — на десктопе span прозрачен, DOM/лейаут не меняются.

## Соц-экраны (Срез 5)

- `ProfileMoreMenu`, `JamParticipants` (variant `popover`), `JamInvite` — переведены на
  `AdaptiveMenu`/`AdaptivePopover`: sheet на таче, поповер на десктопе как раньше.
  `JamParticipants` variant `inline` (десктоп-панель) не тронут.
- `IncomingRequests` — ряд заявки `flex-wrap`: аватар+имя единым флекс-элементом
  (`basis-[12rem]`), блок кнопок `shrink-0 ml-auto` — на 320–360px кнопки уходят под имя,
  не схлопывая его.
- Кнопка «назад» в шапке диалога (`messages/[conversationId]`) — `pointer-coarse:h-11
  pointer-coarse:w-11` поверх десктоп-fine `h-9 w-9`.
- Плитка «Джем» в «Медиатеке» — акцентный тинт (`primary/10`→`primary/[0.03]`,
  border `primary/20`), крупнее иконка (`h-12 w-12`), шеврон справа как аффорданс перехода.

## Каталоги/поиск/главная (Срез 6)

- Сквозной `touchPill` на пилюлях/чипах/табах фильтров и сортировки: чипы «Потока»
  (`wave-chips.tsx`), сортировка + жанр-чипы `artist-catalog.tsx` (`/artists`), табы
  сортировки `releases/page.tsx`, жанр-чипы `search-releases-section.tsx`.
- `Section` «Показать все» (`listener/section.tsx`) — хит-зона 44px негативным маргином
  (`pointer-coarse:py-3.5 pointer-coarse:-my-3.5`: text-xs lh16 + 28 = 44px), не сдвигает
  хедер секции; покрывает все секции главной разом.
- Поля поиска — `artist-catalog.tsx` (сырой `<input>`, стили расходятся с `@vire/ui Input`
  — просто `pointer-coarse:h-11`), `global-search.tsx` `variant="page"` (`pointer-coarse:h-11`);
  кнопка-иконка поиска на десктопе центрирована (`top-1/2 -translate-y-1/2`), на
  `pointer-coarse` растёт до 44×44 (`top-0 bottom-0 translate-y-0 w-11`), инпут резервирует
  `pointer-coarse:pr-11` под неё — иконка не сдвигается, десктоп-поведение не меняется.
- Плей-оверлеи `pointer-coarse:opacity-100` (правило web-responsive) — на `home/cover-rail.tsx`,
  `release-quick-look.tsx`, `listening-now.tsx`. Затемнение-подложка и иконка-бейдж —
  РАЗНЫЕ элементы: подложка `group-hover` только (иначе на таче обложка затемнена всегда),
  `pointer-coarse:opacity-100` вешается на иконку, не на подложку.
- Плотность mobile-only (`sm:` возвращает десктоп): вертикальные отступы главной `page.tsx`
  `space-y-10 sm:space-y-16`; сетка артистов `/search` `grid-cols-2 sm:grid-cols-3 md:grid-cols-5
  xl:grid-cols-7 2xl:grid-cols-9` (компактнее, чем `/artists` `2/3/4/5/6` — совпадают только два
  младших брейкпоинта, в поиске обоснованно больше колонок). Хиро `featured-release.tsx`
  НЕ сжимали: `h-96` — минимум, при котором контент не переполняет бокс на узком экране.
- Мелкие лайк-кнопки без хит-зоны — `touchTargetClass('sm')`: `editorial-playlist-card.tsx`;
  строки треков в quick-look-шите `release-quick-look.tsx` — `pointer-coarse:min-h-11`
  (вся строка тапом).

## Дашборд артиста + плотность (Срез 7)

- Общие слои дашборда — `fieldClass` (44px на всех текстовых полях/селектах/датапикерах
  форм), `SideNav` (пункты навигации), `ColorField` (свотч/hue-слайдер/hex) — см. «Где код»
  выше. Правка общего слоя = фикс сразу во всех формах-потребителях (create/edit-release,
  smart-link-form, edit-profile-form, credits-editor).
- `ThemeEditor` (`components/theme-editor.tsx`) — грид `ColorField` bg/text/accent
  `grid-cols-1 sm:grid-cols-2`: на 320px поля стекаются в один столбец, попап цвет-пикера
  (`absolute left-0 w-56`) влезает в full-width поле; во 2-й колонке `grid-cols-2` он вылезал
  за экран. Грид пресетов палитры (`grid-cols-4 sm:grid-cols-6`) не тронут — там нет попапов.
- Трек-редактор `app/dashboard/releases/[id]/track-manager.tsx` — grip-хендл, кнопки
  «параметры»/«удалить» → `pointer-coarse:size-11`; reanalyze-иконка → `touchTargetCoarse('sm')`;
  инпут тональности → `pointer-coarse:min-h-11`. DnD-реордер остаётся как есть (альтернатива
  кнопками вверх/вниз — бэклог).
- Вложенные пикеры — `GenrePicker`/`MoodPicker`/`CreditsEditor` пилюли на `touchPill`;
  их иконки поиска/reanalyze/remove — `pointer-coarse:min-h-11`/`touchTargetCoarse('sm')`.
- **`touchTargetCoarse` vs `touchTargetClass`:** для иконок в ПЛОТНЫХ рядах дашборда — только
  гейтнутый `touchTargetCoarse` (`components/popover.tsx`, `pointer-coarse:size-11 + -m`): на
  десктопе футпринт не меняется (безусловный `touchTargetClass` со своим `-m-1.5` съедал бы
  зазор между кнопками и на мыши; плюс `mt-*` + `-m-*` в одном `cn` конфликтуют в tailwind-merge).
- Точечные CTA дашборда (`PublishButton`, `DeleteReleaseButton`, `LyricsEditor` «Сохранить
  текст», `posts-manager` кнопки, `LinksEditor` remove-иконка) — тач-таргет 44px, десктоп
  без изменений. `PublishButton` — обёртка `min-h-6` (не `h-6`): фикс-высота не давала кнопке
  вырасти до 44px на таче (налезала на соседей).
- `fieldClass` (`pointer-coarse:min-h-11`) гейтнут `pointer-coarse` — долетает и до
  edit-форм бэкофиса (`admin/*/edit`, create-artist-form, videos-editor), но десктоп-админку
  не трогает (coarse на десктопе не срабатывает).
- Отступы контейнеров: 14 (listener)-страниц (главная, каталоги, релиз/трек, профиль,
  друзья, плейлисты и т.д.) переведены с `px-5 sm:px-6 lg:px-8` на `px-4 sm:px-6 lg:px-8`
  (только мобильный базовый класс) — контент выровнен с уже-`px-4` навом/дашбордом/
  админкой/джемом. Full-bleed hero-блоки артиста/релиза/профиля рендерятся вне padded-
  контейнера — не задеты.

## Бэклог мобилки (27.07): контейнер, реордер, переключение артиста

- `apps/web/components/page-container.tsx` — `PageContainer`: единственный источник правды
  для рамки страницы (`w-full max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8`), варианты
  `default | overlap | detail | compact` и `spaceY`. Литералы классов — целиком в мапах
  (Tailwind должен видеть класс в исходнике). Все `(listener)`-страницы и их `loading.tsx`
  переведены на него; расходившиеся скелетоны приведены к раскладке живой страницы.
- `apps/web/lib/reorder.ts` — чистая `swapAdjacent(list, id, dir)`; общая для плейлиста,
  очереди плеера, джем-очереди и трек-менеджера релиза.
- Тач-реордер: кнопки ↑/↓ рядом с грипом, видимы только на `pointer-coarse` (десктоп —
  drag как был), хит-зона через `touchTargetCoarse('sm')`, границы списка гасят кнопку
  (`disabled`). Подключены в `sortable-track-row`, `queue-panel`, `track-manager`.
- Оверлеи не уезжают за экран: `clampPanelX` (чистая) + `useViewportClampX` меряет панель
  после открытия и сдвигает её трансформом внутрь вьюпорта с полем 8px; зашит в `Popover`.
  Поповеры со своей разметкой дополнительно клэмпятся по ширине `max-w-[calc(100vw-2rem)]`.
- `MobileArtistSwitcher` (`app/dashboard/mobile-artist-switcher.tsx`) — топ-бар дашборда на
  мобилке: аватар+имя, при нескольких артистах открывает `Sheet` со списком. Логика
  переключения вынесена в общий хук `useArtistSwitcher` (десктопный селект не тронут).
- `ArtistCard` (`components/artist-card.tsx`) — одна карточка артиста вместо трёх копий:
  `variant="grid"` (каталог, поиск, вкусы) и `variant="chip"` (лента главной, с hover-попапом
  через портал — иначе его клипает `overflow-x` рельса).

## Навигация

Мобильный таб-бар (5): Главная / Поиск / Медиатека / Друзья / Сообщения. Бейдж входящих
заявок — на Друзьях, непрочитанных — на Сообщениях (live через `useChatUnread`). Джем —
контекстная сессия (не раздел): плитка в Медиатеке (`app/(listener)/library/page.tsx`,
видна только `md:hidden`) + запуск из плеера (раскатка), таб-бару не место.

## Ограничения

- Браузерный хром прячется только в установленном приложении (`display: standalone`,
  см. [pwa-offline.md](pwa-offline.md)) — в Яндекс Браузере установка недоступна (нет WebAPK),
  там по-прежнему компенсируем плотностью UX.
- `pointer: coarse` — про основной указатель; на гибридах (тач-ноутбуки) контролы могут
  увеличиться — это безопасно, просто больше хит-зона.

## Раскатка

Срезы 1–6 (`docs/superpowers/specs/2026-07-22-mobile-first-program.md`): трек-действия,
плеер, контентные экраны, таблицы дашборда/админки, соц/app-screen, каталоги.
Срез 7 — дашборд артиста + плотность. Бэклог 27.07
(`docs/superpowers/plans/2026-07-27-jam-audio-overlays-mobile-backlog.md`): `PageContainer`,
тач-реордер, клэмп оверлеев, переключение артиста с телефона, единая `ArtistCard`.
