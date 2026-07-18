# §11 Социальный слой — первый срез: дружба, профиль, лайки/подборки друзей

Дата: 2026-07-18. Раздел дорожной карты: [`stage-2.md` §11](../../roadmap/stage-2.md).

## Скоуп

Первый срез §11: **11.1 дружба + 11.2 профиль/видимость + 11.3 лайки/подборки друзей**.
Самодостаточный, играбельный, без realtime и без завязки на нерешённую модель ленты.

**Вне среза (следующими заходами):** 11.4 активность друзей в ленте (ждёт §4), 11.5 чат
(realtime-стек, общий с §8 джем), блокировка/жалобы/модерация, поиск людей по имени.

## Продуктовые решения (зафиксированы)

- **Модель дружбы — двусторонняя с заявкой.** Заявка → принятие/отклонение, статусы
  `PENDING`/`ACCEPTED`. Взаимная связь, не подписка. Отдельно от `follows` (listener→artist)
  и от платного `subscriptions`.
- **Видимость — флаг приватности профиля.** Один переключатель `social_visibility`
  (`FRIENDS`/`PRIVATE`), гейтит показ **лайков** друзьям. Не per-like. Публичные плейлисты
  (`PUBLIC`) видны всем независимо от флага.
- **Discovery в v1 — шаринг ссылки на профиль.** Каталог людей / поиск по имени — вне
  среза (приватность отдельным разговором).

## Данные (`packages/db`)

### Таблица `friendships`

```
id            uuid pk default random
requester_id  uuid not null → users(id)   -- инициатор заявки
addressee_id  uuid not null → users(id)   -- адресат
status        friendship_status not null default 'PENDING'
created_at    timestamp not null default now()
updated_at    timestamp not null default now()

CHECK (requester_id <> addressee_id)
unique (requester_id, addressee_id)
index friendships_addressee_idx on (addressee_id)   -- входящие заявки/друзья
index friendships_requester_idx on (requester_id)   -- исходящие/друзья
```

- Enum `friendship_status`: `PENDING | ACCEPTED` (append-only; `DECLINED`/`BLOCKED` заведём
  при §11.6, сейчас не нужны).
- **Жизненный цикл строки:**
  - `request` → INSERT `PENDING` (`requester=from`, `addressee=to`).
  - `accept` → UPDATE `PENDING→ACCEPTED` (двигает `updated_at`).
  - `decline` / `cancel` / `unfriend` → DELETE строки (как `unfollow`). Это позволяет
    переотправить заявку позже и не плодит статусы.
- **Защита от обратного дубля:** `unique(requester_id, addressee_id)` ловит только
  повтор в ту же сторону. Обратную пару (B→A при существующей A→B) отсекает сервис
  проверкой обоих направлений перед вставкой; встречная заявка сразу даёт дружбу
  (см. `FriendshipService.request`).
- `onDelete`: FK на `users` — `cascade` (удаление аккаунта чистит дружбы).

### Колонка в `users`

```
social_visibility  user_social_visibility not null default 'FRIENDS'
```

- Enum `user_social_visibility`: `FRIENDS | PRIVATE`.
- Гейтит показ **списка лайков** на `/u/[id]` друзьям. `FRIENDS` — друзья видят лайки;
  `PRIVATE` — не видит никто, кроме владельца.
- Default `FRIENDS` безопасен: друзей на старте нет, они появляются только через взаимный
  accept, ретроактивной утечки нет.
- Миграция: `ALTER TABLE users ADD COLUMN … DEFAULT 'FRIENDS' NOT NULL` + `CREATE TYPE`.

### Репозиторий (`packages/db/src/repositories`)

`FriendshipRepository` реализует порт `IFriendshipRepository` (объявлен в `packages/core`).
Плюс запросы для профиля друга:
- `findEdge(a, b)` — строка дружбы в любом направлении между двумя юзерами (для статуса/гардов).
- `insertRequest`, `acceptRequest`, `deleteEdge`.
- `listFriends(userId)` — принятые дружбы (обе стороны) → список профилей (id/имя/аватар).
- `listIncoming(userId)` — `PENDING`, где `addressee=userId`.
- `countIncoming(userId)` — для бейджа.
- Данные профиля друга переиспользуют существующие `getLikedTracks(userId)` и публичные
  плейлисты владельца (`PlaylistService.getForViewer` / существующий запрос публичных).

## Логика (`packages/core`)

`FriendshipService` по образцу `FollowService` — порт `IFriendshipRepository` инъектируется,
всё через `Result<T,E>`, без исключений сквозь слои.

```
request(fromUserId, toUserId): Result<FriendshipStatus, ValidationError | NotFoundError>
  - guard: from !== to (self-request → ValidationError)
  - findEdge(from, to):
      уже ACCEPTED           → ok('FRIENDS')  (идемпотентно)
      PENDING from→to        → ok('OUTGOING') (идемпотентно)
      PENDING to→from        → acceptRequest → ok('FRIENDS')  (встречная заявка = дружба)
      нет строки             → insertRequest PENDING → ok('OUTGOING')

accept(userId, otherUserId): Result<void, NotFoundError | ValidationError>
  - требует PENDING где addressee=userId, requester=otherUserId; иначе NotFoundError

decline(userId, otherUserId) | cancel(userId, otherUserId) | unfriend(userId, otherUserId)
  - deleteEdge между парой (с проверкой, что userId — сторона строки)

getStatus(viewerId, otherId): 'NONE' | 'OUTGOING' | 'INCOMING' | 'FRIENDS' | 'SELF'
listFriends(userId) / listIncoming(userId)
```

Чистый гард видимости (тестируется изолированно):
```
canSeeLikes(viewerId, ownerId, ownerVisibility, areFriends): boolean
  - viewer === owner            → true
  - ownerVisibility === PRIVATE → false
  - FRIENDS && areFriends       → true
  - иначе                       → false
```

## HTTP (`apps/web/app/api/v1/friends/*`) — тонкие адаптеры

Только HTTP: zod-валидация входа, вызов сервиса, маппинг `Result` в ответ. Бизнес-логики нет.

**Единый ключ всех эндпоинтов — id другого пользователя** (не id строки дружбы). Так
контракт совпадает с сервисом, оперирующим парой user-id, и не течёт внутренний id строки.

- `POST /api/v1/friends/request` — body `{ userId }` (адресат). Auth обязателен. **Rate-limit**
  (анти-спам, зеркало существующих лимитов — напр. `friend-request:${uid}`, окно/лимит
  по образцу лайков). Возвращает новый статус.
- `POST /api/v1/friends/[userId]/accept` — `[userId]` = адресант входящей заявки. Auth.
- `DELETE /api/v1/friends/[userId]` — decline/cancel/unfriend по текущему статусу пары
  (сервис сам определяет действие). Auth.

Динамический сегмент — `[userId]` (согласуется по имени внутри ветки `friends/`; проверяется
`check:routes`).

Видимость профиля меняется через существующий `POST /api/v1/user/profile` (расширить приём
`social_visibility`) либо отдельный `PATCH` — решить в плане, предпочтительно расширить
существующий, чтобы не плодить роут.

## Поверхности (фронт — FSD, вниз по слоям, переиспользуем готовое)

- **`app/(listener)/u/[id]/page.tsx`** — публичная страница пользователя в listener-shell
  (app-shell-инвариант, без `min-h-screen`). Server component: имя/аватар + публичные
  плейлисты (всем) + лайки (если `canSeeLikes`). Кнопка дружбы — client, **optimistic**
  (по умолчанию для Vire): `NONE→OUTGOING` / `INCOMING→FRIENDS|NONE` / `FRIENDS→NONE`.
  `robots: noindex` (страницы людей не индексируем). Треки играбельны из `TrackRow`,
  подборки — из `PlaylistCover`/`playlist-card`.
- **`app/(listener)/friends/page.tsx`** — список друзей + входящие заявки (accept/decline).
  Точка входа в дружбу — шаринг своей ссылки (`PlaylistShare`-примитив переиспользуем как
  «Поделиться профилем»).
- **Сайдбар слушателя** (`components/listener/library-sidebar.tsx`) — пункт «Друзья» в блоке
  «Медиатека», с бейджем количества входящих заявок.
- **`/profile`** (`app/(listener)/profile`) — тумблер `social_visibility` (FRIENDS/PRIVATE)
  с пояснением, что именно видят друзья.
- **Мобилка** — тач-таргеты ≥44px на кнопках дружбы/заявок; страница `/u/[id]` и «Друзья»
  проверяются на узком вьюпорте; горизонтального скролла документа нет.

## Тесты (vire-testing)

- **core `FriendshipService`**: self-request отклонён; дубль исходящей идемпотентен; обратный
  дубль → дружба (встречная заявка); accept валидной/невалидной заявки; decline/cancel/unfriend;
  `getStatus` по всем веткам; `canSeeLikes` (свой / друг-FRIENDS / друг-PRIVATE / не-друг / чужой-PRIVATE).
- **роуты `/friends/*`**: неавторизован → 401; валидация тела; self → 4xx; rate-limit на
  `request`; корректный статус в ответе.
- **гейт видимости `/u/[id]`**: друг видит лайки при `FRIENDS`; не видит при `PRIVATE`;
  не-друг не видит; владелец видит всегда.
- Гейты: typecheck (web/core/db), lint, check:routes, test, audit:design (трогаем UI), build.

## Затрагиваемые файлы (ориентир, точные пути — в плане)

- `packages/db/src/schema/interactions.ts` (+`friendships`, enum), `schema/users.ts`
  (+`social_visibility`), новая миграция, `repositories/friendship.ts`, экспорты `@vire/db`.
- `packages/core/src/services/friendship.ts`, `repositories/friendship.ts` (порт),
  `__tests__/services/friendship.test.ts`.
- `apps/web/app/api/v1/friends/**`, расширение `user/profile` роута.
- `apps/web/app/(listener)/u/[id]/page.tsx`, `friends/page.tsx`,
  `components/friends/*` (кнопка дружбы, список заявок), правки `library-sidebar.tsx`,
  `/profile`.
- `docs/features/social-friends.md` (новая фича — обязателен по CLAUDE.md).

## Ship

- Версия в двух местах (корневой + `apps/web/package.json`).
- `docs/features/social-friends.md`.
- Отметка в `stage-2.md` §11 (первый срез закрыт; 11.4/11.5 остаются).
