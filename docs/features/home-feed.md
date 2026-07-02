# Главная и лента подписок

Две входные витрины: публичная главная `/` (контент-хаб, редакционный ритм) и
персональная лента `/feed` (новое у тех, на кого подписан слушатель).

## Что делает
### Главная `/`
Контент-хаб без поиска и слоганов — только музыка, все играбельные модули
кликаются сразу в очередь плеера. Зоны идут в фиксированном редакционном
порядке (каждый персональный модуль рендерится только вошедшим и самоскрывается
при пустых данных):

1. **Featured** — редакционный выбор (последний релиз), `FeaturedRelease`.
2. **Поток** (всем) — сразу под баннером, «включи и слушай»: кнопка запуска
   **Волны** + mood-чипы, `FlowBlock` (см. [wave](wave.md)).
3. **Продолжить слушать** (вошедшим) — недавно играные треки, горизонтальный
   рейл обложек, `RecentRail` + `CoverRail` → `getRecentlyPlayed`.
4. **Для тебя** (вошедшим) — треки артистов из лайков/подписок,
   `PlayableTrackList` (plain, 2 колонки) → `getPersonalTrackPicks`.
5. **Новое у подписок** (вошедшим) — свежие релизы артистов, на которых
   подписан слушатель, горизонтальный рейл `ReleaseQuickLook` → `getFeed`.
6. **Горячие треки** (всем) — топ по прослушиваниям за 30 дней, `HotTracks`
   (ranked-список) → `getPopularTracks`.
7. **Свежие релизы** / **Скоро выйдет** (всем) — каталожные сетки,
   `ReleaseQuickLook` → `listReleases`/`getUpcomingReleases`.
8. **Сейчас слушают** (всем) — live-присутствие, `ListeningNow`
   (см. [live-presence](live-presence.md)).
9. **Подборки** (всем) — editorial + личные (добор популярным при нехватке) +
   публичные плейлисты слушателей объединены в одну секцию, де-дуплицированы
   по `id` (плейлист может одновременно попасть в несколько источников —
   например личный список слушателя оказаться и в топе популярных).
10. **Артисты** (всем) — витрина активных артистов, `ArtistHoverChip`.

### Лента `/feed`
Свежие релизы артистов, на которых подписан текущий слушатель. Требует входа.

## Где код
- **Главная:** `apps/web/app/(listener)/page.tsx` (SSR, всё грузится одним
  `Promise.all`, каждый источник данных — с `.catch(() => [])`, чтобы одна
  упавшая секция не роняла всю страницу)
- **Лента:** `apps/web/app/feed/page.tsx` (+ `loading.tsx`)
- **Играбельные модули:** `components/home/recent-rail.tsx` +
  `components/home/cover-rail.tsx` («Продолжить слушать»),
  `components/home/hot-tracks.tsx` («Горячие треки»),
  `components/home/flow-block.tsx` (кнопка Волны + mood-чипы),
  `components/track-list.tsx` (`PlayableTrackList` — общий играбельный
  список, используется в «Для тебя» и «Горячих треках»)
- **Карточки:** `components/featured-release.tsx`, `release-quick-look.tsx`,
  `editorial-playlist-card.tsx`, `artist-hover-chip.tsx`, `listening-now.tsx`,
  `mood-wave-chips.tsx`, `wave-start-button.tsx`
- **Данные:** `getLatestReleases`, `listReleases`, `getUpcomingReleases`,
  `listActiveArtists`, `getFeed`, `getMoodCounts`, `getEditorialPlaylists`,
  `getPersonalPlaylists`, `getPopularPlaylists`, `getPublicUserPlaylists`,
  `getLikedPlaylistIds`, `getPopularTracks`, `getRecentlyPlayed`,
  `getPersonalTrackPicks` (всё в `@vire/db`, играбельные запросы возвращают
  `PlayableChartTrack[]`)

## Env
Не требуется (только `DATABASE_URL`; `S3_PUBLIC_ENDPOINT` для картинок).

## Ограничения / на будущее
- На главной **нет поиска** — это осознанный принцип (поиск отдельно, см. [search](search.md)).
- Лента — простая хронология по подпискам, без ранжирования/персонализации.
- «Для тебя» — прагматичная выборка по лайкам/подпискам без ML; при холодном
  старте (нет сигналов) секция пуста и скрывается.
- Тяжёлые блюр-коллажи подборок выносятся на отдельный композит-слой и
  пропускаются вне вьюпорта (`content-visibility`) — иначе джанк при скролле
  (`editorial-playlist-card.tsx`).
