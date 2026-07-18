# Социальный слой — друзья

Двусторонняя дружба между слушателями (заявка → принятие), публичный/дружеский профиль
пользователя `/u/[userId]` и гейт видимости лайков по настройке приватности. Первый срез
§11 из `docs/roadmap/stage-2.md` — без активности в ленте, чата и блокировки.

## Что делает
- Отправить заявку в друзья другому пользователю; повторная встречная заявка авто-принимает
  дружбу (без дубля запроса).
- Принять / отклонить входящую заявку, отменить исходящую, удалить из друзей — одно и то же
  действие на уровне данных (удаление ребра), различается только по стороне инициатора.
- Страница профиля `/u/[userId]`: аватар/имя, кнопка дружбы (`FriendButton`), шаринг ссылки
  на профиль (`ShareProfileButton`, `navigator.share` или копия ссылки), лайки владельца (если
  видимы) и его публичные плейлисты (видны всем всегда).
- Видимость лайков управляется `users.social_visibility` (`FRIENDS` | `PRIVATE`, дефолт
  `FRIENDS`): при `FRIENDS` лайки видит владелец и его друзья, при `PRIVATE` — только владелец.
  Переключатель — тумблер «Лайки видны друзьям» на `/profile` (`PrivacySettings`).
- Экран `/friends`: входящие заявки (`IncomingRequests`, оптимистичный accept/decline) и
  список принятых друзей со ссылками на их профили.
- Поиск людей: на `/friends` — typeahead-поиск по отображаемому имени (`UserSearch`); строка
  результата ведёт на профиль `/u/[id]` и несёт готовую кнопку дружбы (статус посчитан на
  сервере). Ищем только по `name`, никогда по email; PRIVATE-пользователей из выдачи не
  прячем (видимость гейтит лайки, а не факт существования).
- Точка входа «Друзья» в сайдбаре слушателя (`LibrarySidebar`) и в мобильном таб-баре —
  с бейджем числа **непросмотренных** входящих заявок: бейдж считает заявки новее момента
  последнего захода на `/friends` (`users.friend_requests_seen_at`) и гаснет после захода.

## Где код
| Слой | Путь |
|---|---|
| Схема | `packages/db/src/schema/interactions.ts` (`friendships`, `friendshipStatusEnum`), `packages/db/src/schema/users.ts` (`socialVisibility`, `userSocialVisibilityEnum`) |
| Миграция | `packages/db/src/migrations/0037_woozy_rogue.sql` |
| Запросы Drizzle | `packages/db/src/queries/friendships.ts` (`findEdge`/`insertRequest`/`acceptRequest`/`deleteEdge`/`listFriends`/`listIncoming`/`userExists`/`listEdges`/`countUnseenIncoming`/`markRequestsSeen`), `packages/db/src/queries/user-directory.ts` (`searchUsersByName`), `packages/db/src/queries/profile.ts` (`getUserPublicProfile`, `updateUserSocialVisibility`), `packages/db/src/queries/playlists.ts` (`getPublicPlaylistsByOwner`) |
| Порт + Drizzle-репо | `packages/core/src/repositories/friendship.ts` (`IFriendshipRepository`, `FriendEdge`/`FriendProfile`/`IncomingRequest`), `packages/db/src/repositories/friendship.ts` (`DrizzleFriendshipRepository`); поиск — `packages/core/src/repositories/user-directory.ts` (`IUserDirectoryRepository`), `packages/db/src/repositories/user-directory.ts` (`DrizzleUserDirectoryRepository`) |
| Сервис (бизнес-логика) | `packages/core/src/services/friendship.ts` — `FriendshipService` (`request`/`accept`/`decline`/`cancel`/`unfriend`/`getStatus`/`getStatuses`/`listFriends`/`listIncoming`/`countUnseen`/`markSeen`), функция `canSeeLikes(...)`; `packages/core/src/services/user-directory.ts` — `UserDirectoryService.search` (порог 2 символа) |
| API-роуты | `apps/web/app/api/v1/friends/request/route.ts` (POST, rate-limit 30/60с), `.../friends/[userId]/route.ts` (DELETE — decline/cancel/unfriend), `.../friends/[userId]/accept/route.ts` (POST), `.../friends/search/route.ts` (GET `?q=`, auth + rate-limit, отдаёт `{id,name,image,status}[]`, email не отдаётся), `.../friends/seen/route.ts` (POST — отметить заявки просмотренными), `.../user/profile/route.ts` (PATCH принимает `socialVisibility`) |
| Композиция сервиса (веб) | `apps/web/lib/friends.ts` (`friendshipService()`, `userDirectoryService()`) |
| Гейт видимости профиля | `apps/web/lib/friend-profile.ts` (`loadFriendProfile` — статус дружбы + `canSeeLikes` + подгрузка лайков/плейлистов) |
| Страница профиля | `apps/web/app/(listener)/u/[userId]/page.tsx`, `.../friend-liked-track-row.tsx` |
| Компоненты | `apps/web/components/friends/friend-button.tsx`, `.../share-profile-button.tsx`, `.../incoming-requests.tsx`, `.../user-search.tsx` (typeahead с `AbortController`), `.../mark-requests-seen.tsx` (mount-effect отметки просмотра), `apps/web/components/listener/profile/privacy-settings.tsx` |
| Экран `/friends` | `apps/web/app/(listener)/friends/page.tsx` (монтирует `UserSearch` + `MarkRequestsSeen`) |
| Навигация | `apps/web/components/listener/library-sidebar.tsx`, `.../listener-sidebar.tsx`, `apps/web/components/listener/mobile-tab-bar.tsx` (бейдж `incomingCount`), подключение в `apps/web/app/(listener)/layout.tsx` и `apps/web/app/layout.tsx` |
| Кэш запросов на рендер | `apps/web/lib/listener-data.ts` — `getUserPublicProfileCached`, `countUnseenIncomingCached` (React `cache()`, через `FriendshipService.countUnseen`) |
| Миграция | `packages/db/src/migrations/0038_young_argent.sql` — `users.friend_requests_seen_at` + GIN-триграм `users_name_trgm_idx` на `users.name` |

## Env
Новых переменных нет.

## Модель `friendships` и жизненный цикл
Таблица `friendships` — одна строка на пару, направленная (`requester_id` → инициатор,
`addressee_id` → адресат), `status` enum `PENDING` | `ACCEPTED`. Уникальный индекс на
`(requester_id, addressee_id)` + чек `requester_id <> addressee_id` (нельзя дружить с собой).
Обратный дубль (встречная заявка) ловит `FriendshipService.request`, не БД: если уже есть
ребро в обратную сторону со статусом `PENDING`, сервис сразу переводит его в `ACCEPTED` вместо
второй строки.

Переходы:
- **request** → новая строка `PENDING`, инициатор = `requester_id`. Если ребро уже есть и это
  встречная заявка — сразу `ACCEPTED` (авто-принятие, без дубля запроса).
- **accept** — только адресат существующей `PENDING`-заявки может принять; `PENDING → ACCEPTED`.
- **decline / cancel / unfriend** — одно действие на уровне сервиса и API (`DELETE`): строка
  удаляется целиком, независимо от статуса и от того, кто вызывает. REST-хендлер не различает
  «отклонил входящую», «отменил исходящую» и «разорвал дружбу» — семантика инициатора решается
  на клиенте (какая кнопка показана).

## Гейт `canSeeLikes`
Чистая функция без побочных эффектов (`packages/core/src/services/friendship.ts`):
```
canSeeLikes(viewerId, ownerId, ownerVisibility, areFriends)
```
- Владелец всегда видит свои лайки (`viewerId === ownerId`).
- `PRIVATE` — никто, кроме владельца.
- `FRIENDS` — видно, только если `areFriends` (статус дружбы `ACCEPTED`).

`loadFriendProfile` считает статус дружбы (`FriendshipService.getStatus`) и вызывает гейт
до похода за лайками — при `likesVisible === false` `getLikedTracks` не вызывается вовсе.
Публичные плейлисты (`visibility = PUBLIC`) гейту не подчиняются — видны всем так же, как на
`/playlists/[id]`.

## Поиск людей и бейдж непросмотренных
- Поиск (`/friends`) — только по `users.name` через `ilike(name,'%q%')` + GIN-триграм-индекс
  `users_name_trgm_idx` (зеркало artist-поиска). **По email не ищем и его не отдаём** — это
  уникальный логин-идентификатор, поиск по нему вернул бы вектор энумерации, который `auth.ts`
  гасит dummy-хэшем. Роут `friends/search` — auth + rate-limit (`clientKey`), выдаёт только
  `{id,name,image,status}`; статус дружбы считается батчем (`FriendshipService.getStatuses` →
  один `listEdges`, не N запросов), чтобы строка сразу рисовала правильный `FriendButton`.
  PRIVATE-пользователей не прячем (видимость гейтит лайки, не факт существования).
- Бейдж непросмотренных: unread = PENDING-входящие с `created_at` новее
  `users.friend_requests_seen_at` (nullable — до первого захода видны все). Заход на `/friends`
  монтирует `MarkRequestsSeen` → `POST /friends/seen` (`markSeen`, SQL `now()`) → `router.refresh()`,
  бейдж в server-лейауте гаснет сразу. Список на странице (`listIncoming`) по-прежнему показывает
  все PENDING, бейдж — только новые.

## Блокировка и жалобы (§11.6)
- **Блокировка** — отдельная таблица `user_blocks(blocker_id, blocked_id)` (не ребро в
  `friendships`: pair-unique направленный, BLOCKED-ребро сосуществовало бы с friendship-ребром
  в обратную сторону). `BlockService.block` транзакционно вставляет блок и **удаляет ребро
  дружбы** между парой. Эффект блока (в любую сторону между A и B): нельзя заявку/чат,
  скрыты лайки друг друга, друг из друга не находятся в поиске. Профиль: блокирующий видит
  «Разблокировать», заблокированный — «Взаимодействие недоступно». Гейт — чистое чтение
  `user_blocks` на каждый вызов (`existsEitherWay`), состояние нигде не кэшируется.
- **Жалобы** — `reports(reporter_id, target_type, target_id, reason, status)` (`USER`|`MESSAGE`;
  `OPEN`/`REVIEWED`/`DISMISSED`). `POST /api/v1/reports` (rate-limit 5/час, анти-дубль одного
  OPEN на пару). Очередь в админке `/admin/reports` (MODERATOR+), resolve, счётчик OPEN в
  обзоре «требует внимания».
- Код: `packages/core/src/services/{block,report}.ts`, `packages/db/src/queries/{blocks,reports}.ts`,
  `apps/web/app/api/v1/users/[userId]/block/route.ts`, `.../reports/route.ts`,
  `.../admin/reports/[id]/resolve/route.ts`, `apps/web/components/friends/{profile-more-menu,unblock-button}.tsx`,
  `apps/web/app/admin/reports/`.

## Смежные фичи
- **Активность друзей в ленте** (§11.4) — секция «Активность друзей» на главной, см. код в
  `apps/web/lib/activity.ts` (`mergeFriendsActivity`), `packages/db/src/queries/friends-activity.ts`,
  `apps/web/components/friends/friends-activity-feed.tsx`.
- **Чат 1:1** (§11.5) — `docs/features/chat.md`.
- **Уведомления** (колокольчик) — `docs/features/notifications.md`.

## Ограничения / на будущее
- Поиск только по имени и без пагинации (лимит 10) — фильтров/discoverability-тумблера нет.
- Discoverability-тумблер (скрыть себя из поиска) — вне среза.
- Жалобы только на пользователя/сообщение; модерация чата вручную через `/admin/reports`.
