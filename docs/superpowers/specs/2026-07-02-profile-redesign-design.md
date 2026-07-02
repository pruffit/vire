# Профиль слушателя — редизайн (full-width, личный хаб) + доводка поиска

Дата: 2026-07-02 · Ветка: `feat/artist-page-redesign`

## Контекст и цель

`/profile` сейчас — почти пустая узкая страница (`max-w-4xl`): карточка
идентичности, ссылка на медиатеку, «Способы входа». `/library` уже полностью
владеет плейлистами/лайками/подписками. Задача: превратить `/profile` в
**полноширинный личный хаб слушателя** в визуальном языке страницы артиста
(редизайн ветки), не дублируя `/library`, а дополняя его.

Параллельно — **доработать страницу поиска** (незакоммиченный диф: full-width,
круглые карточки артистов сеткой, релизы через `ReleaseQuickLook`): верифицировать,
довести, закоммитить.

## Направление (утверждено пользователем)

- Роль профиля: **личный хаб + настройки** (не поглощает `/library`).
- Функции: **музыкальный вкус**, **лента активности**, **превью медиатеки**,
  **настройки оформления**.
- Hero: **в языке артиста** (full-bleed ambient-баннер, крупный аватар с glow,
  контейнер `max-w-[120rem]`, секции `SectionHeader` + `animate-fade-up`).

## Ограничения

- Платформа тёмная (OKLCH-токены), переключения темы нет → «настройки оформления»
  = **тумблер приглушения движения** (localStorage → класс на `<html>` → CSS +
  `MotionProvider`). Тему НЕ добавляем (вне объёма).
- Этап-2 покупки не показываем.
- App-shell: без `min-h-screen`/`h-screen`; высоту даёт скролл-область.
- Мобилка обязательна: hero и секции адаптивны, сетки схлопываются в 1–2 колонки.

## Данные

Уже приходят в `page.tsx`: `getLikedTracksCached` (до 100, с `likedAt`,
`durationSec`, artistName/slug/cover), `getFollowedArtistsCached` (с `followedAt`),
`getUserPlaylistsCached` (с `createdAt`), `getUserProfile`.

**Новое (packages/db):** `getListenerTaste(userId)` в новом модуле
`queries/listener-taste.ts`:
```ts
interface ListenerTaste {
  topGenres: { genre: TrackGenre; count: number }[];   // GROUP BY жанр по лайкнутым трекам, top 6
  topArtists: { id; slug; name; avatarUrl; verified; likeCount }[]; // GROUP BY артист по лайкам, top 10
}
```
Обе агрегации — в SQL (GROUP BY по `likes` → `tracks` → `track_genres`/
`artist_profiles`). Кэш-обёртка `getListenerTasteCached` в `lib/listener-data.ts`.
Экспорт типа `ListenerTaste` из `@vire/db`.

**Производное (в page, без новых запросов):**
- Статы hero: `likes`, `following`, `playlists` (как сейчас) + суммарная
  длительность лайков (`Σ durationSec`) → «N часов любимого».
- Лента активности: слить `likedTracks`(like) + `followedArtists`(follow) +
  `playlists`(create) в один хронологический список по времени, взять top 12.

## Архитектура фронта (FSD, переиспользование)

Роут: `app/(listener)/profile/page.tsx` (server) — фетч + компоновка.
Контейнер как у артиста: full-bleed баннер + `w-full max-w-[120rem] mx-auto
px-5 sm:px-6 lg:px-8 pb-16 -mt-16 sm:-mt-24 relative z-10`.

Компоненты (в `components/listener/profile/`):

1. **`ProfileBanner`** (server, pure) — ambient-градиент (нейтральный, тинт
   `--primary`) высотой `clamp(160px,22vh,280px)`, как fallback-баннер артиста.
2. **`ProfileHero`** (client) — аватар с glow + загрузка/удаление фото + инлайн-
   редакт имени (переиспользуем логику из текущего `ProfileCard`: upload/remove/
   edit), email, «с {месяц} {год}», стат-чипы. `ProfileCard` разбираем: его
   функциональность переезжает в `ProfileHero` + `AccountSection`.
3. **`TasteSection`** (server, pure) — секция «Вкус»: топ-жанры чипами
   (`GENRE_LABELS`) + ряд топ-артистов (аватар-кружок + имя + `like count`),
   ссылки на `/artists/[slug]`. Пусто → аккуратный `EmptyState` с подсказкой
   лайкать треки.
4. **`ActivityFeed`** (server, pure) — хронология с иконкой на тип события
   (лайк/подписка/плейлист), относительная дата в UTC (без гидрации-issues),
   ссылки на объект. Пусто → `EmptyState`.
5. **`LibraryPreviews`** (server) — 2-колоночный на lg блок:
   - Плейлисты (первые 6) через существующий `PlaylistCard` + `CreatePlaylistButton`.
   - Любимые треки (первые 5) через существующий `LikedTrackRow`.
   - Подписки (ряд) через существующий `FollowedArtists`.
   Каждый под-блок — заголовок + ссылка «Вся медиатека →» (`/library`, якоря
   `#liked`). НИЧЕГО не дублируем — переиспользуем компоненты `components/listener/*`.
6. **`AccountSection`** (client-обёртка) — `LinkedAccounts` (как есть) +
   **`AppearanceSettings`** (тумблер приглушения движения) + «Выйти».
7. **`AppearanceSettings`** (client) — тумблер: `localStorage['vire-reduce-motion']`
   → `document.documentElement.classList.toggle('vire-reduce-motion')`. Читает
   начальное значение до пейнта (маленький inline-скрипт в `app/layout.tsx` или
   эффект + без FOUC-критичности — движение не критично к FOUC, ставим в эффекте).

**Раскладка секций (использует всю ширину):**
```
[ full-bleed banner ]
[ ProfileHero: аватар + имя/почта/дата + стат-чипы ]           (full width)
[ TasteSection: жанры-чипы + ряд топ-артистов ]                (full width)
[ lg: ActivityFeed (1/3)  |  LibraryPreviews (2/3) ]           (2-col → stack на мобилке)
[ AccountSection: входы · оформление · выйти ]                 (full width, ограничен по ширине)
```

## Настройки оформления (детали)

- CSS: добавить в `globals.css` правило-близнец блока `prefers-reduced-motion:
  reduce` под селектором `html.vire-reduce-motion` (глушим `animation`/`transition`).
- `MotionProvider`: расширить — читать флаг (localStorage) и подписку на его смену
  (custom event/`storage`), передавать `reducedMotion={reduce ? 'always' : 'user'}`.
  Дефолт «user» сохраняется (уважаем систему).
- Тумблер оптимистичен: класс переключается сразу, значение пишется в localStorage.

## Поиск (доводка)

Незакоммиченный диф уже приводит `/search` к full-width и сеткам. План:
1. Верифицировать типы (`SearchArtist.firstReleaseCoverUrl` есть, `ReleaseQuickLook`
   принимает форму — подтверждено).
2. Убедиться, что треки-список визуально консистентен (оставляем список — это ок,
   как на странице артиста; грид только для артистов/релизов).
3. Прогнать гейты, закоммитить как отдельный коммит (доводка поиска) до профиля.

## Тесты

- `packages/db`/pure: если логика слияния активности станет нетривиальной — вынести
  в чистую функцию `lib/activity.ts` (`mergeActivity(likes, follows, playlists)`) и
  покрыть unit-тестом (сорт по времени, лимит, форма элементов).
- Топ-жанры/артисты — SQL-агрегация, покрываем логику маппинга если выносится в pure.
- App-shell инвариант не нарушаем (тест `layout-shell` уже стоит).

## Гейты (обязательно перед «готово»)

`typecheck · lint · check:routes · test · audit:design · build`.

## Вне объёма (YAGNI)

Переключение светлой темы; история прослушиваний (нет per-user запроса play-events);
покупки (Этап 2); настройки уведомлений (нет инфраструктуры).
