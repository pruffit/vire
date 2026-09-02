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

## Коллаборативные плейлисты

Тумблер `playlists.is_collaborative` (зарезервирован с миграции 0000) включён: несколько
человек ведут один персистентный плейлист, изменения видны сразу без перезагрузки. Не
путать с джемом (`jam.md`) — джем эфемерный, вход по коду, гости без аккаунта; здесь
участие постоянное и требует аккаунта.

- **Приглашение по ссылке** — `playlists.collab_token` (nullable). Владелец включает
  тумблер → генерится токен → ссылка `/playlists/[id]?join=<token>`. Токен живёт, только
  пока `is_collaborative = true`: выключение обнуляет его (старые ссылки мертвеют),
  «Сбросить ссылку» генерит новый. Действующую ссылку отдаёт `GET .../collaboration`
  (только владельцу) — «Скопировать ссылку» читает её оттуда и **не** выпускает новый
  токен, иначе каждое копирование убивало бы уже разосланные приглашения. Ни один
  публичный GET плейлиста токен не возвращает.
- **Права** (`packages/core/src/music/curation/services/playlist.ts`, приватный `canEdit`): владелец —
  всё; коллаборатор — добавляет треки, переупорядочивает состав, удаляет только треки,
  добавленные им самим (`playlist_tracks.added_by`); метаданные/обложка/удаление
  плейлиста/тумблер/кик — только владелец. Приватный + совместный разрешён: валидный
  токен в URL пускает на страницу без публикации плейлиста и без вступления в команду —
  но **только авторизованного**. Анониму по валидной ссылке отдаётся экран приглашения
  (`playlist-invite-screen.tsx`: название + кто зовёт + вход) без состава треков; та же
  граница на `GET .../tracks` (403 анониму с токеном). Валидность ссылки проверяет лёгкий
  `PlaylistService.checkInvite` — он же решает, показывать ли баннер приглашения, чтобы
  мусорный `?join=` на публичном плейлисте не рисовал ложное «вас зовут».
- **Участники** — таблица `playlist_collaborators` (`user_id`, `invited_by`, `joined_at`,
  unique по `playlist_id+user_id`); SQL соавторства — `packages/db/src/queries/playlist-collaborators.ts`. Гарды на присоединение (`PlaylistService.join`):
  авторизован, `is_collaborative`, токен совпадает, не владелец, нет блокировки в любую
  сторону (`isBlockedEitherWay`). Вставка и проверка лимита `PLAYLIST_MAX_COLLABORATORS`
  (50) — одной транзакцией репозитория (`joinCollaborator`, лочит строку плейлиста), иначе
  параллельные вступления на границе лимита оба проходят; исход `joined | already | full`.
  Уведомление и броадкаст — best-effort после успешной вставки: их сбой не откатывает
  вступление. Членства при выключении тумблера не удаляются — обратное включение
  возвращает ту же команду (доступ к приватному плейлисту при этом закрыт, пока тумблер
  выключен). **Блокировка снимает членство в обе стороны** (`removeMembershipBetween`
  дёргается из роута блокировки) — иначе заблокированный остаётся редактором.
- **Realtime** — канал `rt:playlist:{id}` поверх `lib/realtime.ts`, порт в core
  `IPlaylistBroadcaster`. Тонкие события без полезной нагрузки: `playlist:changed`
  (`{playlistId, version, actorId}` — на add/remove/reorder), `playlist:collaborators`
  (`{playlistId, actorId}` — join/leave/kick). `playlists.version` инкрементится в той же
  транзакции, что мутация состава (`version + 1` в SQL), и **только если состав реально
  изменился**: повторное добавление того же трека (`onConflictDoNothing`), удаление
  отсутствующего и кик того, кого в команде не было, версию не двигают и событий не шлют —
  иначе двойной клик рассылал бы всем подписчикам лишнее перечитывание. Мутации состава
  лочат строку плейлиста (`select … for update`), поэтому reorder не пересекается с
  параллельным add/remove и не оставляет дыр в позициях. SSE `GET
  /api/v1/playlists/[id]/stream` — только участникам совместного плейлиста, snapshot с
  текущей версией на подключении, heartbeat 25с (копия структуры `jam/[code]/stream`).
  Клиент (`playlist-realtime-sync.tsx`) подписывается только когда плейлист совместный и
  зритель — участник; игнорирует события со своим `actorId` (правка уже применена
  оптимистично) и версии не новее уже применённой; на чужое `playlist:changed` перечитывает
  `GET .../tracks` и заменяет состав. Reorder-конфликт (409, чужая правка обогнала) тоже
  разрешается перечитыванием, а не слепым откатом к локальному `prev`. Падение Redis
  деградирует до отсутствия live-обновлений — REST остаётся рабочим.
- **UI** (`app/(listener)/playlists/[id]/`): бейдж «Совместный» + стек аватаров участников
  (`playlist-collaborators.tsx`, ≤4 + «+N», `ChatAvatar`) в шапке; секция совместности в
  `playlist-settings-menu.tsx` (тумблер, копирование/сброс ссылки, список участников с
  «Исключить») — только владельцу; `playlist-leave-button.tsx` — коллаборатору взамен меню
  настроек; `playlist-join-banner.tsx` при `?join=` — авторизованному кнопка
  «Присоединиться» (`POST .../collaborators`), анониму — вход с `callbackUrl` на ту же
  ссылку; `playlist-track-row.tsx` показывает аватар добавившего только в совместных
  плейлистах. Все действия (тумблер, join/leave/kick, добавление/удаление трека)
  оптимистичны с откатом в catch.
- **`generateMetadata`/`opengraph-image.tsx` токен не пускают** — читают плейлист напрямую
  (`getPlaylistWithTracks`) без `joinToken`, поэтому приватный совместный плейлист остаётся
  `noindex` и с нейтральной OG-картинкой даже по действующей ссылке-приглашению
  (регресс-тест `page.test.tsx`/`opengraph-image.test.tsx`). Страница (`page.tsx`) читает
  плейлист через `playlistService().getForViewer(id, viewerId, joinToken)` — только это
  чтение учитывает токен.
- **Медиатека** — `/library` показывает плейлисты, где юзер коллаборатор, вместе со своими
  (`getUserPlaylists` объединяет собственные и членские строки), с пометкой роли на
  карточке (`PlaylistSummary.role`).
- **Уведомление** — `PLAYLIST_COLLAB_JOIN` владельцу при входе участника
  (`NotificationService`, `entityId = playlistId`); добавления треков не уведомляют (шум).
- **Миграция** `0044` — `playlists.collab_token`, `playlists.version`,
  `playlist_collaborators`, значение enum `PLAYLIST_COLLAB_JOIN`.

## Где код

- **Страница:** `apps/web/app/[locale]/(listener)/playlists/[id]/page.tsx` — server-shell
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
    экшен-бар, эффекты вне state-updater'ов (чисто, без двойного fetch в StrictMode); права
    по роли (`OWNER | COLLABORATOR | VIEWER`), монтирует `playlist-realtime-sync.tsx`.
  - `playlist-realtime-sync.tsx` — тонкий SSE-клиент (`lib/use-realtime.ts`) на
    `.../stream`, без разметки (`return null`); версия и self-id для фильтрации событий.
  - `playlist-collaborators.tsx` — бейдж «Совместный» + `PlaylistCollaboratorsStack`
    (стек аватаров, серверные компоненты без интерактива).
  - `playlist-join-banner.tsx`, `playlist-leave-button.tsx` — баннер приглашения /
    выход коллаборатора из команды.
  - `playlist-track-row.tsx` — sortable-строка (dnd-kit), play-оверлей, инлайн grip-SVG,
    опц. аватар добавившего (`SortableTrackRow`'s `avatar` slot).
  - `playlist-add-panel.tsx` — поиск + подсказки, AbortController на оба запроса.
  - `playlist-settings-menu.tsx` — меню владельца (rename/описание/приватность/обложка/
    удаление/совместность), revoke blob-превью.
- **API:** `apps/web/app/api/v1/playlists/[id]/`
  - `tracks` — `GET` состав + версия (правила просмотра), `POST` добавить (dedup, владелец
    или коллаборатор), `PUT` переупорядочить (`{ trackIds }`, владелец/коллаборатор, 409 на
    гонку), `tracks/[trackId]` `DELETE` убрать (владелец — любой, коллаборатор — только свой).
  - `route.ts` — `PATCH` (title/description/visibility, owner-gated), `DELETE`.
  - `collaboration` — `GET` действующая ссылка, `PATCH { enabled }` тумблер (генерит/
    обнуляет токен), `POST` сброс токена; все три владелец-only, ответ — `inviteUrl`.
  - `collaborators` — `GET` список (участникам), `POST { token }` присоединиться
    (rate-limit 20/мин), `DELETE` выйти самому; `collaborators/[userId]` `DELETE` — кик
    (владелец).
  - `stream` — SSE, снапшот + `playlist:changed`/`playlist:collaborators`, только
    участникам совместного плейлиста.
  - `../playlists/route.ts` — `GET` список плейлистов; опц. `?trackId=<uuid>` добавляет
    в ответ `inPlaylists` (id плейлистов, где трек уже есть) для галочек быстрого добавления.
  - `cover` — `POST` (multipart `cover` | `removeCover=1`).
  - `suggestions` — `GET` умные подсказки (владелец или коллаборатор).
  - `add-search` — `GET ?q=` поиск треков для добавления (владелец или коллаборатор).
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

- Подсказки — эвристика (лайки / недавнее / тот же артист), без ML-рекомендаций.
- Переупорядочивание переписывает `position` строк по одной в транзакции — для очень
  больших плейлистов можно перейти на bulk-update.
- Обложка — около-квадрат (≤2:1), мин. 300×300; кроп/ресайз на клиенте не делается.
