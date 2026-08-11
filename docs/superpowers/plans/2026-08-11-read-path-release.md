# Read-path релиза (Platform Core, волна 2 · шаг 2.2)

## Контекст

Программа Platform Core, волна 2 — «read-path в HTTP» (главный блокер: 27/53 страниц читают
БД напрямую, HTTP-эквивалента экранов нет → мобильный клиент невозможен, SDUI бессмыслен).
Шаг 2.1 (артист) закрыт коммитом `b79dbe7f`. Следующий по `docs/migration-plan.md` — 2.2, релиз.

Сегодня страница релиза
(`apps/web/app/[locale]/(listener)/artists/[slug]/releases/[releaseId]/page.tsx`) собирает
экран сама: `getArtist(slug)` + `ReleaseService.getWithTracks` + правила видимости
(`isReleasePubliclyVisible` / `isCountdownVisible`) + `getPresaveState` — прямо в компоненте.
HTTP-эквивалента нет: `GET /api/v1/releases/[releaseId]` отдаёт `{release, tracks}` без артиста,
темы и пресейва, и обслуживает ленивую догрузку очереди плеера
(`apps/web/lib/player/lazy-queue-fetchers.ts`), а не экран. Побочно: `getPageData` не
мемоизирован — `generateMetadata` и рендер дают два одинаковых чтения релиза за запрос.

Итог шага: экран релиза доступен и в процессе (RSC), и по HTTP из одной реализации в core,
с типизированным контрактом ответа. Спека — `docs/superpowers/specs/2026-08-11-read-path-release.md`.

## Решение

Одна реализация, два входа — механика шага 2.1 один в один.

### Срез A — порт, сервис, реализация (core + db)

**`packages/core/src/music/catalog/repositories/release-read.ts`** — порт `IReleaseReadRepository`:
`findArtistBySlug(slug)`, `findArtistById(id)`, `findReleaseWithTracks(releaseId)`,
`isPresaved(userId, releaseId)`.

**`packages/core/src/music/catalog/types/release-page.ts`** — `ReleasePageView`:
`{ artist: ArtistProfile; release: Release; tracks: Track[]; isReleased: boolean; showCountdown: boolean; presaved: boolean }`.

**`packages/core/src/music/catalog/services/release-page.ts`** — `ReleasePageService(repo, clock: Clock)`,
`getPage({ releaseId, artistSlug: string | null, viewerId: string | null })` → `Result<ReleasePageView, NotFoundError>`.
Правила (переезжают со страницы без изменений):

| Условие | Результат |
|---|---|
| Релиз или артист не найден | `NotFoundError` |
| Передан `artistSlug` и `release.artistProfileId ≠ artist.id` | `NotFoundError` |
| `DRAFT` / `ARCHIVED` / `SCHEDULED` без даты | `NotFoundError` |
| `PUBLISHED` / `SCHEDULED` с наступившей датой | `isReleased: true` |
| `SCHEDULED` с будущей датой | `showCountdown: true`, **`tracks: []`** |

`artistSlug` опционален: страница передаёт (слаг в URL → расхождение = 404), HTTP-роут не
передаёт и резолвит артиста по `release.artistProfileId`. `presaved` спрашивается только при
`viewerId && showCountdown`. Время — инъектируемый `Clock` из `platform/ports/effects`.
Переиспользовать существующие `isReleasePubliclyVisible` / `isCountdownVisible`
(`packages/core/src/music/catalog/release-visibility.ts`), новых правил не писать.

`tracks: []` в отсчёте — не косметика: по HTTP полный агрегат утёк бы трек-листом невышедшего
релиза (ресурсный роут ровно поэтому 404-ит такие релизы, см. его `route.test.ts`).

**`packages/db/src/repositories/release-read.ts`** — `DrizzleReleaseReadRepository`, тонкие
обёртки: `DrizzleArtistRepository.findBySlug`, `DrizzleReleaseRepository.findWithTracks`,
`getPresaveState` (`queries/release-presaves.ts`). Единственное новое чтение — артист по id:
добавить `findById` в `DrizzleArtistRepository` рядом с `findBySlug`, тем же маппером
(в `IArtistRepository` метода нет). Экспорт из `packages/db/src/index.ts`.

**Тест** `release-page.test.ts` на фейковом репозитории: 404 (нет релиза / нет артиста /
слаг не совпал / DRAFT / ARCHIVED / SCHEDULED без даты), отсчёт (пустые треки, presaved для
вошедшего, отсутствие вызова `isPresaved` для гостя и для вышедшего релиза), вход без слага
резолвит артиста по id.

### Срез B — два входа и контракт (web + api-contracts)

**`packages/api-contracts/src/release-page.ts`** — `releasePageResponseSchema` (даты → ISO).
Схемы `artistProfileSchema` / `releaseSchema` / `themeTokensSchema` / `artistLinkSchema` сейчас
приватные внутри `src/artist-page.ts` — вынести в общий модуль (`src/catalog.ts`) и импортировать
в обе схемы, дублей не заводить. Реэкспорт из `index.ts`.

**`apps/web/lib/release-page.ts`** — `getReleasePage = cache((slug, releaseId) => …)`: собирает
репозиторий, где `findArtistBySlug` берётся из общего кэша сегмента
(`findArtistBySlug` из `apps/web/lib/artist-page.ts`) — паттерн `cachedRepository()` оттуда же.
Мемоизация схлопывает двойное чтение релиза (metadata + рендер).

**`apps/web/app/api/v1/releases/[releaseId]/page/route.ts`** — `GET`: сервис + маппинг в контракт,
404 на `NotFoundError`, `viewerId` из сессии (экран публичный, `requireAccess` не нужен).
Существующий `/api/v1/releases/[releaseId]` **не трогаем** — у него другой контракт и живой
потребитель (плеер); отклонение от формулировки плана зафиксировать в `migration-plan.md`.

**Страница** переключается на `getReleasePage`; разметка, порядок секций, `generateMetadata` и
`opengraph-image.tsx` не меняются. В ветке отсчёта `auth()` остаётся только ради `isAuthed`.

**Тесты роута** (`route.test.ts`): 200 + парс ответа `releasePageResponseSchema`, 404 на скрытых
статусах, отсчёт отдаёт `tracks: []`, `presaved` для гостя и для вошедшего.

### После срезов

Отметка 2.2 ✅ в `docs/migration-plan.md`, журнал фаз в `docs/roadmap/platform-core-brief.md`,
строка ресурса в `docs/api-contracts.md`. Старые query-функции и `ReleaseService.getWithTracks`
не удаляются — держат откат и нужны другим экранам.

## Исполнение

Срезы последовательные (B зависит от A), каждый — сабагент на Sonnet по этому плану; ревью
дифа — отдельный прогон Sonnet по VireMusic-чеклисту.

## Проверка

```
pnpm --filter @vire/core typecheck && pnpm --filter @vire/core test
pnpm --filter @vire/db typecheck
pnpm turbo run check:layers
pnpm --filter @vire/web typecheck && pnpm --filter @vire/web lint
pnpm --filter @vire/web check:routes && pnpm --filter @vire/web check:i18n
pnpm --filter @vire/web test && pnpm --filter @vire/web build
```

Плюс сверка «до/после» на экране релиза: вышедший релиз (трек-лист, liner notes, play),
SCHEDULED в будущем (отсчёт + пресейв), чужой слаг в URL → 404. UI не меняется, поэтому
`audit:design` не обязателен, но прогоняется вместе с остальными.

## Откат

Один revert: страница возвращается на `getPageData`, роут удаляется, контракт и сервис
остаются безвредными.
