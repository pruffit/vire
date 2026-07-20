# Уведомления (колокольчик)

Инбокс уведомлений в шапке платформы: новая заявка в друзья и принятие твоей заявки.
Realtime-инкремент через тот же SSE, что и чат. Часть §11.6 из `docs/roadmap/stage-2.md`.

## Что делает
- Колокольчик в `Nav` (`components/nav.tsx`) для залогиненных, с бейджем числа непрочитанных.
- Поповер со списком последних уведомлений (аватар+имя актора, тип), ссылка на профиль актора.
- Открытие поповера отмечает всё прочитанным (`POST /api/v1/notifications/read`), бейдж гаснет.
- Живой инкремент: SSE-событие `notification` увеличивает счётчик без перезагрузки.

Типы событий: `FRIEND_REQUEST` (пришла заявка), `FRIEND_ACCEPT` (твою заявку приняли; шлётся
и при авто-принятии встречной заявки — инициатору исходной). Новые сообщения чата в
уведомления НЕ пишутся — у чата свой per-conversation unread (иначе строка на каждое
сообщение = шум).

## Отношение к seen-бейджу `/friends`
Оба оставлены, они про разное: seen-бейдж (`users.friend_requests_seen_at`) — счётчик
непросмотренных PENDING-заявок на вкладке «Друзья»; колокольчик — общий инбокс (заявки +
принятия) с отметкой read по клику.

## Где код
| Слой | Путь |
|---|---|
| Схема | `packages/db/src/schema/notifications.ts` (`notifications` + enum `notification_type`) |
| Миграция | `packages/db/src/migrations/0039_long_dakota_north.sql` |
| Запросы | `packages/db/src/queries/notifications.ts` (`insertNotification`/`listNotifications`/`countUnreadNotifications`/`markAllNotificationsRead`/`markNotificationRead`) |
| Порт+репо | `packages/core/src/repositories/notification.ts`, `packages/db/src/repositories/notification.ts` |
| Сервис | `packages/core/src/services/notification.ts` — `NotificationService` (`notify`/`list`/`countUnread`/`markAllRead`/`markRead`); `notify` пишет строку и публикует realtime-событие через порт `RealtimePublisher` |
| Композиция | `apps/web/lib/notifications.ts` (`notificationService()`) |
| Проводка | `FriendshipService` (`packages/core/src/services/friendship.ts`) при `request`/`accept` вызывает `notify` |
| Роуты | `apps/web/app/api/v1/notifications/route.ts` (GET список+unread), `.../notifications/read/route.ts` (POST) |
| UI | `apps/web/components/notifications/notification-bell.tsx` (поповер + SSE-подписка через `use-realtime`) |

## Модель
`notifications(id, user_id, type, actor_id, entity_id, read_at, created_at)`. `user_id` —
получатель, `actor_id` — инициатор (nullable). Unread = `read_at IS NULL`. Индекс
`(user_id, read_at, created_at)`.

## Внешняя доставка (email + web-push)

Колокольчик работает только пока пользователь на сайте (SSE). Офлайн-получателю заявка в
друзья и новое сообщение чата дублируются письмом и/или пушем через отдельную очередь BullMQ
`notify-external`. `FRIEND_ACCEPT` наружу не шлётся — остаётся только в колокольчике.

- **Producer** — `FriendshipService.request` и `ChatService.send` после успешной записи кладут
  джобу `ExternalNotifyJobData` в очередь через порт `IExternalNotifyQueue`
  (`packages/core/src/ports/external-notify.ts`); обёртка в `apps/web/lib/queue.ts`.
- **Диспетчер** — `apps/worker/src/workers/notify-external.worker.ts`, решение «слать ли по
  каналу» — чистая функция `decideExternalDelivery` (`packages/core/src/services/external-delivery.ts`):
  1. **Presence-гард** — получатель онлайн (Redis site-presence, ~40с окно) → оба канала
     пропускаются, он и так увидит в колокольчике. Ошибка Redis — fail-open (шлём).
  2. **Prefs-гейт** — `users.notify_email`/`users.notify_push` получателя (оба по умолчанию `true`).
  3. **Дебаунс письма для чата** — Redis-ключ `notify:chat:emailed:{recipientId}:{conversationId}`,
     TTL ~15 мин: не чаще одного письма на диалог в окне. Push не дебаунсится — коллапсируется
     ОС по `tag` (id диалога). Заявка в друзья — разовое событие, без дебаунса.
  4. **Прунинг** — ответ push-сервиса 410/404 удаляет мёртвую `push_subscriptions`-запись.
- **Контентless чат-алерт**: и письмо, и пуш для `CHAT_MESSAGE` содержат только имя отправителя
  («Новое сообщение от X»), без текста сообщения — сервер намеренно остаётся слепым к содержимому
  (задел под грядущий E2EE чата, чтобы не строить то, что придётся выкидывать).
- **Email** — Brevo HTTP API (тонкий вызов из воркера, `apps/worker/src/lib/brevo.ts`), шаблоны
  `friendRequestEmail`/`chatMessageEmail` в `@vire/core`. Ссылка «отписаться» в футере —
  HMAC-подписанный линк (`signNotifyUnsub` из `@vire/core/notifications/unsubscribe`, секрет
  `LINK_SIGNING_SECRET`/`AUTH_SECRET`), без таблицы токенов.
  - `GET /api/v1/notifications/unsubscribe` не мутирует (RFC 8058 — префетч/сканер почтового
    клиента иначе тихо отписывает) — редиректит (303) на страницу подтверждения
    `/notifications/unsubscribe`. Битая/просроченная ссылка → та же страница со `status=bad`.
  - `POST /api/v1/notifications/unsubscribe` ставит `notify_email = false`. Принимает и клик
    по кнопке на странице подтверждения (`unsubscribe-confirm-form.tsx`), и one-click POST
    от почтовика (`List-Unsubscribe-Post: List-Unsubscribe=One-Click`) — оба бьют в один и тот
    же подписанный URL, аутентификация токеном делает CSRF-токен излишним. Rate limit по IP,
    как в `presave/unsubscribe`.
  - Письма уходят с `List-Unsubscribe: <подписанный URL>` и
    `List-Unsubscribe-Post: List-Unsubscribe=One-Click` — `sendBrevoEmail` прокидывает
    их через поле `headers` Brevo API. Без секрета подписи заголовков нет (URL не собрать).
    На реальной отправке не проверялось, не перебивает ли Brevo заголовок своим —
    если перебьёт, one-click уйдёт в механику Brevo, а наш путь отписки остаётся
    через страницу подтверждения.
- **Web-push** — таблица `push_subscriptions(user_id, endpoint unique, p256dh, auth)`, роуты
  `POST/DELETE /api/v1/push/subscribe`. Service worker `apps/web/public/sw.js` (`push` →
  `showNotification`, `notificationclick` → фокус/открытие URL из payload). Отправка —
  `apps/worker/src/lib/webpush.js` (`web-push`, только в воркере).
- Настройки — секция «Уведомления» в `/profile`
  (`apps/web/components/listener/profile/notification-settings.tsx`): email вкл/выкл, push
  вкл/выкл (включение запрашивает `Notification.requestPermission` + `pushManager.subscribe`).

## Env
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — ключи web-push (генерация:
  `npx web-push generate-vapid-keys`), без них push-канал молча выключен.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — тот же публичный ключ, доступный клиенту для `subscribe`.
- Email использует уже существующие `BREVO_API_KEY`/`SMTP_FROM`; отписка — `LINK_SIGNING_SECRET`
  (или `AUTH_SECRET`).

## Ограничения / на будущее
- Только два типа в колокольчике (заявка/принятие). Лайки/подписки/сообщения — не сюда.
- Внешняя доставка не покрывает `FRIEND_ACCEPT` — пуш/письмо только для заявки в друзья и
  сообщения чата.
- iOS Safari отправляет web-push только установленным на домашний экран PWA (ограничение
  платформы, не Vire) — на iOS без установки доходит только письмо.
- Отметка «прочитано» в колокольчике — оптом при открытии поповера (нет отметки по одному).
