# План: discovery через людей и вкус

Дизайн — `docs/superpowers/specs/2026-07-28-discovery-people-taste-design.md`.
Два среза: A (сигналы и данные), B (поверхности).

## Срез A — сигналы

### A1. Чистое ранжирование (`packages/core/src/services/discovery-scoring.ts`)
Образец стиля — `feed-ranking.ts` и `wave-scoring.ts` (константы + чистые функции, без IO).
- типы в `packages/core/src/types/discovery.ts`: `DiscoveryReason` (`friends | similar | taste`),
  `DiscoveryCandidate` (артист + `coListen`, `tasteOverlap`, `friendListeners`, `sourceArtistId`),
  `RankedDiscoveryArtist`;
- `friendSignal(friendListeners)`, `tasteOverlapScore(a, b)` (жанры/настроения после
  `expandGenresToFamilies`), `scoreDiscoveryArtist(candidate)`, `discoveryReason(candidate)`,
  `composeDiscovery(candidates, { limit, maxPerSource })`;
- веса из спеки: 0.45 / 0.35 / 0.20; `friendSignal = min(1, n/3)`;
- экспорт из `packages/core/src/index.ts`.
- Тесты: friendSignal насыщается на 3; причина выбирается по старшему сигналу;
  кап на источник соблюдён; дедуп; пустой вход → пустой выход.

### A2. Данные (`packages/db/src/queries/similarity.ts`)
- `getSimilarArtists(artistProfileId, limit)` — Jaccard по слушателям за 90 дней
  (`play_events`, `user_id is not null`), порог ≥2 общих слушателя, + пересечение жанров;
  окно считается в SQL (`now() - interval '90 days'`).
- `getDiscoveryCandidates(userId, limit)` — три источника (похожие на топ-артистов вкуса,
  слушаемые друзьями за 90 дней, совпадение по жанрам вкуса), исключая подписки
  (`follows`) и уже слушанных артистов.
- TTL-кэш `createTtlCache` (10 мин) на обе функции, ключ — id артиста / id юзера.
- Жанры/настроения артиста — одним агрегатом по списку id, не подзапросом на строку.
- Грабли: `Date` в raw `sql` не интерполировать; колонку в `sql` внутри `.select()` не
  интерполировать (ссылаться литералом на внешнюю таблицу).
- Экспорт из `packages/db/src/index.ts`.

### A3. Сшивка
- `apps/web/lib/discovery.ts` — `buildDiscovery(userId, limit)` и `buildSimilarArtists(artistProfileId, limit)`:
  кандидаты из `@vire/db` → `scoreDiscoveryArtist`/`composeDiscovery` из `@vire/core`.
- Тесты на сшивку (порог «< 4 кандидатов → пусто» и «< 3 для похожих» держит UI, не lib —
  lib просто отдаёт отранжированное).

## Срез B — поверхности

- `apps/web/components/home/discovery-section.tsx` — секция «Открытия для вас»
  (авторизованным, до 12 карточек, подпись-причина), рендер через существующий `ArtistCard`;
  не рендерится при < 4 кандидатах. Подключить в `app/(listener)/page.tsx` под `Suspense`
  рядом с секцией «Артисты».
- Блок «Похожие артисты» на `app/(listener)/artists/[slug]/page.tsx` — до 8 карточек,
  не рендерится при < 3; поставить после «Релизы», до «Площадки» (порядок секций страницы
  описан в `docs/features/artist-profile.md` — сверить и обновить документ).
- Мобилка: горизонтальная лента на `ScrollRow` как у соседних секций, тач-таргеты 44px.
- Тесты: подпись-причина по сигналу, порог нерендера, отсутствие секции у анонима.

## Документация
- `docs/features/discovery.md` — сигналы, веса, пороги, поверхности, кэш, ограничения.
- `docs/roadmap/stage-2.md` §7.4 → ✅ со ссылкой на дизайн и фичедок.
- `docs/features/artist-profile.md` — новый блок в порядке секций.

## Гейты
`@vire/core typecheck` · `@vire/core test` · `@vire/db typecheck` · `@vire/web typecheck` ·
`lint` · `check:routes` · `test` · `audit:design` · `build` (собирать из `apps/web`).
