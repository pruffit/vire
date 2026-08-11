# План: read-path артиста (шаг 2.1)

**Спека:** `docs/superpowers/specs/2026-08-11-read-path-artist.md` · Срезы последовательные.

---

## Срез A — порт, сервис, реализация (Sonnet)

**core:**
- `packages/core/src/music/catalog/repositories/artist-read.ts` — порт `IArtistReadRepository`:
  `findBySlug(slug)`, `hasPublishedTrack(artistId)`, `isMember(artistId, userId)`,
  `listPublishedReleases(artistId)`, `listUpcoming(artistId)`, `listPosts(artistId, limit)`,
  `listSmartLinks(artistId)`, `listPlayableTracks(artistId)`, `explicitReleaseIds(releaseIds)`,
  `followerCount(artistId)`, `isFollowing(userId, artistId)`, `presavedReleaseIds(userId, releaseIds)`.
  Типы данных, которых ещё нет в core (upcoming, playable track, smart link, post) — объявить
  в `music/catalog/types/artist-page.ts`, повторяя форму существующих строк `@vire/db`.
- `packages/core/src/music/catalog/services/artist-page.ts` — `ArtistPageService.getPage(input)`,
  `input = { slug, viewerId: string | null }`. Возвращает `Result<ArtistPageView, NotFoundError>`.
  Правила: артист не найден или (нет опубликованных треков и зритель не участник) → `NotFoundError`;
  параллельные чтения через `Promise.all` в том же составе, что сегодня на странице;
  explicit-флаги склеиваются с релизами; `following`/`presavedIds` — только при `viewerId`,
  иначе `false`/пустой набор; `presavedReleaseIds` спрашивается только по upcoming с датой.
- Тест `artist-page.test.ts` на фейковом репозитории: видимость (скрыт/участник/есть треки),
  гость vs залогиненный, порядок и состав возвращаемого, отсутствие лишних вызовов порта.

**db:**
- `packages/db/src/repositories/artist-read.ts` — `DrizzleArtistReadRepository`, **тонкие обёртки**
  над существующими функциями (`getUpcomingByArtist`, `listArtistPosts`, `getPublishedSmartLinks`,
  `getArtistPlayableTracks`, `getExplicitReleaseIds`, `getFollowState`, `getFollowerCount`,
  `getPresaveStates`, `artistHasPublishedTrackById`, `isArtistMember`, `DrizzleArtistRepository.findBySlug`,
  `DrizzleReleaseRepository.findPublishedByArtist`). SQL не переписывать. Экспорт из `packages/db/src/index.ts`.

**Гейты:** typecheck core/db, test core, `check:layers`.

---

## Срез B — два входа и контракт (Sonnet)

- `packages/api-contracts/src/artist-page.ts` — `artistPageResponseSchema` (даты → ISO-строки),
  реэкспорт из `index.ts`.
- `apps/web/app/api/v1/artists/[slug]/page/route.ts` — `GET`: сервис + маппинг в контракт;
  404 на `NotFoundError`; актор из сессии (`requireUser` не нужен — экран публичный,
  `viewerId = session?.user?.id ?? null`). Contract-тест: ответ парсится схемой.
- `apps/web/app/[locale]/(listener)/artists/[slug]/page.tsx` — `getArtistData` переключается
  на `ArtistPageService`; персональный блок (`following`/`followerCount`/`presavedIds`) берётся
  оттуда же. Существующий `/api/v1/artists/[slug]` и `artist-guard.ts` не трогать.
  **Поведение и разметка не меняются** — только источник данных.
- Тесты роута: 200 для видимого, 404 для скрытого, персональные поля для гостя и для юзера.

**Гейты:** typecheck/lint/test web, `check:routes`, `check:i18n`, `audit:design`, build.

---

## После срезов

Сверка «до/после» на странице артиста (состав и порядок секций), обновление
`docs/features/` при необходимости, отметка шага 2.1 в `docs/migration-plan.md`.
Старые прямые вызовы query-функций из страницы удаляются **не сейчас**, а после прода.
