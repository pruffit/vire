# Личные сообщения (чат 1:1)

Личная переписка один-на-один между **друзьями** (двусторонняя дружба `ACCEPTED`).
Near-instant доставка через SSE поверх Redis pub/sub. **End-to-end шифрование** — сервер
хранит и релеит только шифротекст и прочитать сообщения не может (модерация чата невозможна
по дизайну). Часть §11.5 из `docs/roadmap/stage-2.md`.

## Шифрование (E2EE)

Вся крипта — на клиенте (`apps/web/lib/e2ee/*`, libsodium). Сервер оперирует непрозрачными
блобами и публичными ключами.

- **Личность:** у пользователя одна X25519 identity-пара. Приватный ключ генерится молча и
  живёт в IndexedDB устройства — на сервер не уходит. Публичный (`ik_pub`) лежит в
  `user_identity_keys` (по одному на юзера).
- **Ключ диалога (CK):** выводится из Диффи-Хеллмана личных ключей двух друзей:
  `CK = BLAKE2b(X25519(ikPriv_self, ikPub_other) ‖ sorted(ikPub))`. Обе стороны считают один
  и тот же ключ; на сервере ключей диалога нет. Сообщение — `secretbox(text, nonce, CK)`.
- **Мультидевайс:** новое устройство привязывается к уже настроенному **обменом с
  6-значным кодом** (эфемерный DH + SAS). Новое показывает код, настроенное вводит его и лишь
  ПОСЛЕ совпадения заворачивает личный ключ по общему секрету обмена (`attach` eaPub отделён от
  `complete` wrapped — код подтверждается до передачи ключа, защита от MITM сервером). Личный
  ключ переезжает → вся история читается на новом устройстве. Сессии привязки — в Redis
  (`chat:link:{id}`, TTL 5 мин, single-use).
- **Доверие:** TOFU + число безопасности (safety-number) в треде для ручной сверки. Смена
  публичного ключа собеседника меняет число.
- **Ограничения E2EE:** нет forward secrecy (утёк долгоживущий ключ → читаема история; отдельный
  виток); привязка нового устройства требует уже настроенного устройства под рукой; **потеря разом
  всех устройств = потеря истории** (сервер восстановить не может — он слеп). Плейнтекст-режима нет.
- **Роуты:** `POST/GET /api/v1/keys` (свой `ik_pub` / чужой), `POST /keys/link/start`,
  `GET /keys/link/poll`, `POST /keys/link/attach`, `POST /keys/link/complete`. Бутстрап личности —
  `lib/e2ee-client.ts` (`useIdentity`).

## Что делает
- Список диалогов `/messages` (собеседник, последнее сообщение, флаг непрочитанного).
- Тред `/messages/[conversationId]`: история + живой приём новых сообщений по SSE,
  оптимистичная отправка, автоскролл, отметка прочитанного при открытии.
- Кнопка «Написать» на профиле друга `/u/[userId]` (только если друзья и нет блока) →
  открывает/создаёт диалог и ведёт в тред.
- Пункт «Сообщения» с бейджем непрочитанных в сайдбаре медиатеки и мобильном таб-баре.
- Писать можно только другу без блока. Расфрендились/заблокировали → отправка запрещена,
  но история существующего треда остаётся читаемой.

## Realtime — SSE поверх Redis pub/sub
- Публикация: `publish(userId, event)` (`apps/web/lib/realtime.ts`) шлёт в Redis-канал
  `rt:user:{userId}` на основном ioredis-клиенте.
- Подписчик — **один на процесс**, отдельный ioredis в subscribe-режиме (`PSUBSCRIBE rt:*`),
  fan-out через Node `EventEmitter`. `subscribe(userId, cb)` навешивает листенер, возвращает
  отписку.
- SSE-роут `GET /api/v1/realtime/stream` (`runtime='nodejs'`): `ReadableStream`, heartbeat-
  комментарий каждые 25с (держит соединение сквозь CF/Caddy), cleanup по `request.signal`
  abort — снимает подписку и таймер. Один стрим на пользователя несёт И чат-, И notification-
  события (различаются полем `type`).
- Клиент — `apps/web/lib/use-realtime.ts` (`EventSource`, реконнект с бэкоффом, диспатч по
  `event.type`). Переиспользуется чатом (`message`) и колокольчиком (`notification`).
- Деградация: нет Redis → пуши не идут, REST/refresh остаётся рабочим фолбэком (как presence).

## Где код
| Слой | Путь |
|---|---|
| Схема | `packages/db/src/schema/chat.ts` (`conversations`, `messages`) |
| Миграция | `packages/db/src/migrations/0039_long_dakota_north.sql` |
| Запросы | `packages/db/src/queries/chat.ts` (`upsertConversation`/`insertMessage`/`listMessages`/`listConversations`/`markConversationRead`/`countUnreadConversations`) |
| Порт+репо | `packages/core/src/repositories/chat.ts`, `packages/db/src/repositories/chat.ts` |
| Сервис | `packages/core/src/services/chat.ts` — `ChatService` (`openOrGet`/`send`/`history`/`markRead`/`listConversations`/`countUnread`/`getConversationMeta`), `canonicalPair` |
| Realtime | `apps/web/lib/realtime.ts` (publish/subscribe, порт `RealtimePublisher` в `packages/core/src/ports/realtime.ts`), клиент `apps/web/lib/use-realtime.ts` |
| Композиция | `apps/web/lib/chat.ts` (`chatService()`) |
| Роуты | `apps/web/app/api/v1/chat/{messages,open,[conversationId]/messages,[conversationId]/read}/route.ts`, `apps/web/app/api/v1/realtime/stream/route.ts` |
| Страницы | `apps/web/app/(listener)/messages/page.tsx`, `.../messages/[conversationId]/page.tsx` |
| Компоненты | `apps/web/components/chat/{conversation-list,chat-thread,message-composer,message-bubble,chat-avatar,chat-format}.tsx`, `.../message-friend-button.tsx` |
| Навигация | пункт «Сообщения» + бейдж — `library-sidebar.tsx`, `mobile-tab-bar.tsx`; счётчик `countUnreadMessagesCached` в `lib/listener-data.ts` |

## Модель
- `conversations(id, user_low_id, user_high_id, last_message_at, low_last_read_at,
  high_last_read_at)` — плоская, строго 1:1: `unique(user_low_id, user_high_id)` +
  `check user_low_id < user_high_id`. Канон пары (least/greatest) — `canonicalPair` в сервисе.
- `messages(id, conversation_id, sender_id, body, nonce, enc_version, created_at)` — `body`
  теперь **шифротекст** (base64), `nonce` к нему; индекс `(conversation_id, created_at)` для
  пагинации. Плейнтекста в БД нет.
- `user_identity_keys(user_id, ik_pub, created_at, updated_at)` — публичные X25519-ключи.
- Непрочитанное для стороны X = `last_message_at > {X}_last_read_at` и последнее сообщение не
  от X. Общий бейдж = число таких диалогов (`countUnreadConversations`).

## Env
Новых переменных нет — переиспользуется `REDIS_URL` (тот же, что presence/BullMQ).

## Ограничения / на будущее
- Только 1:1, только между друзьями. Групп/гостей нет.
- Нет вложений/картинок — только текст (1–4000 символов; длину проверяет клиент до шифрования,
  сервер — байтовый размер шифротекста).
- Нет индикатора «печатает» и статусов доставки (только прочитано/непрочитано на уровне
  диалога).
- Тот же realtime-примитив рассчитан на переиспользование в §8 (джем).
