# Спека — Соцслой, часть 2: блокировка/жалобы/уведомления + активность друзей + чат (18.07.2026)

Одна пачка из четырёх подфич §11 (`docs/roadmap/stage-2.md`), запрошены разом с мёрджем в
main. Первый срез (§11.1–11.3, поиск+seen-бейдж §11.6) уже в проде на ветке
`feat/social-friends`. Здесь — остаток §11.6 (блокировка, жалобы, уведомления), §11.4
(активность друзей в ленте) и §11.5 (чат 1:1).

**Продуктовые развилки — закрыты:**
- Realtime-стек чата (§11.5) — **SSE поверх Redis pub/sub**. Причина: переиспользует уже
  стоящий `ioredis` (presence), не поднимает отдельный процесс (SSE живёт в Next-сервере),
  near-instant. Это же — realtime-примитив для §8 (джем). RAM не блокер (VPS 1.9 ГБ, занято
  ~42%, запас ~1 ГБ — live-панель `/admin`, 18.07.2026).
- Чат — **только между друзьями** (`ACCEPTED`). Матчит формулировку §11.5, режет спам,
  не требует discoverability-модели.
- Блокировка — **отдельная таблица `user_blocks`** (не ребро `BLOCKED` в `friendships`):
  pair-unique у `friendships` направленный, BLOCKED-ребро в одну сторону сосуществовало бы
  с friendship-ребром в обратную. Отдельная таблица — чистый гейт, не трогает enum/деривацию.

---

## Подфича 1 — §11.6 Блокировка

**Что:** пользователь может заблокировать другого. Блок односторонний по инициативе, но
двусторонний по эффекту взаимодействия: пока есть блок в ЛЮБУЮ сторону между A и B —
ни заявок, ни чата, ни видимости лайков, друг из друга не находятся в поиске.

**Модель:** `user_blocks(id, blocker_id, blocked_id, created_at)`, `unique(blocker_id,
blocked_id)`, `check blocker_id <> blocked_id`, оба FK `onDelete: cascade`. Индекс на
`blocked_id` (обратный поиск «кто меня заблокировал»).

**Переходы / эффекты `block(A, B)`:**
- Вставить строку `A→B` (идемпотентно: `onConflictDoNothing`).
- Удалить любое ребро `friendships` между A и B (обе стороны) — дружба/заявка рвётся.
- Дальше guard'ы (не хранят состояние, читают `user_blocks`):
  - `FriendshipService.request(from,to)` — если блок в любую сторону → `ForbiddenError`.
  - Поиск людей (`searchUsersByName`) — исключить кандидатов, между кем и viewer есть блок
    (в любую сторону). Реализация: подзапрос-антиджойн по `user_blocks`.
  - Профиль `/u/[B]` глазами A (блокирующего): вместо `FriendButton` — состояние
    «Разблокировать»; лайки скрыты; кнопка чата отсутствует.
  - Профиль `/u/[A]` глазами B (заблокированного): `FriendButton` заменён на нейтральное
    «Недоступно» (не раскрываем факт блокировки — просто нельзя добавить); лайки скрыты
    (гейт `canSeeLikes` дополняется проверкой блока); чат недоступен.
  - Чат — `ChatService` отказывает в создании/отправке при блоке.
- `unblock(A, B)` — удалить строку `A→B`. Дружба обратно НЕ восстанавливается (её удалили).

**Слои:**
- Схема: `packages/db/src/schema/interactions.ts` — `userBlocks`.
- Query (`@vire/db`): `insertBlock`, `deleteBlock`, `isBlockedEitherWay(a,b)`,
  `listBlockedIds(userId)` (кого я заблокировал — для UI), `blockedPairsExpr` — переиспользуемый
  фрагмент антиджойна для поиска.
- Порт+репо: `IBlockRepository` (`block`/`unblock`/`existsEitherWay`/`listBlocked`),
  `DrizzleBlockRepository`. Удаление дружбы при блоке — в сервисе, транзакцией (block+deleteEdge).
- Core-сервис: `BlockService` (`block`/`unblock`/`isBlocked`/`listBlocked`). `canSeeLikes`
  расширяется/оборачивается: `loadFriendProfile` сначала проверяет блок → при блоке лайки
  скрыты безусловно. `FriendshipService.request` получает инъекцию `IBlockRepository` (или
  проверка блока делается в композиции роута до вызова сервиса — решить в плане: чище в
  сервисе, чтобы гейт был неизбежен).
- Роуты: `POST /api/v1/users/[userId]/block`, `DELETE /api/v1/users/[userId]/block`
  (auth + rate-limit). Имя сегмента — `[userId]` (сосед `u/[userId]`).
- UI: `components/friends/block-button.tsx` (в поповере профиля/рядом с `FriendButton`),
  подтверждение блока (dialog из `packages/ui`, не `confirm()`). Мобилка: тач-таргет ≥44px.

---

## Подфича 2 — §11.6 Жалобы

**Что:** пожаловаться на пользователя или сообщение чата → попадает в очередь модерации админки.

**Модель:** `reports(id, reporter_id, target_type, target_id, reason, status, created_at,
reviewed_by, reviewed_at)`. Enum `report_target_type` = `USER` | `MESSAGE`. Enum
`report_status` = `OPEN` | `REVIEWED` | `DISMISSED` (дефолт `OPEN`). `reason` — короткий
текст (zod: 1..500). Индекс на `(status, created_at)` для очереди. FK `reporter_id`
onDelete cascade; `target_id` — просто uuid (полиморфный, без FK, как `purchases.item_id`).

**Слои:**
- Схема: `interactions.ts` — `reports` + enums.
- Query: `insertReport`, `listOpenReports(limit)`, `countOpenReports`, `resolveReport(id,
  reviewerId, status)`, `getReportContext` (подтягивает имя репортера/цель для админки).
- Порт+репо: `IReportRepository`, `DrizzleReportRepository`.
- Core-сервис: `ReportService` (`submit` — валидация reason + анти-дубль: один OPEN-репорт
  на пару reporter/target; `listOpen`, `count`, `resolve`).
- Роуты: `POST /api/v1/reports` (auth + rate-limit 5/час на репортера — анти-спам),
  `POST /api/v1/admin/reports/[id]/resolve` (MODERATOR+, статус REVIEWED/DISMISSED).
- Админка: `apps/web/app/admin/reports/page.tsx` — таблица OPEN-жалоб (репортер, тип, цель-ссылка,
  reason, дата, действия «Рассмотрено»/«Отклонить»); пункт в сайдбаре админки; счётчик OPEN
  в обзоре «требует внимания» (`lib/admin-health.ts` или где живёт обзор). Дизайн-кит
  `components/admin/ui.tsx` (таблицы/бейджи/пустое состояние) — переиспользовать, не плодить.
- UI слушателя: `components/friends/report-button.tsx` — в том же поповере, что блок; модалка
  с полем причины (textarea, лимит). На сообщении чата — пункт контекст-меню «Пожаловаться».

---

## Подфича 3 — §11.6 Уведомления

**Что:** «колокольчик» в навигации с непрочитанными событиями: **новая заявка в друзья** и
**твою заявку приняли**. (Новые сообщения чата — НЕ сюда: у чата свой per-conversation
unread, иначе строка-уведомление на каждое сообщение = шум.) Realtime-пуш через тот же SSE.

**Модель:** `notifications(id, user_id, type, actor_id, entity_id, read_at, created_at)`.
Enum `notification_type` = `FRIEND_REQUEST` | `FRIEND_ACCEPT`. `user_id` — получатель
(FK cascade), `actor_id` — кто инициировал (FK cascade, nullable), `entity_id` — nullable
uuid (напр. id дружбы; для рендера ссылки на `/u/[actor]` хватает `actor_id`). Индекс
`(user_id, read_at, created_at)` — выборка непрочитанных/ленты. Unread = `read_at IS NULL`.

**Как пишутся:** `FriendshipService.request` (при новой заявке) и `.accept` (при принятии)
после успешной мутации создают notification получателю. Инъекция `INotificationRepository`
в `FriendshipService` (обязательная deps — образец инъекций в сервисах). Встречная заявка,
которая авто-принимает, шлёт `FRIEND_ACCEPT` инициатору исходной заявки.

Отношение к seen-бейджу `/friends` (уже в проде): **оставляем оба, они про разное.**
Seen-бейдж — счётчик непросмотренных PENDING-заявок именно на вкладке «Друзья» (список
заявок). Колокольчик — общий инбокс (заявки + принятия), с отметкой read по клику. Не
дублируют друг друга; переписывать seen-бейдж на notifications в этом срезе не будем
(лишний рефактор рабочего кода).

**Слои:**
- Схема: новый файл `packages/db/src/schema/notifications.ts` (или в `interactions.ts` —
  решить в плане; отдельный файл чище, тема новая).
- Query: `insertNotification`, `listNotifications(userId, limit)`, `countUnread(userId)`,
  `markAllRead(userId)`, `markRead(userId, id)`.
- Порт+репо: `INotificationRepository`, `DrizzleNotificationRepository`.
- Core-сервис: `NotificationService` (`notify(userId, type, actorId, entityId)`, `list`,
  `countUnread`, `markAllRead`). `notify` также публикует realtime-событие (через
  инъектируемый `RealtimePublisher` порт — чистый core не знает про Redis/SSE напрямую;
  веб-композиция передаёт реализацию поверх `lib/realtime.ts`).
- Роуты: `GET /api/v1/notifications` (список + unread-count), `POST /api/v1/notifications/read`
  (mark all read). SSE-пуш — через общий стрим (см. подфича 4).
- UI: `components/notifications/notification-bell.tsx` — иконка-колокольчик в `Nav`
  (`components/nav.tsx`) с бейджем unread; поповер (общий примитив `components/popover.tsx`)
  со списком; клик по «прочитать всё». Подписка на SSE обновляет счётчик/список без перезагрузки.
  Мобилка: колокольчик в шапке или таб-баре — вписать в существующую мобильную навигацию.

---

## Подфича 4 — §11.5 Чат 1:1 (SSE + Redis pub/sub)

**Что:** личная переписка 1:1 между друзьями. Список диалогов `/messages`, тред
`/messages/[conversationId]`, вход «Написать» с профиля друга. Near-instant доставка через SSE.

**Модель (плоская, строго 1:1):**
- `conversations(id, user_low_id, user_high_id, last_message_at, low_last_read_at,
  high_last_read_at, created_at)`, `unique(user_low_id, user_high_id)`,
  `check user_low_id < user_high_id`. Канонизация пары (least/greatest по uuid) в сервисе —
  диалог A↔B всегда одна строка. Индексы на `user_low_id` и `user_high_id` (список диалогов
  юзера = где он low ИЛИ high).
- `messages(id, conversation_id, sender_id, body, created_at)`, индекс `(conversation_id,
  created_at)` для пагинации треда. `body` — текст (zod 1..4000, trim, без пустых).
- Unread диалога для стороны X = `last_message_at > {X}_last_read_at` (и последнее сообщение
  не от X). Общий бейдж «Сообщения» = число таких диалогов.

**Гейты:** создать/писать в диалог можно только если стороны — друзья (`ACCEPTED`) и нет
блока. Проверка в `ChatService` (инъекция friendship+block репо/ридов). Если расфрендились —
существующий тред остаётся читаемым, но отправка запрещена (продуктовое решение: не
уничтожать историю, но и не давать писать не-другу).

**Realtime (`apps/web/lib/realtime.ts`):**
- `publish(channel, payload)` — на основном redis-клиенте (`PUBLISH rt:user:{userId} json`).
- Синглтон-подписчик — ОТДЕЛЬНЫЙ ioredis в subscribe-режиме (subscribe блокирует соединение,
  нельзя мешать с командным клиентом), `PSUBSCRIBE rt:*`, fan-out в Node `EventEmitter` по
  каналу. SSE-хендлеры навешивают/снимают листенер на `rt:user:{myId}`.
- SSE-роут `GET /api/v1/realtime/stream` (auth): `ReadableStream`, листенер на свой канал,
  heartbeat-комментарий каждые ~25с (держит соединение сквозь CF/Caddy), cleanup по
  `request.signal` abort. Один стрим на пользователя несёт И chat-события, И notifications.
- Деградация: нет Redis → SSE просто не шлёт пуши, REST-поллинг/refresh остаётся рабочим
  фолбэком (как presence деградирует до 0). Ошибки подписчика — `.on('error', () => {})`.

**Отправка сообщения** (`POST /api/v1/chat/messages` `{toUserId, body}` или
`.../chat/[conversationId]/messages`): guard друзья+блок → upsert conversation (канон пары) →
insert message → `update last_message_at` + `sender last_read_at = now()` → `publish` в канал
получателя `{type:'message', conversationId, message}` (и в свой канал для синхронизации
других вкладок). История треда — `GET /api/v1/chat/[conversationId]/messages?before=` (курсор
по created_at). Пометка прочитанного — `POST /api/v1/chat/[conversationId]/read`.

**Слои:**
- Схема: `packages/db/src/schema/chat.ts` — `conversations`, `messages`.
- Query: `findConversation(low,high)`, `upsertConversation`, `insertMessage`,
  `listMessages(convId, before, limit)`, `listConversations(userId)` (с собеседником,
  последним сообщением, unread-флагом), `markConversationRead(convId, side)`,
  `countUnreadConversations(userId)`.
- Порт+репо: `IChatRepository`, `DrizzleChatRepository`.
- Core-сервис: `ChatService` (`openOrGet(a,b)`, `send(from,to,body)`, `history`, `markRead`,
  `listConversations`, `countUnread`) с инъекцией friendship+block ридов и `RealtimePublisher`.
  Канонизация пары, валидация body, guard'ы — чистые. `RealtimePublisher` — порт (core не
  импортит Redis).
- Роуты: `chat/messages` (POST send), `chat/[conversationId]/messages` (GET history),
  `chat/[conversationId]/read` (POST), `realtime/stream` (GET SSE). Rate-limit на send.
- Композиция: `apps/web/lib/chat.ts` (`chatService()` с реализацией `RealtimePublisher`
  поверх `lib/realtime.ts`).
- UI: `app/(listener)/messages/page.tsx` (список диалогов), `.../messages/[conversationId]/page.tsx`
  (тред: SSR-история + клиентский `ChatThread` на SSE, автоскролл, оптимистичная отправка),
  `components/chat/*` (`conversation-list`, `chat-thread`, `message-composer`, `message-bubble`).
  Кнопка «Написать» на `/u/[userId]` (у друга, без блока) → `openOrGet` → редирект в тред.
  Пункт «Сообщения» с unread-бейджем в сайдбаре/таб-баре слушателя. Мобилка: тред на всю
  высоту скролл-области (НЕ `h-screen`/`min-h-screen` — app-shell!), композер закреплён снизу
  внутри контейнера через `overflow-y-auto` + `min-h-0` на списке сообщений, страница высоту
  не задаёт. Оптимистичный UI отправки (memory: optimistic по умолчанию).

---

## Подфича 5 — §11.4 Активность друзей в ленте

**Что:** на главной блок «Активность друзей» — что друзья лайкнули / на кого подписались /
какие плейлисты создали, свежее сверху. Приватность: только для друзей (у кого
`social_visibility=FRIENDS` и вы друзья) и без блока.

**Решение:** агрегирующий запрос на лету, БЕЗ таблицы `activity_events` (совпадает с текущим
непер­систентным `mergeActivity`; история/фан-аут не нужны на этом объёме, щадит ресурсы).

**Слои:**
- Query (`@vire/db`): `getFriendsActivity(userId, limit)` — по друзьям юзера (ACCEPTED,
  минус заблокированные, минус те, у кого visibility=PRIVATE для лайков) собрать последние
  лайки/подписки/созданные плейлисты с именем друга; UNION ALL + сортировка по времени +
  лимит на стороне SQL. Приватность лайков — фильтр по `users.social_visibility`.
- Core/web: расширить `apps/web/lib/activity.ts` — новый вариант `ActivityItem` с полем
  `actor {id,name,image}` (чей это action) ИЛИ отдельный тип `FriendActivityItem`; функция
  сборки/сортировки чистая, покрыта тестом (как `mergeActivity`).
- UI: секция на главной (`apps/web/app/page.tsx` / `home-sections.tsx`) — RSC-стриминг за
  `Suspense`, `fallback={null}` (условно-пустая: у кого нет друзей — секции нет). Строки
  переиспользуют `FriendLikedTrackRow`/`PlaylistCard`/карточку артиста + аватар+имя друга.
  Пусто у одиночек — секции просто нет. Мобилка: `ScrollRow`/`flex` fluid, без гор. скролла.

---

## Порядок и зависимости (для плана)

1. **Фундамент (сначала, последовательно):** одна миграция — `user_blocks`, `reports`,
   `notifications`, `conversations`, `messages` + enums; схемы Drizzle; порты+репо; core-сервисы
   (`BlockService`/`ReportService`/`NotificationService`/`ChatService`) + инъекция
   notifications/block в `FriendshipService`; `lib/realtime.ts`. Всё остальное кладётся сюда.
2. **Параллельно поверх фундамента** (независимые файловые зоны):
   - Трек A — §11.6 UI: блок/жалоба поповер, `/admin/reports`, колокольчик.
   - Трек B — §11.5 чат: SSE-роут, chat-роуты, `/messages/*`, UI чата.
   - Трек C — §11.4 активность: query + расширение `activity.ts` + секция главной.
   Общие файлы (`nav.tsx`, сайдбар/таб-бар, layout) — точки контеншена: развести по одному
   агенту или свести правки навигации в отдельный маленький шаг, чтобы сабагенты не
   конфликтовали.
3. **Самокритика** (независимый Sonnet) → фиксы.
4. **Гейты + фичедоки + версия + мёрдж в main.**

## Гейты
typecheck (web/core/db) · lint · check:routes · test · audit:design (трогаем UI) · build.
Новые роут-сегменты — единообразные имена (`[userId]`, `[conversationId]`), check:routes ловит
конфликты. Фичедоки: обновить `docs/features/social-friends.md` + новые
`docs/features/notifications.md`, `docs/features/chat.md`; отметить §11.4/11.5/11.6 в
`stage-2.md` и `TODO.md`. Версия в двух `package.json`, lockfile если менялись deps.

## Тесты (обязательный минимум)
- core: `BlockService` (эффект block рвёт дружбу, guard request, идемпотентность),
  `ReportService` (валидация, анти-дубль OPEN), `NotificationService` (notify/unread/markRead),
  `ChatService` (канон пары, guard друзья+блок, отказ писать не-другу, unread-подсчёт),
  `FriendshipService` (request/accept шлют notification), расширение `mergeActivity`/friends.
- route: block/unblock (права), reports POST (rate-limit+анти-дубль), admin resolve (роль),
  notifications GET/read, chat send (guard+валидация body), chat history/read, realtime/stream
  (auth-гард). `getFriendsActivity` — приватность (PRIVATE-друг не течёт, блок исключает).
- layout: тред чата не вводит `min-h-screen`/`h-screen` (инвариант app-shell).
