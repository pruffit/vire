# Срез 0 — Фундамент мобильных паттернов (дизайн)

**Дата:** 2026-07-22 · **Программа:** `2026-07-22-mobile-first-program.md`
**Модель раскатки:** `vire-loop` · **Гейт дизайна:** `audit:design` (Impeccable).

Цель среза — заложить переиспользуемые примитивы и навигацию, поверх которых срезы 1–6
раскатывают мобильный UX без дублей и переделок. Не трогаем бизнес-логику, только
презентационный слой `apps/web/components`, `packages/ui`, шелл-навигацию и токены.

---

## A. BottomSheet-ядро + `AdaptiveMenu`

### Проблема
`QuickLookSheet` (`components/quick-look-sheet.tsx`) уже несёт всё нужное ядро: портал в
body, backdrop, drag-to-dismiss (`useDragControls`, свайп >120px / velocity >600), Escape,
safe-area/offset под плеер. Но геометрия захардкожена под **центрированную карточку**
(`grid place-items-center`, `max-w-md`, `rounded-2xl`) — это модалка, не bottom-drawer.
Тач-действия (share / очередь / в плейлист) живут на **desktop-якорных поповерах**
(`popover.tsx`, `track-share.tsx`, `track-queue-menu.tsx`, `add-to-playlist-button.tsx`).

### Решение
1. **Выделить ядро `Sheet`** (`components/sheet.tsx`) из `QuickLookSheet`: портал + backdrop
   + drag-dismiss + Escape + player-offset + safe-area. Проп геометрии
   `anchor: 'center' | 'bottom'`:
   - `center` — текущее поведение (карточка), сохраняет всех потребителей `QuickLookSheet`.
   - `bottom` — прилипший к низу drawer: `items-end`, `w-full`, `rounded-t-2xl`,
     `max-h-[85vh]`, `pb-[env(safe-area-inset-bottom)]`, граббер сверху.
   `QuickLookSheet` становится тонкой обёрткой `Sheet anchor="center"` (drag-контекст
   `QuickLookDragHandle` и `MiniEq` сохраняются as-is — потребители не меняются).

2. **`AdaptiveMenu`** (`components/adaptive-menu.tsx`) — единый API меню действий поверх
   `useIsDesktopPointer()` (`lib/is-desktop-pointer.ts`):
   - **desktop-pointer** → рендерит существующий `Popover` + `PopoverItem`.
   - **coarse-pointer** → рендерит `Sheet anchor="bottom"` со списком тех же пунктов,
     строки `min-h-11`, крупный тап-таргет, опциональный заголовок.
   - Общий тип пункта: `{ label, icon?, hint?, onClick, disabled? }` — совпадает с
     сигнатурой `PopoverItem`, чтобы вызывающие не разветвляли данные.

3. **Проверка примитива в этом же срезе:** перевести **один** реальный потребитель —
   `track-queue-menu.tsx` — на `AdaptiveMenu` (демонстрация + регресс-тест). Полная
   раскатка share/add-to-playlist — Срез 1.

### Единицы и границы
- `Sheet` — что делает: анимированная шторка с backdrop и свайп-закрытием; вход: `open`,
  `onClose`, `anchor`, `children`; зависит от: motion, портал, `usePlayerStore` (offset).
- `AdaptiveMenu` — что делает: показывает список действий подходящим для устройства
  способом; вход: `items`, `trigger`, `open/onOpenChange`; зависит от: `Sheet`, `Popover`,
  `useIsDesktopPointer`.

---

## B. Тач-таргеты в UI-ките (pointer:coarse)

### Проблема
`packages/ui` `button.tsx`: `sm h-8` (32) / `default h-9` (36) / `icon h-9 w-9` (36) —
всё ниже тач-минимума 44px. `input.tsx` `h-9`. Триггер `add-to-playlist` `w-8 h-8` (32).
44px соблюдён лишь точечно (`touchTargetClass`, таб-бар, чипы шита).

### Решение
Добавить `pointer-coarse:`-минимум высоты в cva-размеры (встроенный вариант Tailwind v4;
`pointer-fine` уже используется в `scroll-row.tsx` — вариант рабочий):
- `button.tsx`: `sm h-8 … pointer-coarse:h-11`, `default h-9 … pointer-coarse:h-11`,
  `icon h-9 w-9 pointer-coarse:h-11 pointer-coarse:w-11`, `lg` уже 40 → `pointer-coarse:h-11`.
- `input.tsx`: `h-9 pointer-coarse:h-11`.
- Десктоп-плотность **не меняется** (вариант применяется только при `pointer: coarse`).
- `add-to-playlist-button.tsx` триггер: тач-хит-зона через существующий `touchTargetClass`
  (визуальный размер иконки можно оставить) — единый механизм с поповер-триггерами.

### Риск и граница
`pointer: coarse` — про **основной** указатель устройства; на гибридах (тач-ноут с мышью)
может дать coarse и слегка увеличить контролы — приемлемо (безопаснее мелкого таргета).
Инвариант app-shell не затрагивается (высота контролов, не страниц).

---

## C. Ревизия таб-бара

### Текущее
`mobile-tab-bar.tsx` — 4 пункта: Главная / Поиск / Медиатека / Сообщения. Джем и Друзья
вне таб-бара, доступны лишь `md:hidden`-плитками в `/library`. Бейдж «заявки в друзья»
семантически неуместно висит на **Медиатеке**. Danya выбрал «пересмотреть таб-бар».

### Решение (закрыто с Danya, 22.07)
Таб-бар из **5 пунктов**: **Главная / Поиск / Медиатека / Друзья / Сообщения**
(`grid-cols-4` → `grid-cols-5`; на 360px ≈ 72px/пункт — вмещает иконку 20px + подпись
`text-[11px]`). Семантика разведена:
- **Друзья** — постоянный социальный раздел → 5-й таб. **Бейдж входящих заявок переезжает
  на него** с Медиатеки (где он сейчас не по адресу); проп `incomingCount` перевешивается
  с `/library` на `/friends`.
- **Джем** — эфемерная сессия, не раздел → таб-бару не место. Остаётся контекстной точкой
  входа: заметная плитка в `/library` + запуск из плеера/`AdaptiveMenu`.

`isListenerShellPath`/само-скрытие таб-бара и `useChatUnread`-бейдж сообщений сохраняются.
Иконка Друзей — `IconName` из существующего набора (напр. `users`); сверить наличие в `icon.tsx`.

---

## D. Тач-аффорданс горизонтальных рейлов

### Проблема
`scroll-row.tsx` — краевые кнопки-шевроны только `pointer-fine:` (десктоп). На таче о
наличии прокрутки нет визуальной подсказки (свайп работает, но не обнаружим).

### Решение
Добавить лёгкую **краевую fade-маску** (градиент-шторка в цвет фона), видимую на
coarse-pointer, пока есть куда листать в эту сторону (переиспользовать существующую
логику «есть ли скролл» из компонента). Не кнопки — только визуальный сигнал «есть ещё».
Уважать `prefers-reduced-motion` (маска статична, без анимаций-промоутеров слоёв — см.
инвариант скролл-джиттера).

---

## E. Компактный топ-бар (<360px)

### Проблема
`nav.tsx` у артист/админ-ролей держит до 6 элементов справа (`Search + Dashboard + Admin +
NotificationBell + Profile + SignOut`) в `gap-0.5` — на очень узких (<360px) теснится.

### Решение
Второстепенное убрать из строки: `SignOut` уже дублируется в профиль-меню → на мобилке
прятать из топ-бара (`hidden sm:...`), оставив в профиле. Проверить, что Dashboard/Admin
(уже иконки на мобилке) + Bell + Profile умещаются без переносов на 320px. Точечная
полировка, без смены навигационной модели.

---

## F. Документ паттернов (единый источник)

Создать `docs/features/mobile-patterns.md` — на него ссылаются спеки срезов 1–6:
- брейкпоинт-политика (`md` = раздел desktop/mobile), `pointer-fine`/`pointer-coarse`;
- когда `Sheet`/`AdaptiveMenu` (тач) vs `Popover` (десктоп);
- тач-таргет 44px — механизмы (`pointer-coarse:` в UI-ките, `touchTargetClass` для хит-зон);
- safe-area (`env(safe-area-inset-bottom)`), offset под плеер;
- аффорданс рейлов; правило «никаких `h-screen`/`min-h-screen`, app-shell неизменен».

---

## Тестирование

- **Новое:** `Sheet` (anchor bottom/center, drag-dismiss, esc, портал), `AdaptiveMenu`
  (ветвление pointer → sheet/popover, проброс пунктов), `mobile-tab-bar` (состав пунктов,
  бейдж на новом месте, само-скрытие) — Vitest + testing-library (jsdom).
- **Регресс:** `QuickLookSheet`-потребители не сломаны (обёртка над `Sheet`).
- **Инвариант:** `app/__tests__/layout-shell.test.ts` остаётся зелёным (нет `h-screen`).
- **Гейты (все):** `typecheck` (web/core/db), `lint`, `check:routes`, `test`,
  `audit:design`, `build`.

## Явно вне скоупа Среза 0 (уходит в раскатку)

- Перевод **всех** трек-действий на `AdaptiveMenu` (share/add-to-playlist) → Срез 1.
- Таблицы дашборда/админки → карточный рефлоу → Срез 4.
- Полировка контентных/плеер-экранов → срезы 2–3.

## Роутинг моделей (реализация)

Opus (эта сессия) — дизайн/план/арбитраж. Sonnet-сабагенты — реализация примитивов и
тестов по плану (параллельно, где независимо: `Sheet`+`AdaptiveMenu` / тач-таргеты UI-кита
/ таб-бар — разные файлы). Haiku — маппинг вызовов/тривиал. Самокритика — отдельный
Sonnet-сабагент по Vire-чеклисту перед «готово».
