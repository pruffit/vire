# Отображение названия трека (фит/версия)

Единообразный рендер `title` + «feat. …» + «— Version» на всех поверхностях
слушателя — вместо голого `title` в одних местах и вшитой в заголовок строки
в других.

## Что делает
- Название трека везде рендерится одним компонентом: `title` — основным
  начертанием, `feat. A, B` и `— Version` — приглушённо (opacity, не цвет —
  работает и в теме артиста, и в нейтральной оболочке).
- На странице трека h1 — только чистый `title`; фит/версия — отдельной
  приглушённой строкой под заголовком (не в display-шрифте h1).
- В `<title>`/OG/JSON-LD по-прежнему одна склеенная строка (SEO не меняется).
- Нет `version`/`credits` у трека → рендерится голый `title`, ничего не ломается
  (в т.ч. старые persisted-стейты плеера без этих полей).

## Где код
- **Данные:** `tracks.version` (text, «Radio Edit», «Slowed + Reverb») и
  `tracks.credits` (jsonb `TrackCredit[]`, `packages/core/src/types/release.ts`).
  Фит — кредиты с ролью `FEATURED`.
- **Хелперы:**
  - `packages/core/src/track-display.ts` — `featuredNames(credits)`: имена
    FEATURED-кредитов, общий источник правды для web-UI и БД-запросов.
  - `apps/web/lib/track-display.ts` — реэкспорт `featuredNames`, `featLabel`
    (строка «feat. A, B»), `displayTrackTitle` — склеенная строка
    «Title (feat. A, B) — Version». **Только** для `generateMetadata`/OG/JSON-LD,
    не для UI.
  - `packages/db/src/queries/track-credits.ts` — `featFromCredits(credits: unknown)`:
    то же самое поверх сырого jsonb из Drizzle, используется во всех DTO-запросах.
- **UI-примитив:** `apps/web/components/track-title.tsx` — `TrackTitleText({ title, version?, feat? })`.
  Инлайновый фрагмент (не блочный) — встраивается в существующие `truncate`-спаны.
  Весь UI (карточки, строки треков, плеер, очередь) рендерит название через него.
- **Данные до UI:**
  - `store/player.ts` `PlayerTrack.version?/feat?` — опциональные, чтобы старый
    `vire-player` persist не ломался.
  - `lib/player/to-player-track.ts` — `PlayerTrackSource` пробрасывает оба поля
    в очередь плеера; используется во всех местах сборки `toPlayerTracks(...)`.
  - `packages/api-contracts/src/wave.ts` `WaveTrackDTO` — `version`/`feat` с
    дефолтами (`.default(null)`/`.default([])`) — старые ответы не падают.
  - `packages/db/src/queries/{search,discovery,playlists,profile,wave}.ts` —
    выборки треков добирают `tracks.version, tracks.credits` и отдают наружу
    готовое `feat` через `featFromCredits`.

## Поверхности
Релиз (трек-лист, шторка quick-look), страница трека (hero + queue), мини-плеер
и фуллскрин (`TitleLink`), панель очереди, поиск, плейлисты (список + quick-look
+ панель добавления), артист-топ, лайкнутые треки, главная («Сейчас слушают»,
`cover-rail`), волна.

## Ограничения / на будущее
- Вне скоупа: `purchased-track-row.tsx` (Этап 2, отключён от витрины), правки
  админки (там уже отображается отдельно — `version`/`credits` в редакторе трека).
