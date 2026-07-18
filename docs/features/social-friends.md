# Социальный слой — друзья

Двусторонняя дружба между слушателями (заявка → принятие), публичный/дружеский профиль
пользователя `/u/[userId]` и гейт видимости лайков по настройке приватности. Первый срез
§11 из `docs/roadmap/stage-2.md` — без поиска людей, активности в ленте, чата и блокировки.

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
- Точка входа «Друзья» в сайдбаре слушателя (`LibrarySidebar`) и в мобильном таб-баре —
  с бейджем числа непринятых входящих заявок.

## Где код
| Слой | Путь |
|---|---|
| Схема | `packages/db/src/schema/interactions.ts` (`friendships`, `friendshipStatusEnum`), `packages/db/src/schema/users.ts` (`socialVisibility`, `userSocialVisibilityEnum`) |
| Миграция | `packages/db/src/migrations/0037_woozy_rogue.sql` |
| Запросы Drizzle | `packages/db/src/queries/friendships.ts` (`findEdge`/`insertRequest`/`acceptRequest`/`deleteEdge`/`listFriends`/`listIncoming`/`countIncoming`/`userExists`), `packages/db/src/queries/profile.ts` (`getUserPublicProfile`, `updateUserSocialVisibility`), `packages/db/src/queries/playlists.ts` (`getPublicPlaylistsByOwner`) |
| Порт + Drizzle-репо | `packages/core/src/repositories/friendship.ts` (`IFriendshipRepository`, `FriendEdge`/`FriendProfile`/`IncomingRequest`), `packages/db/src/repositories/friendship.ts` (`DrizzleFriendshipRepository`) |
| Сервис (бизнес-логика) | `packages/core/src/services/friendship.ts` — `FriendshipService` (`request`/`accept`/`decline`/`cancel`/`unfriend`/`getStatus`/`listFriends`/`listIncoming`), функция `canSeeLikes(viewerId, ownerId, ownerVisibility, areFriends)` |
| API-роуты | `apps/web/app/api/v1/friends/request/route.ts` (POST, rate-limit 30/60с), `apps/web/app/api/v1/friends/[userId]/route.ts` (DELETE — decline/cancel/unfriend), `apps/web/app/api/v1/friends/[userId]/accept/route.ts` (POST), `apps/web/app/api/v1/user/profile/route.ts` (PATCH принимает `socialVisibility`) |
| Композиция сервиса (веб) | `apps/web/lib/friends.ts` (`friendshipService()`) |
| Гейт видимости профиля | `apps/web/lib/friend-profile.ts` (`loadFriendProfile` — статус дружбы + `canSeeLikes` + подгрузка лайков/плейлистов) |
| Страница профиля | `apps/web/app/(listener)/u/[userId]/page.tsx`, `.../friend-liked-track-row.tsx` |
| Компоненты | `apps/web/components/friends/friend-button.tsx`, `.../share-profile-button.tsx`, `.../incoming-requests.tsx`, `apps/web/components/listener/profile/privacy-settings.tsx` |
| Экран `/friends` | `apps/web/app/(listener)/friends/page.tsx` |
| Навигация | `apps/web/components/listener/library-sidebar.tsx`, `.../listener-sidebar.tsx`, `apps/web/components/listener/mobile-tab-bar.tsx` (бейдж `incomingCount`), подключение в `apps/web/app/(listener)/layout.tsx` и `apps/web/app/layout.tsx` |
| Кэш запросов на рендер | `apps/web/lib/listener-data.ts` — `getUserPublicProfileCached`, `countIncomingCached` (React `cache()`) |

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

## Ограничения / на будущее
- Нет поиска людей — попасть в чужой профиль можно только по прямой ссылке (шаринг) или из
  списка уже принятых друзей.
- Нет активности друзей в ленте (§11.4 stage-2) — на главной друзья не показываются.
- Нет чата между друзьями (§11.5 stage-2) — realtime-стек ещё не выбран, решается вместе с
  джемом (§8).
- Нет блокировки/жалоб — открытый вопрос §11.6.
- Уведомлений о новой заявке (пуш/письмо) нет — только бейдж непрочитанных в сайдбаре/таб-баре,
  считается на каждый рендер (`countIncoming`), без персистентного unread-состояния.
