# План: расширение жанров до Discogs-400

Спека: `docs/superpowers/specs/2026-07-06-genre-expansion-design.md`.

## Шаг 1 — канонический датасет + справочники (Sonnet-сабагент)

Единый источник — новый `DISCOGS_TO_GENRE` (все 400 меток, ~1:1) в
`apps/worker/src/lib/discogs-genre-map.ts` + `DROPPED_LABELS`. Из него выводятся:

- `packages/db/src/schema/releases.ts` — `genreEnum`: новые значения append-only в конец.
- `packages/core/src/types/release.ts` — `ALL_GENRES` зеркало (тот же порядок).
- `apps/web/lib/genres.ts` — `Genre` (type-only из `@vire/core`), `GENRE_LABELS`
  (все ~370), `GENRE_GROUPS` (~20 групп).
- `packages/db/src/genre-families.ts` — `GENRE_FAMILY` (каждый жанр → семейство),
  экспорт из индекса пакета.
- `apps/worker/src/lib/genre-policy.ts` — порог 0.05.
- Тесты-инварианты (см. спеку): worker map-тест (полнота 400), web mirror-тест,
  тест семейств.
- Миграция: `pnpm --filter @vire/db db:generate`.

## Шаг 2 — «Волна»: family-подматчинг (Sonnet-сабагент)

`packages/db/src/queries/wave.ts`:
- seed-фильтр: `tgf.genre = ANY(семейство сида)`;
- session-boost: то же расширение;
- `genreScore`: family-пересечение с весом 0.2 (точное 0.4 приоритетно);
- taste-жанры: family-терм с половинным весом (0.125 против 0.25).
Расширение множеств считается в TS через `GENRE_FAMILY`, в SQL — `textArrayParam`.

## Шаг 3 — самокритика (независимый Sonnet) + гейты + доки

- Ревью дифа по VireMusic-чеклисту + спот-чек маппинга (семантика имён жанров).
- `typecheck / lint / check:routes / test / audit:design / build` (+ worker test).
- Обновить `docs/features/auto-genre.md`, `docs/features/wave.md`.
- Коммит. Версия/тег — по команде.
