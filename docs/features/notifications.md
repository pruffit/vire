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

## Env
Новых переменных нет.

## Ограничения / на будущее
- Только два типа (заявка/принятие). Лайки/подписки/сообщения — не сюда.
- Нет письма/пуша — только колокольчик в UI.
- Отметка «прочитано» — оптом при открытии поповера (нет отметки по одному).
