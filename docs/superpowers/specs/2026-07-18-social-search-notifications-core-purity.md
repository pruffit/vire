# Спека — соц-поиск, unread-заявки, чистота core (18.07.2026)

Три задачи, запрошены одной пачкой. Задачи 1–2 связаны (соц-слой), задача 3 независима
(рефактор `packages/core`). Основано на аудите кода 18.07.2026.

## Задача 1 — §11.6 Поиск людей

**Что:** найти пользователя по отображаемому имени (`users.name`), чтобы отправить заявку
в друзья. Сейчас в чужой профиль попадаешь только по прямой ссылке/шарингу или из списка
друзей — фича соц-слоя полу-мёртвая.

**Решения:**
- Ищем **только по `name`** (публичное отображаемое имя, уже видно на `/u/[id]`). **Email
  не ищем никогда** — это уникальный логин-идентификатор, поиск по нему вернул бы вектор
  энумерации, который `auth.ts` намеренно гасит (dummy-хэш + generic-ошибка).
- Приватность: `social_visibility=PRIVATE` гейтит только видимость лайков, а не сам факт
  существования (профиль `/u/[id]` и так открыт всем по ссылке). Поэтому из поиска
  PRIVATE-пользователей **не исключаем** — иначе смешаем «скрыть лайки» и «меня не найти».
  Отдельный тумблер discoverability — вне среза (§11.6 backlog).
- Матч как в контент-поиске: `ilike(name, '%q%')` (подстрока) + GIN-триграм-индекс на
  `users.name` (сейчас его нет — добавляем миграцией, зеркало artist-поиска). `MIN_QUERY=2`.
- Результат отдаём с уже посчитанным статусом дружбы (`NONE/OUTGOING/INCOMING/FRIENDS`),
  чтобы на строке сразу рисовать правильный `FriendButton` без второго запроса на профиль.
  Роут композитит два сервиса: поиск + `FriendshipService.getStatuses(viewer, ids)` (один
  батч-запрос рёбер, не N).
- Ответ роута отдаёт **только** `{id, name, image, status}` — не email.

**Слои:**
- Миграция: GIN-триграм `users_name_trgm_idx` на `users.name`.
- Query (`@vire/db`): `searchUsersByName(q, limit, excludeId) → {id,name,image}[]`.
- Порт+репо: новый `IUserDirectoryRepository.searchByName(...)` + Drizzle-реализация;
  `IFriendshipRepository.listEdges(userId, otherIds) → FriendEdge[]` + query `listEdges`.
- Core-сервис: `UserDirectoryService.search(q, viewerId, limit) → Result<UserSearchHit[], never>`
  (тримминг, порог 2 символа, пусто ниже порога). `FriendshipService.getStatuses(viewerId,
  otherIds) → Map<id, FriendshipStatus>` (инфаллибл-ридом, без Result — конвенция ридов).
- Роут: `GET /api/v1/friends/search?q=` — **auth-гард обязателен** (в отличие от публичного
  контент-поиска), `rateLimit(clientKey(req,'user-search'), 30, 60)`, отдаёт
  `{results:{id,name,image,status}[]}`.
- UI: `components/friends/user-search.tsx` — клиентский typeahead на `/friends` (дебаунс),
  строки результата: аватар + имя (ссылка `/u/[id]`) + переиспользованный `FriendButton`.
  Мобилка: тач-таргеты ≥44px, без горизонтального скролла.

## Задача 2 — Персистентный unread-бейдж входящих заявок

**Что:** бейдж «Друзья» в сайдбаре/таб-баре должен считать **новые/непросмотренные**
заявки и гаснуть после захода на `/friends`. Сейчас это живой `countIncoming` — показывает
все PENDING всегда, «просмотрено» нигде не хранится.

**Решения:**
- Модель «просмотрено» — одна колонка `users.friend_requests_seen_at timestamptz` (nullable).
  Не заводим таблицу `notifications` (over-engineering для одного типа события; полноценные
  уведомления — отдельный пункт §11.6). Unread = PENDING-входящие с `created_at >
  coalesce(seen_at, epoch)`.
- Отметка «просмотрено»: клиентский компонент на `/friends` (`useEffect` один раз) шлёт
  `POST /api/v1/friends/seen` → `router.refresh()`, чтобы бейдж в лейауте погас **сразу**
  (badge живёт в server-лейауте, нужен ре-рендер). Серверный side-effect в render `/friends`
  не годится — гонка порядка рендера лейаута/страницы оставит бейдж устаревшим до след.
  навигации.
- Счёт бейджа переводим на сервис (`FriendshipService.countUnseen`) — заодно закрывает
  замечание аудита, что `countIncoming` дёргается сырым запросом мимо сервиса. `listIncoming`
  (список на странице) остаётся — он показывает все PENDING, не только новые.

**Слои:**
- Миграция (тот же файл, что задача 1): `users.friend_requests_seen_at timestamptz`.
- Query: `countUnseenIncoming(userId)`, `markRequestsSeen(userId)` (SQL `now()`, не JS-Date).
- Порт+репо: `countUnseenIncoming`, `markRequestsSeen` в `IFriendshipRepository`.
- Core-сервис: `FriendshipService.countUnseen(userId)`, `markSeen(userId)`.
- Web: `listener-data.ts` — `countUnseenIncomingCached = cache(...)`; оба лейаута
  (`app/layout.tsx`, `app/(listener)/layout.tsx`) переводят бейдж на неё.
- Роут: `POST /api/v1/friends/seen` — auth, вызывает `markSeen`.
- UI: `components/friends/mark-requests-seen.tsx` (клиент, mount-effect) на `/friends`.

## Задача 3 — §1.2 Чистота `packages/core`

Аудит: core ~95% соответствует. Берём в работу реальные нарушения, инфаллибл-риды НЕ трогаем.

**Берём:**
1. **`Clock` и `IdGenerator` как обязательные инъекции.** 5 мест с прямым фолбэком
   (`release.ts:52`, `track.ts:55`, `smart-link.ts:206` — `?? crypto.randomUUID()`;
   `artist.ts:155`, `presave.ts:17` — `?? Date.now()`) нарушают правило «эффекты не
   вызываются напрямую в логике». Вводим `type Clock = () => number` и
   `type IdGenerator = () => string` (порты в `packages/core/src/ports/`), делаем их
   **обязательными** deps у Presave/Artist/Release/Track/SmartLink (образец —
   `PlaylistService`/`PurchaseService`, где инъекция уже обязательна). Прямые фолбэки
   убираем — прод-поведение сохраняется, т.к. фолбэк переезжает в композицию (web/worker
   фабрики передают `() => Date.now()` / `() => crypto.randomUUID()`).
2. **`ReleaseService.changeStatus`** (`release.ts:119`) — единственный настоящий mix:
   метод возвращает `Result`, но кидает `throw` в середине мутации, если `notifyQueue` нет.
   Инвариант проверяем **до** мутации (в конструкторе/начале метода) либо отдаём `Result`-
   ошибкой — не throw после `updateStatus`.
3. **Типизированная `ForbiddenError`** вместо generic `Error`. Сейчас авторизационные
   отказы (`forbidden()` в artist-post/release/track/playlist) и «too many moods»
   моделируются как `Error`, из-за чего `E`-юнионы вырождаются в `… | Error` и не
   дискриминируются. Вводим `ForbiddenError` (с `_tag`) в `errors.ts`; «too many moods»
   переводим в `ValidationError`. Роуты, мапящие ошибки в HTTP, обновляем (Forbidden→403).

**Осознанно НЕ берём (конвенция, не баг):**
- Инфаллибл-риды без `Result` (`ReleaseService.getPublishedByArtist`,
  `FriendshipService.getStatus/listFriends/listIncoming`, `PurchaseService.handleWebhookEvent`)
  — оборачивать инфаллибл-чтение в `Result` = церемония без пользы. Фиксируем конвенцию:
  инфаллибл-риды возвращают сырое значение, `Result` — только для команд/фаллибл-путей.

## Гейты (все три задачи)
typecheck (web/core/db) · lint · check:routes · test · audit:design (задачи 1–2, трогают UI)
· build. Фичедоки: обновить `docs/features/social-friends.md` (поиск+бейдж), отметить §1.2
в `docs/roadmap/stage-2.md`/`TODO.md`.
