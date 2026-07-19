# Внешняя доставка уведомлений + discoverability-тумблер — дизайн

Дата: 2026-07-19. Раздел роадмапа: `docs/roadmap/stage-2.md` §11.6 (хвосты соцслоя).
Ветка: `feat/social-friends`. Мёрж в `main` — после этой спеки И отдельной спеки E2EE-чата,
в самом конце, по явной команде. **В прод не катим** (деплой по тегу — вне скоупа).

## Что строим

Два независимых хвоста §11.6:

1. **Discoverability-тумблер** — пользователь может скрыть себя из поиска людей.
2. **Внешняя доставка уведомлений** — существующие события соцслоя доставляются офлайн-получателю
   по **email (Brevo)** и **web-push**, помимо колокольчика+SSE. События: **заявка в друзья**
   (`FRIEND_REQUEST`) и **новое сообщение чата**.

## Зафиксированные решения (из брейншторма)

- Каналы: **и email, и web-push** (оба).
- События наружу: **заявка в друзья + новое сообщение чата**. `FRIEND_ACCEPT` наружу НЕ шлём
  (остаётся только в колокольчике).
- Email по умолчанию **включён** (`notify_email = true`), с опт-аутом и ссылкой «отписаться».
- **Алерт чата — контентless**: «Новое сообщение от X», без текста сообщения. Причина: следующей
  спекой чат уходит в E2EE (сервер слепой) — не строим то, что придётся выкидывать. Заявка в
  друзья контента и так не имеет.
- Модерация чата — **вне скоупа навсегда** (следствие E2EE-направления).

### Вне скоупа (отдельные заходы)
- E2EE-чат — своя спека/цикл.
- Forward secrecy, дайджесты, гранулярные пер-событие настройки, пуш для `FRIEND_ACCEPT`.

## Архитектура

**Единый диспетчер внешней доставки поверх новой очереди BullMQ `notify-external`.**

```
Источник события (Route→Service)
   FriendshipService.request  ──┐
   ChatService.send           ──┤ enqueue { kind, recipientId, actorId, conversationId? }
                                 ▼
                         IExternalNotifyQueue (порт в packages/core)
                                 ▼  (apps/web/lib/queue.ts — BullMQ producer)
                         Очередь notify-external (Redis)
                                 ▼
       apps/worker: notify-external.worker — ДИСПЕТЧЕР:
         1. presence-гард (получатель онлайн? → пропустить оба канала)
         2. читает prefs получателя (notify_email / notify_push)
         3. email: дебаунс на диалог (chat) + Brevo-письмо
         4. push: fan-out по push_subscriptions, tag=диалог (OS-коллапс), прунинг 410
```

Почему очередь, а не инлайн в роуте: не блокируем запрос сетью к Brevo/push-сервису; ретраи и
DLQ уже в `lib/queue.ts`; presence-гард/дебаунс/prefs — в одном месте off-request-path. Паттерн
зеркалит существующий `notify-release` (producer в web, consumer в worker).

### Слои (vire-architecture)
- **Порт** `IExternalNotifyQueue` (`packages/core/src/ports/…` или рядом с `INotifyReleaseQueue`):
  `add(data: ExternalNotifyJobData): Promise<void>`. Тип `ExternalNotifyJobData` +
  `QUEUE_NOTIFY_EXTERNAL` — в `@vire/core` (как прочие `QUEUE_*`).
- **Сервисы** `FriendshipService` / `ChatService` получают порт инъекцией, вызывают `add(...)`
  после успешной записи/публикации. Остаются framework-free; в тестах — фейковый порт с ассертом
  enqueue.
- **Producer** — класс-обёртка в `apps/web/lib/queue.ts` (singleton, как `NotifyReleaseQueue`).
- **Consumer** — `apps/worker/src/workers/notify-external.worker.ts`, зарегистрирован в
  `apps/worker/src/index.ts`. Ходит в БД напрямую через `@vire/db` (как другие воркеры),
  в Redis presence через тот же механизм, что `lib/presence.ts`.

## Данные (миграция 0040)

- `push_subscriptions(id uuid pk, user_id uuid fk→users onDelete cascade, endpoint text unique,
  p256dh text, auth text, created_at timestamptz default now())`. Индекс по `user_id`.
- `users.notify_email boolean not null default true`
- `users.notify_push boolean not null default true` (push фактически требует ещё активной подписки)
- `users.discoverable boolean not null default true`

## Discoverability-тумблер

- Запрос за поиском людей (`packages/db`, за `userDirectoryService().search`) добавляет предикат
  `discoverable = true`. Уже-друзья/прямая ссылка `/u/[id]` не затрагиваются — скрываем **только**
  из поиска. (Себя из своих же результатов поиск и так не отдаёт.)
- Переключатель в `/profile` (рядом с `social_visibility`), сохраняется через существующий
  `PATCH /api/v1/user/profile` (расширяем zod-схему полем `discoverable`).

## Web-push

- Dependency `web-push` **только в `apps/worker`** (отправка) + разовая генерация VAPID-ключей
  (CLI/скрипт). Клиенту библиотека не нужна: `PushManager.subscribe` берёт публичный ключ, конверсия
  base64→`Uint8Array` — ручной хелпер. VAPID-ключи в env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT` (`mailto:`/https), публичный дублируется как `NEXT_PUBLIC_VAPID_PUBLIC_KEY` для клиента.
- **Service worker** `apps/web/public/sw.js` (минимальный): обработчики `push` → `showNotification`
  (title/body/tag/URL из payload), `notificationclick` → `clients.openWindow`/focus нужного URL.
  CSP/Next: статик-файл из `public/`, регистрация вручную с клиента.
- **Клиент**: секция настроек — при включении push запрашивает `Notification.requestPermission`,
  `registration.pushManager.subscribe({ applicationServerKey })`, шлёт подписку на
  `POST /api/v1/push/subscribe`. Выключение → `DELETE /api/v1/push/subscribe` + `unsubscribe()`.
- **Роуты**: `app/api/v1/push/subscribe/route.ts` (POST upsert по endpoint, DELETE по endpoint),
  auth + zod-валидация подписки.
- **Отправка** (воркер): `web-push.sendNotification` по каждой подписке получателя; `tag =
  conversationId` (сообщения одного диалога коллапсятся в одну OS-нотификацию) либо `tag =
  'friend-request'`. Ответ **410 Gone / 404** → удаляем мёртвую подписку.

## Email (Brevo)

- Через существующий `apps/web`-мейлер (`lib/mailer.ts`, Brevo HTTP API) — воркеру нужен свой тонкий
  вызов Brevo (worker не импортирует Next). Общий шаблонизатор — чистые функции в `@vire/core`
  или `packages/media`-стиль util (тело письма как строка), отправка — адаптер воркера.
- Два письма: «X отправил вам заявку в друзья» (ссылка на `/friends`) и «Новое сообщение от X»
  (ссылка на `/messages`, **без текста сообщения**).
- **Отписка** — HMAC-подписанный линк по образцу `lib/presave-unsubscribe.ts` (секрет
  `LINK_SIGNING_SECRET`/`AUTH_SECRET`), без таблицы токенов. Роут отписки ставит
  `users.notify_email = false`. Ссылка в футере каждого письма.

## Диспетчер и гарды (воркер)

1. **Presence-гард** (главный анти-спам): получатель активен на сайте в окне (~60с, site-presence
   ZSET, как `lib/presence.ts`) → **пропускаем оба канала** (увидит в колокольчике/SSE). Ошибка
   Redis-presence → fail-open (шлём: цель — достучаться до офлайн-получателя, потеря алерта хуже
   лишнего).
2. **Prefs-гейт**: `notify_email`/`notify_push` получателя.
3. **Дебаунс email для чата**: Redis-ключ `notify:chat:emailed:{recipientId}:{conversationId}` с TTL
   (~15 мин) — не чаще одного письма на диалог в окне. Push дебаунсить не нужно — коллапсится по
   `tag`. Заявка в друзья — разовое событие, без дебаунса.
4. **Prune**: 410/404 от push-сервиса → удалить подписку.
5. Если после гардов оба канала отвалились/выключены — job завершается no-op (не ошибка).

## Настройки (UI)

Секция «Уведомления» в `/profile`:
- Email вкл/выкл (`notify_email`).
- Push вкл/выкл — при включении запрос permission + subscribe; статус «включено на этом устройстве».
- Discoverability вкл/выкл (скрыть из поиска).

Мобилку проверяем (узкий вьюпорт, тач-таргеты ≥44px, без `min-h-screen`). Impeccable/`audit:design`
на UI обязателен.

## Graceful degradation

- Нет VAPID-ключей → push-канал выключен (роуты подписки отвечают «недоступно», воркер пропускает
  push). Как presence без Redis.
- Brevo не сконфигурён → email пропускается.
- Redis недоступен → presence-гард fail-open, дебаунс fail-open (шлём).

## Тестирование (vire-testing)

- `packages/core`: диспетчер-логика, вынесенная в чистые функции — решение «слать ли по каналу»
  (presence + prefs + дебаунс-флаг на вход → набор каналов на выход); enqueue из
  `FriendshipService.request` и `ChatService.send` (фейковый порт).
- Чистые функции: тело письма (шаблоны), HMAC-unsub (подпись/проверка/тампер).
- Роуты: `push/subscribe` POST/DELETE (auth + валидация), `friends/search` фильтр `discoverable`,
  `user/profile` PATCH принимает `discoverable`, unsub-роут.
- Воркер: `notify-external.worker` — presence-скип, prefs-скип, дебаунс-скип, 410-прунинг
  (замоканные Brevo/web-push/redis/repo).
- Гейты Vire все: typecheck (web/core/db), lint, check:routes, test, audit:design (UI), build.

## Env (дополнить `.env.example` и `docs/features/notifications.md`)

`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
(Brevo/`AUTH_SECRET`/`LINK_SIGNING_SECRET`/`REDIS_URL` уже есть.)

## Ship

- Версия в двух местах (корневой + `apps/web/package.json`); менял `package.json` (dep `web-push`)
  → `pnpm install` → коммит lockfile.
- Обновить `docs/features/notifications.md` (внешняя доставка, env, ограничения) и `social-friends.md`
  (discoverability). Отметить §11.6 в `stage-2.md`.
- Мёрж НЕ делаем в этой спеке — после E2EE, по команде.
