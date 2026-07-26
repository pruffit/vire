# Срез 6 — Каталоги / поиск / главная: план реализации

Спека: `../specs/2026-07-26-mobile-slice-6-catalogs-design.md`. Одна сессия-реализатор
(Sonnet), последовательно — файлы пересекаются (artist-catalog, cover-rail фигурируют в
нескольких задачах), параллель дала бы конфликты. Затем самокритика (Sonnet), фиксы, гейты, коммит.

Все правки — только `pointer-coarse:`/mobile-only, десктоп-плотность и десктоп-вид не менять.
Перед правкой файла — прочитать его целиком.

## Задача 0 — общий хелпер `touchPill`

`apps/web/components/popover.tsx` — рядом с `touchTargetClass` добавить экспорт:
```ts
/** 44px тач-таргет для текстовых пилюль/чипов/табов (десктоп-плотность сохраняется). */
export const touchPill = 'pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center';
```
Использовать во всех пилюлях задач 2–5 (аппендить в className). Если у пилюли уже есть
`inline-flex items-center` — дубли классов не вредят, но по возможности не дублировать.

## Задача 1 — `Section` «Показать все»

`apps/web/components/listener/section.tsx` (~строка 27–35). Ссылка-действие: добавить
хит-зону 44px на таче негативным маргином, чтобы не сдвигать хедер:
`pointer-coarse:py-2.5 pointer-coarse:-my-2.5` (+ при необходимости `pointer-coarse:inline-flex
pointer-coarse:items-center`). Визуальная позиция/десктоп не меняются.

## Задача 2 — чипы «Потока»

`apps/web/components/home/wave-chips.tsx` (~29–58): «Все теги» и мод/жанр-чипы (`px-3.5 py-1.5
text-sm` / `px-3 py-1`) → аппендить `touchPill`. Проверить, что в `ScrollRow` возросшая на
таче высота не ломает выравнивание ряда.

## Задача 3 — `ArtistCatalog`

`apps/web/components/artist-catalog.tsx`:
- Поле поиска (~48–54, сырой `<input> px-3 py-1.5`) → переиспользовать `@vire/ui` `Input`
  (импорт `import { Input } from '@vire/ui'` — проверить фактический путь экспорта);
  если стили расходятся (иконка/скругление) — оставить `<input>`, добавить `pointer-coarse:h-11`.
- Кнопки сортировки (~56–68) → `touchPill`.
- Жанр-чипы (~73–98): (а) `touchPill` на каждый чип; (б) ряд `overflow-x-auto no-scrollbar`
  (~73) → обернуть в `ScrollRow` (см. `components/scroll-row.tsx`, `edgeZone="sm"` для чипов,
  `bleedClassName` при необходимости — как в mobile-patterns.md). Проверить, что клиентское
  состояние выбора жанра не ломается при оборачивании.

## Задача 4 — табы сортировки релизов

`apps/web/app/(listener)/releases/page.tsx` (~54–72): пилюли `<Link ?tab=>` (`px-3.5 py-1.5
rounded-full text-sm`) → `touchPill`.

## Задача 5 — жанр-чипы поиска

`apps/web/components/search-releases-section.tsx` (~34–46): чипы (`px-2.5 py-1 text-xs`) →
`touchPill`. Ряд `flex flex-wrap` оставить (рекон: не режется горизонт-скроллом).

## Задача 6 — `GlobalSearch`

`apps/web/components/global-search.tsx`:
- `variant="page"` input (~144, `h-9 px-3`) → добавить `pointer-coarse:h-11` (десктоп h-9 сохранить).
- Кнопка-иконка поиска (~147–159, `absolute right-3`) → реальная 44px хит-зона:
  обернуть/применить `touchTargetClass('sm')` (или эквивалент с негативным маргином), сохранив
  визуальную позицию иконки.
- `onMouseDown` в дропдауне/футере НЕ менять.

## Задача 7 — `CoverRail` → `ScrollRow` + оверлей

`apps/web/components/home/cover-rail.tsx`:
- Заменить сырой контейнер (~18, `overflow-x-auto no-scrollbar`) на `ScrollRow` (как в
  `home-sections.tsx` — свериться с реальным API `ScrollRow`).
- Плей-оверлей (~43, `opacity-0 group-hover:opacity-100`) → добавить `pointer-coarse:opacity-100`.

## Задача 8 — плей-оверлеи (правило mobile-patterns)

- `apps/web/components/release-quick-look.tsx` (~184) → `pointer-coarse:opacity-100`.
- `apps/web/components/listening-now.tsx` (~106) → `pointer-coarse:opacity-100`.

## Задача 9 — плотность (mobile-only)

- `apps/web/components/featured-release.tsx` (~32, `h-96`) → `h-72 sm:h-96`.
- `apps/web/app/(listener)/page.tsx` (~41, `space-y-16`) → `space-y-10 sm:space-y-16`.
- `apps/web/app/(listener)/search/page.tsx` (~64, сетка артистов `grid-cols-3 sm:grid-cols-4…`)
  → `grid-cols-2 sm:grid-cols-3 …` (выровнять с `/artists`; сохранить старшие брейкпоинты соразмерно).

## Задача 10 — мелкие лайк-кнопки

- `apps/web/components/editorial-playlist-card.tsx` (~125–135) лайк → `touchTargetClass('sm')`
  (хит-зона без изменения визуала), как в `AddToPlaylistButton`/`TrackShare`.
- `apps/web/components/release-quick-look.tsx` строки треков в quick-look-шите (~258–279,
  `px-3 py-2`) → `pointer-coarse:min-h-11` (вся строка — таргет).

## Тесты

Правки чисто визуальные/классовые — новых тестов не требуется; существующие не должны
сломаться. Если правка меняет структуру (обёртка `ScrollRow` вокруг жанр-ряда / замена
input на `Input`) — убедиться, что связанные тесты (если есть) зелёные.

## Документация

`docs/features/mobile-patterns.md`:
- в «Где код» — `touchPill` рядом с `touchTargetClass`; отметить `ScrollRow` теперь и на
  `CoverRail`/жанр-ряде каталога.
- новый подраздел «Каталоги/поиск/главная (Срез 6)»: сквозной `touchPill` для пилюль/чипов/табов,
  хит-зона `Section`, тач-поля поиска, плей-оверлеи `pointer-coarse:opacity-100`, mobile-density.

## Гейты (Iron Law — свежий прогон перед «готово»)

```
pnpm --filter @vire/web typecheck
pnpm --filter @vire/web lint
pnpm --filter @vire/web check:routes
pnpm --filter @vire/web test
pnpm --filter @vire/web audit:design
pnpm --filter @vire/web build
```
