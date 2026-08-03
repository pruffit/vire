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
  `user_identity_keys` (по одному на юзера). В IndexedDB запись заскоуплена по владельцу
  (ключ `identity:{userId}`): на общем браузере второй аккаунт не подхватит личность первого
  и не перезатрёт его серверный `ik_pub` — без скоупинга это отдавало бы переписку второго
  юзера владельцу первых ключей. Логаут IndexedDB не чистит намеренно — вернувшийся юзер
  читает свою историю без повторной привязки.
- **Ключ диалога (CK):** выводится из Диффи-Хеллмана личных ключей двух друзей:
  `CK = BLAKE2b(X25519(ikPriv_self, ikPub_other) ‖ sorted(ikPub))`. Обе стороны считают один
  и тот же ключ; на сервере ключей диалога нет. Сообщение — `secretbox(text, nonce, CK)`.
- **Мультидевайс:** новое устройство привязывается к уже настроенному **обменом с
  6-значным кодом** (эфемерный DH + SAS). Новое показывает код, настроенное вводит его и лишь
  ПОСЛЕ совпадения заворачивает личный ключ по общему секрету обмена (`attach` eaPub отделён от
  `complete` wrapped — код подтверждается до передачи ключа, защита от MITM сервером). Личный
  ключ переезжает → вся история читается на новом устройстве. Сессии привязки — в Redis
  (`chat:link:{id}`, TTL 5 мин, single-use). Отказ (неверный код, несошедшийся коммитмент,
  кнопка «Отмена») бьёт `POST /keys/link/abort` — сессия удаляется сразу, новое устройство
  получает 404 на поллинге и показывает отказ, а не ждёт истечения TTL.
  Сторона-подтверждатель (`LinkApprove`, оверлей) смонтирована **глобально в root layout** —
  запрос привязки ловится с любой страницы, не только с открытых «Сообщений»; B-сторона
  (кнопка «Привязать», SAS-код, статус ожидания с отменой) — карточка `DeviceLink` на
  `/messages`. Общий транспорт поллинга/POST — `components/chat/link-protocol.ts`.
- **Тупиков нет:** `E2eeBootstrap` (root layout) публикует `ik_pub` при любом заходе
  залогиненного юзера — собеседнику не нужно самому открывать «Сообщения», чтобы ему можно
  было писать; тред без ключа собеседника поллит `GET /keys?userId` каждые 8с и оживает сам.
  Для needsLink-тупика (другого устройства больше нет) в `DeviceLink` есть **«Сбросить
  шифрование»** (`resetIdentity`): новая пара перезаписывает `ik_pub`, старая история
  становится нечитаемой у обеих сторон — кнопка за явным подтверждением с предупреждением.
- **Доверие:** TOFU. Плашки сверки числа безопасности в UI треда нет (убрана — путала
  пользователей сильнее, чем помогала); код подсчёта (`safetyNumber`) удалён как мёртвый.
- **Ограничения E2EE:** нет forward secrecy (утёк долгоживущий ключ → читаема история; отдельный
  виток); привязка нового устройства требует уже настроенного устройства под рукой; **потеря разом
  всех устройств = потеря истории** (сервер восстановить не может — он слеп). Плейнтекст-режима нет.
- **Роуты:** `POST/GET /api/v1/keys` (свой `ik_pub` / чужой), `POST /keys/link/start`,
  `GET /keys/link/poll`, `POST /keys/link/attach`, `POST /keys/link/complete`,
  `POST /keys/link/abort`. Бутстрап личности —
  `lib/e2ee-client.ts` (`useIdentity`): модульный singleton на `userId`, поэтому три
  компонента чата на одном заходе дают один прогон и один `POST /keys`, а не три.
  Ошибка бутстрапа (в т.ч. брошенное исключение недоступного IndexedDB) не кешируется —
  тред показывает «не удалось загрузить шифрование», следующий монтаж повторяет попытку.

## Что делает
- **Двухпанельный мессенджер-лейаут** (`(listener)/messages/layout.tsx`): на md+ слева
  постоянная колонка (заголовок «Сообщения», `DeviceLink`, список диалогов) фиксированной
  ширины (`w-80`/`xl:w-96`) со своим скроллом, справа — тред или заглушка «Выберите диалог»
  на `/messages`. На мобилке — одна панель за раз: `/messages` показывает список,
  `/messages/[id]` — тред на весь экран; переключение по `usePathname` в клиентской
  обёртке `MessagesShell` (`components/chat/messages-shell.tsx`). `data-app-screen` — на
  корне лейаута (не на странице треда), поэтому механика app-shell (`(listener)/layout.tsx`:
  скрытие футера, `min-h-0`) отрабатывает на обоих роутах одинаково. Список диалогов
  грузится один раз в layout — страница треда его не дублирует.
- Список диалогов (`ConversationList`): собеседник, последнее сообщение, `divide-y`
  между строками, активный диалог — фон + акцентная полоса слева (псевдо-элемент,
  без layout shift), непрочитанный — имя/превью `text-foreground font-medium`,
  прочитанный — muted. **Живой** — стор `lib/chat-conversations.ts` (`useConversations`,
  паттерн `chat-unread.ts`) сидируется списком из layout один раз на владельца, дальше сам
  обновляет превью/время/непрочитанность и поднимает диалог наверх по своему же `message` с
  realtime-канала (сервер публикует событие и отправителю тоже — отдельный путь не нужен).
  Сид заскоуплен по `viewerId`: смена юзера в той же вкладке без hard-reload пересидирует стор,
  чужой список не переживает логин. Рефетч `GET /api/v1/chat/conversations` — на неизвестный
  диалог (первое сообщение), на диалог без `otherIkPub` (собеседник только что опубликовал ключ,
  иначе превью навсегда «зашифровано»), по `@reconnect` и по фокусу вкладки. Непрочитанность
  снимается только для диалога, который открыт **и** вкладка видима — иначе бейдж врал бы,
  пока отложен реальный `markRead`.
- Тред `/messages/[conversationId]`: история ASC (старые→новые, без двойного разворота),
  живой приём новых сообщений по SSE, оптимистичная отправка (`tempId` — `crypto.randomUUID()`,
  снимается при совпадении шифротекста с пришедшим серверным — `lib/chat-messages.ts`,
  `mergeMessages`). Автоскролл — плавный на своё сообщение или если читатель был у низа (порог
  120px), иначе пилюля «Новые сообщения ↓»; на смену диалога — мгновенно. Пагинация вверх при
  скролле к верху, пока `hasMore` (стартует от `initialMessages.length >= 50`); курсор —
  keyset-пара `(createdAt, id)`, параметры `?before=&beforeId=` (только по `createdAt` сообщения
  с одинаковым таймстампом проваливались бы между страницами; частичный курсор → 400).
  Догрузка пропущенного за разрыв — по `@reconnect`, возврату вкладки и фокусу окна. `markRead`
  только пока вкладка видима, иначе откладывается до возврата.
- **Индикатор «печатает…»** (`TypingIndicator`, в шапке треда рядом с именем): композер
  шлёт `POST /api/v1/chat/[conversationId]/typing` (throttle ~2.5с, только пока поле
  непустое) → сервис публикует `chat:typing` собеседнику через тот же realtime-канал.
  Индикатор гаснет через 4с без нового события или сразу по приходу `message`. Без БД —
  чистый realtime, при недоступном Redis просто не работает (деградация молчаливая).
- **Статус «Прочитано»**: под последним СВОИМ сообщением — «Прочитано», если его
  `createdAt <= otherLastReadAt`, иначе «Отправлено». `otherLastReadAt` приходит
  из `getConversationMeta` при открытии треда и обновляется live по `chat:read`
  (публикуется второй стороне из `markRead`, `readAt` — по инъектированному `Clock`).
- **Состояния треда** (`ChatThread`) — центрированные (иконка + заголовок + пояснение,
  не строка внизу): ошибка бутстрапа шифрования, `needsLink` (с кнопкой «Привязать
  устройство» на мобилке — ведёт на `/messages`, на десктопе `DeviceLink` уже виден слева),
  нет `ik_pub` собеседника («{Имя} ещё не открывал(а) VireMusic»). В блокированном состоянии
  композер скрыт.
- Кнопка «Написать» на профиле друга `/u/[userId]` (только если друзья и нет блока) →
  открывает/создаёт диалог и ведёт в тред.
- Пункт «Сообщения» с бейджем непрочитанных в сайдбаре медиатеки и мобильном таб-баре —
  бейдж живой: `ChatEventsBridge` (root layout, рядом с `E2eeBootstrap`) слушает `message`
  и при событии не для открытого диалога рефетчит `GET /api/v1/chat/unread-count` в
  стор `lib/chat-unread.ts` (`useChatUnread`, сидируется SSR-числом один раз, дальше
  живой); та же ветка кидает toast «Сообщение от {senderName}» (имя летит в payload
  события `message` из `ChatService.send`).
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
- Клиент — `apps/web/lib/use-realtime.ts`: **один `EventSource` на вкладку** (модульный
  синглтон с refcount-подписчиками), сколько бы компонентов ни вызвали `useRealtime` —
  чат (`message`), колокольчик (`notification`), привязка (`link-request`). Реконнект с
  бэкоффом; последний отписавшийся закрывает соединение. Второй и последующий `onopen`
  (реконнект после разрыва) диспатчит подписчикам синтетическое событие `@reconnect` —
  точка догрузки пропущенного для треда и списка диалогов. `visibilitychange` → вкладка
  видима и соединения нет — коннект сразу, не дожидаясь бэкоффа.
- Деградация: нет Redis → пуши не идут, REST/refresh остаётся рабочим фолбэком (как presence).

## Где код
| Слой | Путь |
|---|---|
| Схема | `packages/db/src/schema/chat.ts` (`conversations`, `messages`) |
| Миграция | `packages/db/src/migrations/0039_long_dakota_north.sql` |
| Запросы | `packages/db/src/queries/chat.ts` (`upsertConversation`/`insertMessage`/`listMessages`/`listConversations`/`markConversationRead`/`countUnreadConversations`) |
| Порт+репо | `packages/core/src/repositories/chat.ts`, `packages/db/src/repositories/chat.ts` |
| Сервис | `packages/core/src/services/chat.ts` — `ChatService` (`openOrGet`/`send`/`history`/`markRead`/`listConversations`/`countUnread`/`getConversationMeta`), `canonicalPair`; `send` принимает `senderName`, `markRead` публикует `chat:read`, `getConversationMeta` отдаёт `otherLastReadAt` |
| Realtime | `apps/web/lib/realtime.ts` (publish/subscribe, порт `RealtimePublisher` в `packages/core/src/ports/realtime.ts`), клиент `apps/web/lib/use-realtime.ts` |
| Композиция | `apps/web/lib/chat.ts` (`chatService()`) |
| Роуты | `apps/web/app/api/v1/chat/{messages,open,conversations,unread-count,[conversationId]/messages,[conversationId]/read,[conversationId]/typing}/route.ts`, `apps/web/app/api/v1/realtime/stream/route.ts` |
| Страницы | `apps/web/app/(listener)/messages/layout.tsx` (двухпанельный shell, auth-гейт, список диалогов), `.../messages/page.tsx` (заглушка «Выберите диалог»), `.../messages/[conversationId]/page.tsx` (тред) |
| Компоненты | `apps/web/components/chat/{messages-shell,conversation-list,chat-thread,message-composer,message-bubble,chat-avatar,chat-format,device-link,link-approve,link-protocol,e2ee-bootstrap,typing-indicator,chat-events-bridge}.tsx`, `.../message-friend-button.tsx` |
| Сообщения (клиент) | `apps/web/lib/chat-messages.ts` — чистые `normalizeMessage`/`mergeMessages` (дедуп по id, снятие pending по совпадению шифротекста, сортировка ASC) |
| Живой список диалогов | `apps/web/lib/chat-conversations.ts` (`useConversations`/`refreshConversations`/`applyIncomingMessage`/`markConversationReadLocal`), роут `GET /api/v1/chat/conversations` |
| Live-бейджи | `apps/web/lib/chat-unread.ts` (`useChatUnreadStore`/`useChatUnread`), смонтирован в `library-sidebar.tsx`; мост — `chat-events-bridge.tsx` в root layout |
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
- Статус доставки — только «прочитано/отправлено» под последним своим сообщением
  (не по каждому сообщению отдельно).
- Web-push для закрытой вкладки — вне скоупа, ждёт VAPID на VPS.
- Тот же realtime-примитив рассчитан на переиспользование в §8 (джем).
