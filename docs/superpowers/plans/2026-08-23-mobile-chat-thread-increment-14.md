# Мобилка, инкремент 14: базовый чат-тред (без списка диалогов)

Первая messaging-поверхность мобилки поверх фундамента инкремента 13 (identity bootstrap,
tweetnacl-крипта). Открыть тред с другом с его профиля, слать/получать E2EE-сообщения
живьём по SSE. Полный контекст и границы скоупа — в задаче сессии; здесь фиксация решений
после чтения кода.

## Подтверждено чтением кода (не гадать)

- `chatMessageSchema`: `{id, conversationId, senderId, body, nonce, createdAt}` — поле
  именно `body`, не `ciphertext`.
- `sendChatMessageSchema`: `{toUserId, ciphertext, nonce}` → `sendChatMessageResponseSchema`:
  `{conversationId, message}`.
- `openChatSchema: {userId}` → `{conversationId}`.
- `GET /api/v1/keys?userId=` уже отдаёt `{ikPub: string|null}`, нет зодовской схемы ответа —
  добавить `getKeyResponseSchema` в `packages/api-contracts/src/chat.ts`.
- `ChatService.send` (`packages/core/.../messaging/services/chat.ts:63-65`) публикует
  `message`-событие И получателю, И отправителю (синхронизация вкладок веба) — мобильный
  SSE-обработчик ОБЯЗАН дедупить эхо своего же отправленного сообщения (по `message.id`,
  который знаем из ответа `sendMessage`).
- Web SSE-клиент (`apps/web/lib/use-realtime.ts`): один `EventSource` на URL, диспатч по
  `data.type`, реконнект с бэкоффом (1с → ×2 → cap 15с), синтетическое `@reconnect` на
  повторный `onopen`. Мобильная версия — та же диспатч-логика, без multi-subscriber
  refcounting (не нужен — максимум один тред открыт).
- `access-token.ts`/`secure-store.ts`/`e2ee/{identity,sodium-compat}.ts` (инкремент 13) —
  используются как есть, без изменений.
- `apiRequest()` (`lib/api-client.ts`) — Bearer + single-flight refresh на 401, паттерн для
  `lib/chat.ts`.

## Файлы

- `packages/api-contracts/src/chat.ts` — `+getKeyResponseSchema`.
- `apps/web/app/api/v1/keys/route.ts` — опционально `satisfies GetKeyResponse` на GET-ответе.
- `apps/mobile/lib/chat.ts` (новый) — `openConversation`/`fetchMessages`/`sendMessage`/`fetchPeerKey`.
- `apps/mobile/lib/chat-realtime.ts` (новый) — SSE-клиент на `react-native-sse`.
- `apps/mobile/screens/chat-thread-screen.tsx` (новый).
- `apps/mobile/navigation/profile-stack.tsx` — `+ChatThread` в param list и `Stack.Screen`.
- `apps/mobile/screens/user-profile-screen.tsx` — кнопка «Написать» рядом с `FriendButton`,
  гейт `status === 'FRIENDS' && !profile.blocked`.
- `apps/mobile/package.json` — `+react-native-sse`.

## Тесты

`lib/chat.ts` (маппинг URL/метод/тело, как `friends.test.ts`), round-trip
`deriveCK`+`encryptMessage`+`decryptMessage` на двух личностях, `chat-realtime.ts` — парсинг/
фильтрация SSE-payload как чистая функция (без реальной сети).

## Живая проверка

Обязательна — эмулятор `VireMusic_Test`, два тестовых юзера-друга
(`mobiletest@vire.local` / `rntp-friend2@viremusic.local`, `TestPass123!`). Ключевое
доказательство: шифротекст в `messages.body` в реальной БД (не читаемый текст) + живая
доставка второй стороной по SSE без ручного рефреша. Детали шагов — в задаче сессии.

## Ship

Феча-док `docs/features/mobile-app.md` — секция «Инкремент 14», честно про то, что не
входит (список диалогов, typing/read-receipts, пагинация вверх, мультидевайс, фон/пуш).
Коммит `feat(mobile): ...`, без пуша, без version bump.
