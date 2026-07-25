# Срез 2 — Плеер (узкий вьюпорт)

**Дата:** 2026-07-26
**Программа:** `docs/superpowers/specs/2026-07-22-mobile-first-program.md` (Срез 2)
**Фундамент:** `docs/features/mobile-patterns.md` (тач-таргет 44px: cva-контролы `pointer-coarse:h-11`,
произвольные иконки — `touchTargetClass`).

## Проблема

Плеер уже частично адаптивен (мини-бар: `MobileQueueButton` `sm:hidden`, `TopProgressLine`-скраб,
`hideExtrasBelowSm`; фуллскрин: `useIsDesktopPointer` прячет громкость, свайп-закрытие, cover
`w-64 sm:w-80`). Но транспорт и мелкие кнопки не дотягивают до тач-таргета 44px:

- `controls.tsx`: play/pause `w-10 h-10` (40px); prev/next/shuffle/repeat/wave — `p-2 -m-1`
  вокруг иконок 16–18px → хит-зона ~32–34px.
- `fullscreen.tsx`: кнопка сворачивания `w-9 h-9` (36px).
- `queue-panel.tsx`: грип реордера `p-2.5 -m-1` (~34px).
- `player-like-button.tsx`: хит-зона = размер иконки (15/18px) — тогда как соседняя queue-кнопка
  в трек-строках уже 44px через `touchTargetClass` (несогласованность).
- фуллскрин `py-12`/`gap-8` — на низких экранах вертикаль тесновата (контент скроллится, но плотно).

## Цель

Все интерактивные элементы плеера тапабельны (≥44px хит-зона) на таче; play/pause в фуллскрине —
крупный hero на мобилке; десктоп-плотность и поведение не меняются. App-shell не трогаем
(фуллскрин — `fixed inset-0` оверлей, не в скролл-области).

## Объём

### 1. Транспорт ≥44px на таче (`controls.tsx`)
- prev/next/shuffle/repeat/wave (`PlayerToggleButton` и skip-кнопки): хит-зона 44px на
  `pointer-coarse` без изменения визуала иконки — добавить `pointer-coarse:min-w-11
  pointer-coarse:min-h-11` + `inline-flex items-center justify-center` (padding/`-m` уже есть,
  но их мало). Десктоп (`pointer-fine`) — как сейчас.
- play/pause — hero в фуллскрине: `Controls` получает проп `size?: 'bar' | 'full'` (дефолт `'bar'`).
  `PlayPauseButton` читает: `'bar'` → `w-10 h-10` (как сейчас, мини-бар); `'full'` →
  `w-12 h-12 pointer-coarse:w-14 pointer-coarse:h-14`, иконка крупнее. Fullscreen передаёт
  `size="full"`, мини-бар — `'bar'` (дефолт).

### 2. Кнопка сворачивания фуллскрина (`fullscreen.tsx`)
`w-9 h-9` → добавить `pointer-coarse:w-11 pointer-coarse:h-11` (визуал шеврона не трогаем).

### 3. Грип очереди (`queue-panel.tsx`)
`p-2.5 -m-1` → хит-зона 44px на таче: `pointer-coarse:min-w-11 pointer-coarse:min-h-11` +
центрирование. Драг-жест уже с грипа (dragListener=false) — не ломать `touch-none`.

### 4. `PlayerLikeButton` — 44px хит-зона
Обернуть/расширить кнопку через `touchTargetClass('sm')` (`w-11 h-11 -m-1.5`, как соседняя
queue-кнопка) — heart-визуал (15/18px) и анимации не меняются, footprint компенсируется `-m`.
Улучшает во всех местах использования (мини-бар, фуллскрин, трек-строки) консистентно.

### 5. Плотность фуллскрина на низких экранах (`fullscreen.tsx`)
`px-6 py-12` → `px-6 py-8 sm:py-12`; центр-блок `gap-8` → `gap-6 sm:gap-8`. Cover уже
`w-64 sm:w-80`. Контент по-прежнему скроллится (`overflow-y-auto`).

## Вне объёма

- Логика транспорта/движка (audio-engine, store, hotkeys) — не трогаем.
- Джем-мини-бар (`JamMiniBar`) — соц-срез (Срез 5); его play-кнопка уже 40px `active:scale`.
- Волна/лирика контент — Срез 3 (контентные экраны) / отдельно.

## Переиспользование

`touchTargetClass` (`components/popover.tsx`), `useIsDesktopPointer`, встроенный вариант
`pointer-coarse` TW v4. Новых примитивов нет.

## Тесты

Изменения — чисто адаптивно-визуальные (CSS-классы + один проп размера без ветвления логики).
Юнит-тесты классов были бы тавтологией (против философии `vire-testing` — тестируем поведение,
не классы). У плеера нет компонентных UI-тестов (покрыты `lib/store`-логика). Верификация:
существующий suite (регресс), `audit:design`, `build`, инвариант `layout-shell.test.ts`,
самокритика (Sonnet) + ручной прогон Danya локально. Новых юнит-тестов не добавляем.

## Гейты

typecheck · lint · check:routes · test · audit:design · build.
