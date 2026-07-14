# План: теги «Потока» + fluid-ленты

Спека: `docs/superpowers/specs/2026-07-14-flow-tags-and-fluid-rails-design.md`.
Два независимых трека (разные файлы, пересечений нет).

## Трек A — все теги + шит «Все теги»

1. `apps/web/components/home/wave-chip-items.ts`
   - `topWaveChips(moods, genres, cap = 8)` → `waveChips(moods, genres)` без cap:
     сортировка `count desc` + дедуп по лейблу (логика сохраняется).
   - Добавить чистую `groupTagsForSheet(moods, genres)` → секции для шита:
     `{ label: 'Настроения', items }` + группы из `GENRE_GROUPS` (только теги с `count > 0`,
     порядок групп как в каталоге; внутри группы — по count desc). Элемент несёт
     `key/label/kind/count`.
   - Чистая `filterTagSections(sections, query)` — регистронезависимо по лейблу, пустые
     группы отбрасываются.
2. `apps/web/lib/use-wave-seed-start.ts` (новый хук) — общий старт волны по seed:
   loading-ключ + `controls.startWave(seed)` + toast на неуспех. Забрать логику из
   `wave-chips.tsx`, чтобы шит её не дублировал.
3. `apps/web/components/home/all-tags-sheet.tsx` (новый, client) — шелл существующего
   `components/quick-look-sheet.tsx` (портал/Escape/drag-to-dismiss, **не писать свой**):
   поле поиска (autofocus), секции тегов пилюлями со счётчиком, клик → хук → закрыть шит.
   Пустой результат поиска — короткое сообщение. Тач-таргеты ≥44px.
4. `apps/web/components/home/wave-chips.tsx` — первым элементом ряда кнопка «Все теги»
   (открывает шит; визуально отличается от тег-пилюль), остальные чипы — из `waveChips`.
5. `apps/web/components/home/flow-block.tsx` — передаёт полный список чипов и секции шита.
6. Тесты: обновить `wave-chip-items.test.ts` (нет cap; дедуп; сортировка) + кейсы на
   `groupTagsForSheet`/`filterTagSections`; компонентный тест шита (jsdom + testing-library,
   образец — `announcements` тест): открытие, фильтр по вводу, клик → `startWave` с seed.

## Трек B — fluid-ленты (убрать мёртвую зону)

Заменить фиксированную ширину карточек в лентах на `flex: 1 0 basis` + `max-w` (см. таблицу
в спеке). Файлы:

1. `apps/web/app/(listener)/home-sections.tsx` — `FeedSection` (`w-40`), `FreshReleasesSection`
   (`w-48`), `UpcomingSection` (`w-40`), `PlaylistsSection` (`w-40`), `ArtistsSection` (`w-28`).
2. `apps/web/components/home/cover-rail.tsx` (`w-32`) и `recent-rail.tsx` — тот же приём.
3. `apps/web/components/home/skeletons.tsx` + вызовы `RailSkeleton` в
   `app/(listener)/page.tsx` — те же классы, что у контента (иначе прыжок при стриминге).
4. `snap-start`, `shrink-0`-семантика при переполнении и краевые зоны `ScrollRow` должны
   остаться рабочими; сам `ScrollRow` не менять.
5. Проверить визуально на 1920 и 390: ряд заполнен при малом каталоге, листается при
   большом, на мобилке карточки прежнего размера.

## Гейты (после обоих треков)

`typecheck` (web/core/db) · `lint` · `check:routes` · `test` · `audit:design` · `build`.

## Ship

- Версия в двух местах (корневой `package.json` + `apps/web/package.json`).
- `docs/features/wave.md` — раздел про чипы/шит тегов на главной.
- `docs/roadmap/TODO.md` — закрыть регрессию cap=8 из пачки «Отложенное из критики главной».
