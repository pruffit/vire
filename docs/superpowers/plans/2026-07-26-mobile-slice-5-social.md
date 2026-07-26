# Срез 5 — Соц / app-screen: план реализации

Спека: `../specs/2026-07-26-mobile-slice-5-social-design.md`. Одна сессия-реализатор
(Sonnet), последовательно (задачи связаны общим новым примитивом). Затем самокритика
(Sonnet), фиксы, гейты, коммит.

## Задача 1 — новый примитив `AdaptivePopover`

Файл: `apps/web/components/adaptive-popover.tsx` (рядом с `adaptive-menu.tsx`).

Контентный аналог `AdaptiveMenu`: тот же паттерн ветвления `useIsDesktopPointer()`, но
принимает произвольный `children`, а не `MenuItem[]`.

Пропсы:
```ts
interface AdaptivePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: (props: PopoverTriggerProps) => ReactNode;
  children: ReactNode;
  title?: string;
  align?: 'left' | 'right';
  drop?: 'up' | 'down' | 'auto';
  panelClassName?: string;   // класс контент-панели поповера (десктоп)
}
```
- Десктоп: `<Popover open trigger align drop panelClassName>{children}</Popover>`.
- Тач: как в `AdaptiveMenu` — `<div className="relative shrink-0">{trigger(...)}<Sheet open onClose anchor="bottom">{title && <p .../>}{children}</Sheet></div>`, `triggerRef` для возврата фокуса.
- Заголовок шита — тот же стиль, что в `AdaptiveMenu` (`px-4 pt-1 pb-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground`).
- Импорты: `Popover, type PopoverTriggerProps` из `@/components/popover`; `Sheet` из `@/components/sheet`; `useIsDesktopPointer`.

Проверить фактические имена типов/пропсов в `components/popover.tsx` перед реализацией.

## Задача 2 — `ProfileMoreMenu` → `AdaptiveMenu`

Файл: `apps/web/components/friends/profile-more-menu.tsx`.

Заменить `<Popover>…<PopoverItem/>…</Popover>` на `<AdaptiveMenu open onOpenChange
align="right" trigger={…} items={[…]} />`. Два пункта:
- `{ label: 'Пожаловаться', icon: <Icon name="thumbs-down" size={15}/>, onClick: () => setModal('report') }`
- `{ label: 'Заблокировать', icon: <Icon name="ban" size={15}/>, onClick: () => setModal('block') }`

`AdaptiveMenu` сам закрывает меню при выборе — убрать ручные `setOpen(false)` в onClick.
Триггер-кнопку («Ещё», `h-11 w-11`) сохранить как есть, обернув в `trigger={({ toggle, ref }) => …}`.
Модалки Report/Block не трогать.

## Задача 3 — `JamParticipants` (popover) → `AdaptivePopover`

Файл: `apps/web/app/(listener)/jam/[code]/jam-participants.tsx`.

Только ветка `variant === 'popover'`. `variant === 'inline'` НЕ трогать. Заменить `Popover`
на `AdaptivePopover` с `title="Участники"`, `align="left"`, `drop="down"`,
`panelClassName="w-56"`. Контент — тот же список `ParticipantRow`, но убрать у обёртки
десктоп-специфичные `w-56` (ширину задаёт `panelClassName`); оставить `max-h-72
overflow-y-auto py-1` для десктопа — на таче Sheet сам скроллит, лишние max-h не мешают,
но чтобы список не рос бесконечно, оставить `overflow-y-auto`. Триггер-кнопку сохранить.

## Задача 4 — `JamInvite` → `AdaptivePopover`

Файл: `apps/web/components/jam-invite.tsx`.

Заменить `Popover` на `AdaptivePopover` с `title="Пригласить друзей"`, `align="left"`,
`drop="down"`, `panelClassName="w-64"`. Контент (загрузка/пусто/список друзей с кнопкой
«Пригласить») без изменений логики. `handleOpenChange` (ленивая загрузка друзей при
открытии) сохранить — передать в `onOpenChange`. Триггер (`touchTargetClass('md')`) сохранить.

## Задача 5 — `IncomingRequests` flex-wrap

Файл: `apps/web/components/friends/incoming-requests.tsx`.

Ряд (сейчас `flex items-center gap-3 …`) → разрешить перенос кнопок под имя на узком:
- родитель ряда: `flex flex-wrap items-center gap-x-3 gap-y-2`.
- блок «аватар + имя» обернуть/пометить так, чтобы держал читаемый минимум и не давал
  кнопкам схлопнуть имя: аватар остаётся `shrink-0`; имя `min-w-0 flex-1`; блок кнопок
  `flex shrink-0 items-center gap-2 ml-auto`. Ключ — чтобы при нехватке ширины кнопки
  переносились на новую строку, а не сжимали имя. Достичь через `basis`: сделать
  идентити-часть (аватар+имя) единым флекс-элементом с `flex min-w-0 flex-1 basis-[12rem]
  items-center gap-3`, тогда при сумме > 100% блок кнопок (`shrink-0`) уходит на строку ниже.
- Проверить визуально логикой ширин: на `sm+` (≥384px контента) — в одну строку; на 320px —
  кнопки под именем. Кнопки уже `min-h-11` — не трогать.

## Задача 6 — кнопка «назад» в чате

Файл: `apps/web/app/(listener)/messages/[conversationId]/page.tsx`, строка ~49.

`grid h-9 w-9 … md:hidden` → добавить `pointer-coarse:h-11 pointer-coarse:w-11`
(десктоп-fine на мобилке остаётся компактным; коэрс — 44px). Ничего больше не менять.

## Задача 7 — заметная плитка Джема

Файл: `apps/web/app/(listener)/library/page.tsx`, блок `md:hidden` (строки ~40–54).

Сделать плитку заметной точкой входа «Слушать вместе», сохранив `md:hidden` и `href="/jam"`:
- акцентная подложка (не pure-gray — иначе `audit:design`): тонкий акцентный градиент/тинт
  (например `bg-linear-to-br from-primary/10 to-primary/[0.03] border-primary/20`) —
  согласовать с токенами оболочки, чтобы читалось как «живая» плитка, но не кричало.
- иконка крупнее (`h-12 w-12` тайл, акцентный фон), подпись «Джем» + «Слушать вместе».
- справа шеврон (`Icon name="chevron-right"`) как аффорданс перехода.
- тач-таргет: вся плитка — `<Link>`, высота ≥56px (уже `py-3.5`), ок.
Комментарий-строку про «плитка единственный путь» сохранить (это неочевидное «почему»).

## Задача 8 — `JamAddPanel` тач-таргет строки

Файл: `apps/web/app/(listener)/jam/[code]/jam-add-panel.tsx`, кнопка результата (строка ~65).

Добавить `pointer-coarse:min-h-11` к `className` кнопки-строки (сейчас `py-2`). Иконку
«плюс» (`w-6 h-6`) оставить визуальной — целевая зона это вся строка.

## Тесты

- Новый примитив `AdaptivePopover` — рендер-smoke необязателен (тонкая обёртка над
  протестированными `Popover`/`Sheet`), но если тривиально — короткий тест на то, что
  на десктоп-ветке рендерит children (мок `useIsDesktopPointer`). По усмотрению реализатора;
  не раздувать. Существующие тесты не должны сломаться.
- Прогнать полный набор гейтов (Iron Law).

## Документация

Обновить `docs/features/mobile-patterns.md`:
- в «Где код» — добавить `adaptive-popover.tsx` рядом с `adaptive-menu.tsx`.
- в «Правила / Меню действий» — уточнить: меню действий → `AdaptiveMenu`, контентные
  поповеры (списки участников/друзей) → `AdaptivePopover`.
- новый подраздел «Соц-экраны (Срез 5)»: миграции на adaptive, flex-wrap заявок, 44px
  «назад», заметная плитка Джема, тач-таргет строк JamAddPanel.

## Гейты (Iron Law — свежий прогон перед «готово»)

```
pnpm --filter @vire/web typecheck
pnpm --filter @vire/web lint
pnpm --filter @vire/web check:routes
pnpm --filter @vire/web test
pnpm --filter @vire/web audit:design
pnpm --filter @vire/web build
```
