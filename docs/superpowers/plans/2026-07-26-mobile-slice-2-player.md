# План реализации — Срез 2 (плеер, узкий вьюпорт)

Спека: `docs/superpowers/specs/2026-07-26-mobile-slice-2-player-design.md`
Ветка: `feat/mobile-first` (продолжение). BASE = `0c7b1b6`. Не пушить/тегать без команды.
Изменения адаптивно-визуальные — новых юнит-тестов нет (см. спеку §Тесты); верификация гейтами.

Одна задача реализации (одному Sonnet-сабагенту — файлы связаны темой «тач-таргеты плеера»).

## Шаг 1 — `components/player/controls.tsx`
- `PlayerToggleButton`: к className добавить `pointer-coarse:min-w-11 pointer-coarse:min-h-11
  inline-flex items-center justify-center` (сохранить `relative p-2 -m-1 transition-colors`).
- skip-кнопки prev/next (две `motion.button` с `p-2 -m-1`): то же — `pointer-coarse:min-w-11
  pointer-coarse:min-h-11 inline-flex items-center justify-center`.
- `Controls({...})` — добавить проп `size?: 'bar' | 'full'` (дефолт `'bar'`); прокинуть в
  `PlayPauseButton size={size}`.
- `PlayPauseButton`: принять `size: 'bar' | 'full'`. Класс размера:
  `bar` → `w-10 h-10`; `full` → `w-12 h-12 pointer-coarse:w-14 pointer-coarse:h-14`.
  Иконки play/pause в `full` крупнее (напр. через проп size у PlayIcon/PauseIcon, если поддерживают;
  иначе оставить дефолт — не критично). Остальное (bg-primary, spinner, error) без изменений.

## Шаг 2 — `components/player/fullscreen.tsx`
- Кнопка сворачивания (`ChevronDownIcon`, `w-9 h-9`): +`pointer-coarse:w-11 pointer-coarse:h-11`.
- Контейнер: `px-6 py-12` → `px-6 py-8 sm:py-12`.
- Центр-блок `my-auto w-full max-w-md flex flex-col items-center gap-8` → `gap-6 sm:gap-8`.
- `<Controls showWaveMode={false} showShuffle showRepeat />` → добавить `size="full"`.

## Шаг 3 — `components/player/queue-panel.tsx`
- Грип-кнопка (`p-2.5 -m-1`): +`pointer-coarse:min-w-11 pointer-coarse:min-h-11 inline-flex
  items-center justify-center`. Сохранить `touch-none cursor-grab active:cursor-grabbing shrink-0`.

## Шаг 4 — `components/player-like-button.tsx`
- Импорт `touchTargetClass` из `@/components/popover` и `cn` из `@/lib/utils`.
- className кнопки: обернуть текущий в `cn(touchTargetClass('sm'), 'items-center justify-center',
  'shrink-0 inline-flex transition-[color,opacity] duration-150')`. `w-11 h-11 -m-1.5` даёт 44px
  хит-зону, центрирует heart; визуальный размер иконки (15/18) и анимации не меняются.
- Проверить, что в трек-строках/мини-баре layout не поехал (негативный маргин компенсирует).

## Шаг 5 — mini-bar (проверка, правок может не быть)
- `components/player/mini-bar.tsx`: `<Controls showShuffle showRepeat hideExtrasBelowSm />` —
  size по дефолту `'bar'`, менять не нужно. Убедиться, что play остаётся 40px в баре.

## Гейты (после реализации)
`pnpm --filter @vire/web typecheck && lint && check:routes && test && audit:design && build`.

## Самокритика
Независимый Sonnet по дифу: мобилка (реальные 44px, не сломан ли desktop/mini-bar layout негативными
маргинами), дубли, layout-shell (нет min-h/h-screen), утечки, краевые (like footprint в плотных
строках, hero-play в фуллскрине не перекрывает соседей, `touch-none` грипа цел).
