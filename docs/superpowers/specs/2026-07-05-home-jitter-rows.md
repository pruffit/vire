# Главная: добить джиттер/лаги + «Свежие релизы» и «Подборки» в одну строку

Дата: 2026-07-05. Продолжение QA v1.13 — юзер: «проблема осталась» (скрин: счётчик
«1» с зелёной точкой из «Сейчас слушают» отрисован в стороне от строки) + «скрой
свежие релизы и подборки в одну строку + скролл».

## Диагноз (рецидив №4 scroll-jitter)

Diff главной v1.11.0..HEAD минимален (только ScrollRow) → дёргается то, что было
всегда, промоутеры композит-слоёв внутри скролл-области:

1. **`animate-ping` в LivePulse** (`components/listening-now.tsx:132`,
   `components/live-listeners.tsx:55`) — бесконечная transform+opacity анимация →
   постоянный композит-слой; на скрине юзера точка+счётчик нарисованы со смещением
   от своей строки. Классический layer desync.
2. **`backdrop-blur-md` в каждой карточке релиза** (`components/release-quick-look.tsx:195`,
   hover-кружок play) — backdrop-filter создаёт слой даже при opacity-0; на главной
   ~40 карточек = ~40 слоёв → лаги.

## Решение

### A. Джиттер
- Новый переиспользуемый `components/live-pulse.tsx`: точка `bg-current` +
  paint-only пульс через box-shadow keyframes (box-shadow не компоузится → нет
  слоя, перерисовка крошечной области — дёшево). Цвет — через `currentColor`.
- `globals.css`: `@keyframes vire-live-pulse` (box-shadow 0→5px spread до
  transparent, старт `color-mix(in oklab, currentColor 60%, transparent)`) +
  `@utility animate-live-pulse` (1.8s infinite).
- `listening-now.tsx`: локальный LivePulse удалить, использовать общий с
  `text-green-400`.
- `live-listeners.tsx`: инлайн ping-разметку заменить на общий компонент
  (цвет унаследуется от родителя `color: var(--artist-accent)`).
- `release-quick-look.tsx`: убрать `backdrop-blur-md` из hover-кружка
  (bg-black/55 + ring достаточно).

### B. Одна строка + скролл
`app/(listener)/page.tsx`: секции «Свежие релизы» и «Подборки» — вместо grid
использовать `ScrollRow` по образцу «Новое у подписок»:
`<ScrollRow className="flex gap-5 -mx-1 px-1 snap-x">` + обёртка элемента
`shrink-0 w-40 snap-start`. «Скоро выйдет» и «Артисты» не трогать (GRID остаётся).

## Не-цели
- animate-pulse в queue-panel/content-kit/ui-kit (не на главной, оверлеи) — не трогаем.
- Блюр-подложка FeaturedRelease (только при нейтральном accent, редкий случай) — не трогаем.

## Верификация
Гейты: typecheck, lint, check:routes, test, audit:design, build.
