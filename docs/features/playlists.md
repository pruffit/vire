# Управление плейлистами (слушатель)

Полноценное рабочее место владельца плейлиста на `/playlists/[id]`: добавление треков
поиском прямо на странице, drag-n-drop порядок, редактирование метаданных и быстрые
действия воспроизведения — всё оптимистично, без перезагрузок.

Не путать с редакционными/личными подборками на главной (`curated-playlists.md`) — те
генерит платформа. Базовое взаимодействие (лайки, создание плейлиста, приватность) —
`interactions.md`. Этот файл — про управление содержимым и оформлением плейлиста.

## Что делает

- **Поиск и добавление треков на странице** — кнопка «Добавить треки» раскрывает
  инлайн-панель: поиск READY-треков по названию (debounce 250мс, уже добавленные
  исключены) + секции умных подсказок. Добавление в один клик `[+]/[✓]`, оптимистично.
- **Умные подсказки** — три источника, дедуп между секциями, исключая уже добавленные:
  «Из ваших лайков», «Вы недавно слушали» (по `play_events`), «Похожее на плейлист»
  (другие треки артистов, уже присутствующих в плейлисте).
- **Drag-n-drop порядок** — перетаскивание строк (`@dnd-kit`), поддержка мыши,
  тача (активация по удержанию, чтобы тап играл трек) и клавиатуры. Оптимистично с
  откатом при ошибке сети.
- **Метаданные** (меню `⋯`, только владелец): переименование, описание (≤500),
  тумблер приватности PRIVATE/PUBLIC, своя обложка (загрузка/удаление), удаление.
- **Обложка-коллаж** — своя обложка (S3) всегда побеждает; без неё берутся обложки треков:
  ≥4 уникальных → мозаика 2×2, 1–3 → первая обложка, 0 → плейсхолдер. Единственная точка
  рендера — `components/playlist-cover.tsx` (`variant="mosaic"` — шапка `/playlists/[id]` и
  карточка медиатеки; `variant="single"` — сайдбар 40px, где 2×2 читается как шум).
  Выборка обложек — чистая `pickCovers` (`@vire/db`): дедуп, своя первой, ≤4, ранний выход
  цикла на 4 найденных (страница плейлиста прогоняет через неё весь трек-лист).
  `getUserPlaylists` (медиатека) отдаёт `coverUrl` как первую НЕ-null обложку по порядку
  позиций (через `pickCovers`/`fetchPlaylistMeta`) — раньше брался трек с `position=0` в
  лоб, даже если обложки у него не было (→ `null`).
- **Шеринг** — `components/playlist-share.tsx` в шапке (на общем `components/popover.tsx`).
  PUBLIC: копирование ссылки, на тач-устройствах сперва `navigator.share`. PRIVATE + владелец:
  «Сделать публичным и поделиться» — оптимистичный `PATCH /api/v1/playlists/[id]
  { visibility: 'PUBLIC' }` (owner-gated) с откатом при ошибке, затем копирование. PRIVATE +
  не владелец — кнопки нет (страница и так 404).
- **OG-картинка и метаданные** — `app/(listener)/playlists/[id]/opengraph-image.tsx`
  (`ImageResponse` 1200×630, runtime nodejs): коллаж/обложка + название + автор + число
  треков. Роут публичный и сессии не видит, поэтому **приватность гейтится внутри картинки**:
  для не-PUBLIC отдаётся нейтральный фирменный фон без названия и обложек (регресс-тест
  `opengraph-image.test.tsx`). `generateMetadata`: PUBLIC — canonical + OG (`music.playlist`)
  + twitter; PRIVATE — `robots: noindex, nofollow` и никаких OG-полей.
- **Воспроизведение** — «Слушать» (по порядку) и «Перемешать».
- **Удаление трека** — оптимистично из локального состояния (без перезагрузки страницы).
- Защита от **дублей** треков на уровне БД (уникальный индекс + `onConflictDoNothing`).
- **Быстрое добавление** (`add-to-playlist-button.tsx` в трек-строках/плеере) показывает
  галочками, в каких плейлистах трек уже есть: меню грузит `GET /api/v1/playlists?trackId=<uuid>`
  (`getTrackPlaylistIds`) и тоглит членство оптимистично.

## Лайки плейлистов

Слушатель может лайкнуть не только свои, но и чужие публичные подборки — они
попадают в отдельную секцию медиатеки. Данные: таблица `playlist_likes`
(`user_id`, `playlist_id`, `created_at`) + денормализованный счётчик
`playlists.likes_count`, инкремент/декремент которого делают `likePlaylist`/
`unlikePlaylist` (`packages/db/src/queries/playlists.ts`).

- **API:** `apps/web/app/api/v1/playlists/[id]/like/route.ts` — `GET` текущее
  состояние (`{ liked }` из `getPlaylistLikeState`), `POST`/`DELETE` ставят/снимают
  лайк (`likePlaylist`/`unlikePlaylist`, ответ `{ liked }`); rate-limit 60
  запросов/мин на пользователя.
- **UI:** карточка плейлиста на главной (`components/editorial-playlist-card.tsx`),
  кнопка в шапке `/playlists/[id]` (`playlist-like-button.tsx`) — обе на общем
  оптимистичном хуке `components/use-playlist-like.ts` (мгновенный флип лайка и
  счётчика, откат в catch); секция «Лайкнутые подборки» в медиатеке (`/library`,
  `getLikedPlaylists` + переиспользование `EditorialPlaylistCard`).
- **Видимость:** `getLikedPlaylists` отбирает только `visibility = 'PUBLIC'` —
  если лайкнутый плейлист стал приватным, он выпадает из секции «Лайкнутые
  подборки» (сам лайк в БД остаётся, просто не показывается).

## Где код

- **Страница:** `apps/web/app/(listener)/playlists/[id]/page.tsx` — server-shell
  full-bleed (`max-w-[120rem]`, паттерн контентных страниц вроде релиза), шапка
  ограничена `max-w-2xl` под текст; `generateMetadata` + рендерит клиентский оркестратор.
  `/library/liked` (`app/(listener)/library/liked/page.tsx`) переиспользует тот же
  `PlaylistView` под синтетический плейлист «Любимые треки» и тот же full-bleed паттерн.
  Рядом: `header-cover.ts` (`getHeaderCovers` — `pickCovers` от треков страницы),
  `opengraph-image.tsx` (OG 1200×630 с гейтом приватности).
- **Обложка и шеринг:** `components/playlist-cover.tsx` (мозаика/одиночная/плейсхолдер —
  плейсхолдер `CoverPlaceholder` переиспользуют `CoverFan` в `editorial-playlist-card.tsx`
  и хедер `PlaylistPeekSheet` в `playlist-quick-look.tsx`), `components/playlist-share.tsx`
  (на `components/popover.tsx`).
- **Клиент:**
  - `playlist-view.tsx` — оркестратор: оптимистичное состояние треков, dnd-контекст,
    экшен-бар, эффекты вне state-updater'ов (чисто, без двойного fetch в StrictMode).
  - `playlist-track-row.tsx` — sortable-строка (dnd-kit), play-оверлей, инлайн grip-SVG.
  - `playlist-add-panel.tsx` — поиск + подсказки, AbortController на оба запроса.
  - `playlist-settings-menu.tsx` — меню владельца (rename/описание/приватность/обложка/
    удаление), revoke blob-превью.
- **API:** `apps/web/app/api/v1/playlists/[id]/`
  - `tracks` — `POST` добавить (dedup), `PUT` переупорядочить (`{ trackIds }`),
    `tracks/[trackId]` `DELETE` убрать.
  - `route.ts` — `PATCH` (title/description/visibility, owner-gated), `DELETE`.
  - `../playlists/route.ts` — `GET` список плейлистов; опц. `?trackId=<uuid>` добавляет
    в ответ `inPlaylists` (id плейлистов, где трек уже есть) для галочек быстрого добавления.
  - `cover` — `POST` (multipart `cover` | `removeCover=1`).
  - `suggestions` — `GET` умные подсказки (владелец).
  - `add-search` — `GET ?q=` поиск треков для добавления (владелец).
- **Данные:** `packages/db/src/queries/playlists.ts` — `reorderPlaylistTracks`
  (транзакция + `isPermutation`-guard), `updatePlaylist`, `setPlaylistCover`,
  `searchTracksForPlaylist`, `getPlaylistSuggestions`, dedup в `addTrackToPlaylist`.
  Схема: `playlists.cover_url`, уникальный индекс `playlist_tracks(playlist_id, track_id)`
  (миграция `0027`).
- **Загрузка обложки:** переиспользует `lib/s3.uploadToStream` + `lib/image`
  (`PLAYLIST_COVER_POLICY`), ключ `playlists/{id}.{ext}`, `?v=ts` для сброса кэша.

## Env

- S3 (`S3_*`, `S3_PUBLIC_ENDPOINT`) — хранение обложек плейлистов (тот же STREAM-бакет,
  что аватары). Хост S3 должен быть в `images.remotePatterns` (уже настроено).
- Отдельных новых переменных не требуется.

## Ограничения / на будущее

- **Коллаборативные плейлисты** не реализованы (колонка `is_collaborative` зарезервирована).
- Подсказки — эвристика (лайки / недавнее / тот же артист), без ML-рекомендаций.
- Переупорядочивание переписывает `position` строк по одной в транзакции — для очень
  больших плейлистов можно перейти на bulk-update.
- Обложка — около-квадрат (≤2:1), мин. 300×300; кроп/ресайз на клиенте не делается.
