# Чат: порядок сообщений, живое обновление, актуальность (план)

## Что сломано (root cause)

1. **Порядок перевёрнут.** `listMessages` (`packages/db/src/queries/chat.ts:74`) берёт последние N
   `DESC` и уже делает `rows.reverse()` → отдаёт **ASC**. Страница треда
   (`app/(listener)/messages/[conversationId]/page.tsx:41`) реверсит второй раз по неверному
   комментарию «history приходит DESC» → история рисуется новые→старые сверху вниз, а новые
   входящие и оптимистичные push'атся в конец массива (вниз). Лента разъезжается по времени.
2. **Список диалогов мёртвый.** `ConversationList` получает пропсы из серверного layout
   `(listener)/messages/layout.tsx`. При клиентской навигации между тредами layout не
   перезапрашивается → превью, порядок, метка непрочитанного не меняются, пока не перезагрузишь
   страницу.
3. **Нет догрузки пропущенного.** SSE рвётся (сон вкладки/мобильная сеть/деплой) — реконнект есть,
   но пропущенные за разрыв сообщения не подтягиваются. Тред тихо остаётся неполным.
4. **Автоскролл тупой.** `scrollIntoView` на каждое входящее — выдёргивает из чтения истории;
   на маунте скроллит через `scrollIntoView` (может дёргать внешние скролл-контейнеры app-shell).
5. **Нет истории выше 50.** API `?before=` есть, клиент не использует.
6. Мелочи: `tempId = pending-${Date.now()}` (коллизия при двух отправках в одну мс);
   расшифровка всех сообщений заново на каждое новое; `markRead` шлётся при скрытой вкладке
   («Прочитано» врёт).

## Правки

### A. Порядок (корневой)
- `page.tsx`: `initialMessages = history.value` (убрать `.slice().reverse()` и комментарий).
  Контракт: репозиторий/сервис/роут отдают **ASC (старые→новые)**.

### B. `apps/web/lib/chat-messages.ts` (новый, чистый модуль + тесты)
```ts
export type PendingMessage = ChatMessage & { pending?: boolean };
export function normalizeMessage(raw: ChatMessage): ChatMessage;      // createdAt → Date
export function mergeMessages(prev: PendingMessage[], incoming: ChatMessage[]): PendingMessage[];
```
`mergeMessages`: объединение по `id` (серверная версия побеждает), снимает pending, чей `body`
(шифротекст) совпал с пришедшим серверным (гонка «SSE обогнал ответ POST»), сортирует
не-pending ASC по `createdAt` (tie → `id`), pending — в хвост. Тесты: порядок, дедуп по id,
дедуп pending по ciphertext, prepend старых страниц.

### C. `apps/web/lib/use-realtime.ts`
- Флаг `ch.everOpened`; при повторном `onopen` диспатчить подписчикам синтетическое
  `{ type: '@reconnect' }` — точка догрузки для чата/списка.
- `visibilitychange` → visible: если соединения нет, коннектиться сразу, не ждать бэкофф.

### D. `chat-thread.tsx`
- Импортировать типы/мерж из `lib/chat-messages`.
- Скролл: ref на скролл-панель, `el.scrollTop = el.scrollHeight` (не `scrollIntoView`).
  На маунт/смену диалога — мгновенно (`useLayoutEffect`).
- На новое сообщение: скроллить, если своё **или** пользователь был у низа (порог 120px);
  иначе — пилюля «Новые сообщения ↓» внизу панели, клик → вниз.
- Догрузка: `refresh()` = `GET /api/v1/chat/{id}/messages` → `mergeMessages`. Триггеры:
  `@reconnect`, `visibilitychange`→visible, `window focus`. Ре-энтранси гасить ref-флагом.
- Пагинация вверх: `scrollTop < 200` и `hasMore` → `GET ?before={oldest.createdAt}` → prepend,
  восстановить позицию (`el.scrollTop += el.scrollHeight - prevHeight`).
  `hasMore` стартует `initialMessages.length >= 50`, гаснет когда пришло < 50.
- `markRead` только при `visibilityState === 'visible'`; иначе отложить до возврата.
  Плюс `markConversationReadLocal(conversationId)` в стор списка.
- `tempId` — `crypto.randomUUID()`; кэш расшифровки по id в ref (сбрасывается при смене `ck`).

### E. Живой список диалогов
- Роут `apps/web/app/api/v1/chat/conversations/route.ts` — GET, auth, `chatService().listConversations`,
  `{ conversations }` (+ тест роута по образцу `unread-count`).
- Стор `apps/web/lib/chat-conversations.ts` (zustand, паттерн `lib/chat-unread.ts`):
  `useConversations(initial)` сидирует SSR-списком один раз; `refreshConversations()`;
  `applyIncomingMessage({conversationId, message, senderId, viewerId, activeId})` — обновляет
  превью/время/unread и поднимает диалог наверх, при неизвестном id → `refreshConversations()`;
  `markConversationReadLocal(id)`.
- `ConversationList`: рендерит из `useConversations(props.conversations)` (**сигнатуру пропсов не менять** —
  на ней висят тесты), подписан на `message` и `@reconnect`, рефетч по `window focus`.

### F. Документация
`docs/features/chat.md` — обновить разделы «Что делает» (тред/список), «Realtime» (догрузка
после разрыва, `@reconnect`), таблицу «Где код» (новые `lib/chat-messages.ts`,
`lib/chat-conversations.ts`, роут `chat/conversations`).

## Гейты
typecheck (web/core/db) · lint · check:routes · test · audit:design · build
