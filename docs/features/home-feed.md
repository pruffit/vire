# Главная и лента подписок

Две входные витрины: публичная главная `/` (контент-хаб) и персональная лента
`/feed` (новое у тех, на кого подписан слушатель).

## Что делает
### Главная `/`
Контент-хаб без поиска и слоганов — только музыка. Секции (рендерятся, только
если есть данные):
- Редакционный выбор (featured-релиз) + кнопка запуска **Волны** (см. [wave](wave.md)).
- «Сейчас слушают» — live-присутствие (см. [live-presence](live-presence.md)).
- «По настроению» — mood-чипы запуска потока.
- «Подборки» (editorial) и «Плейлисты слушателей» — алгоритмические/публичные
  плейлисты (см. [interactions](interactions.md)).
- «Новое у тех, на кого ты подписан» (для вошедших), «Скоро выйдет», «Свежие
  релизы», «Артисты».

### Лента `/feed`
Свежие релизы артистов, на которых подписан текущий слушатель. Требует входа.

## Где код
- **Главная:** `apps/web/app/page.tsx` (SSR, всё грузится одним `Promise.all`)
- **Лента:** `apps/web/app/feed/page.tsx` (+ `loading.tsx`)
- **Карточки:** `components/featured-release.tsx`, `release-quick-look.tsx`,
  `editorial-playlist-card.tsx`, `artist-hover-chip.tsx`, `listening-now.tsx`,
  `mood-wave-chips.tsx`, `wave-start-button.tsx`
- **Данные:** `getLatestReleases`, `getUpcomingReleases`, `listActiveArtists`,
  `getFeed`, `getMoodCounts`, `getEditorialPlaylists`, `getPublicUserPlaylists`,
  `getLikedPlaylistIds` (всё в `@vire/db`)

## Env
Не требуется (только `DATABASE_URL`; `S3_PUBLIC_ENDPOINT` для картинок).

## Ограничения / на будущее
- На главной **нет поиска** — это осознанный принцип (поиск отдельно, см. [search](search.md)).
- Лента — простая хронология по подпискам, без ранжирования/персонализации.
- Тяжёлые блюр-коллажи подборок выносятся на отдельный композит-слой и
  пропускаются вне вьюпорта (`content-visibility`) — иначе джанк при скролле
  (`editorial-playlist-card.tsx`).
