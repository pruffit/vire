# Спека: read-path релиза (волна 2, шаг 2.2)

**Основание:** `docs/migration-plan.md` §волна 2 · продолжение шага 2.1 (артист).

## Проблема

Страница релиза (`app/[locale]/(listener)/artists/[slug]/releases/[releaseId]/page.tsx`)
собирает экран сама: `getArtist(slug)` + `ReleaseService.getWithTracks` + правила видимости
(`isReleasePubliclyVisible`/`isCountdownVisible`) + `getPresaveState` — всё в компоненте.
HTTP-эквивалента экрана нет: `GET /api/v1/releases/[releaseId]` отдаёт только `{release, tracks}`
без артиста, темы и состояния пресейва, и его потребитель — ленивая догрузка очереди плеера
(`lib/player/lazy-queue-fetchers.ts`), а не экран.

Побочно: `getPageData` не мемоизирован — `generateMetadata` и рендер страницы дают два
одинаковых чтения релиза за запрос.

## Решение

Одна реализация, два входа (`architecture.md` §4), как в шаге 2.1:

1. `ReleasePageService` в `@vire/core` за портом `IReleaseReadRepository`.
2. Страница вызывает сервис в процессе (через `cache()`-обёртку в `apps/web/lib/release-page.ts`).
3. Новый `GET /api/v1/releases/[releaseId]/page` вызывает тот же сервис.
4. Контракт ответа — `releasePageResponseSchema` в `@vire/api-contracts`, contract-тест на роут.

Существующий `GET /api/v1/releases/[releaseId]` **не трогаем**: это ресурсный эндпоинт плеера,
у него другой контракт и другой потребитель. Отклонение от формулировки плана
(«роут есть, страница не использует») зафиксировать в `migration-plan.md`.

## Правила экрана (переезжают в сервис как есть)

| Условие | Результат |
|---|---|
| Релиз не найден | `NotFoundError` |
| Артист не найден | `NotFoundError` |
| Передан `artistSlug` и `release.artistProfileId ≠ artist.id` | `NotFoundError` |
| `DRAFT` / `ARCHIVED` / `SCHEDULED` без даты | `NotFoundError` |
| `PUBLISHED` или `SCHEDULED` с наступившей датой | экран релиза (`isReleased: true`) |
| `SCHEDULED` с будущей датой | экран отсчёта (`showCountdown: true`), **`tracks: []`** |

`artistSlug` опционален: страница передаёт его (URL содержит слаг — расхождение = 404),
HTTP-роут не передаёт и резолвит артиста по `release.artistProfileId`.

**`tracks: []` в режиме отсчёта** — не косметика: страница трек-лист невышедшего релиза не
рендерит, а по HTTP полный агрегат утёк бы (существующий ресурсный роут ровно поэтому 404-ит
такие релизы). Гейт живёт в сервисе, значит одинаков для обоих входов.

`presaved` спрашивается только при `viewerId` **и** `showCountdown` — на вышедшем релизе
пресейв не показывается.

Время — инъектируемый `Clock` (`platform/ports/effects`), не `new Date()` внутри логики.

## Границы

- Разметка, порядок секций, метаданные и OG-картинка не меняются.
- Старые query-функции и `ReleaseService.getWithTracks` не удаляются (держат откат, нужны другим экранам).
- Число запросов к БД на рендер не растёт: артист берётся из общего `cache()` сегмента
  (`lib/artist-page.ts`), агрегат мемоизирован — чтение релиза схлопывается с двух до одного.

## Проверка

Гейты `typecheck` core/db/web, `test` core/web, `lint`, `check:routes`, `check:i18n`,
`check:layers`, `build`. Contract-тест парсит ответ роута той же схемой, что импортирует клиент.

## Откат

Один revert: страница возвращается на `getPageData` со старыми вызовами, роут удаляется,
контракт остаётся безвредным.
