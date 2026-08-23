# Инкремент 17: пуш-уведомления на мобилке — спека

## Проблема

SSE-реалтайм (`useRealtime`/`connectChatRealtime`) работает только пока приложение
на переднем плане — задокументированный пробел, отмеченный в инкрементах 13/14/16
(`docs/features/mobile-app.md`). Свёрнутое/закрытое приложение не получает ни новых
сообщений чата, ни заявок в друзья.

## Решение

Переиспользовать уже существующий канал "внешней доставки офлайн-пользователю"
(`packages/core/src/platform/notifications/**`, очередь `notify-external`,
`apps/worker/src/workers/notify-external.worker.ts`), который сегодня шлёт email
(Brevo) и web-push (VAPID) для `FRIEND_REQUEST`/`CHAT_MESSAGE`, и добавить туда
третий канал — Expo push (→ FCM на Android). Ноль новой бизнес-логики: тот же
`decideExternalDelivery`, тот же presence-гард, тот же реестр `EXTERNAL_NOTIFY_EVENTS`
(title/body уже готовы, `push()` уже возвращает `{title, body, url, tag}`).

### Данные

Новая таблица `expo_push_tokens` (аналог `push_subscriptions`, не переиспользует
`devices` — `devices` моделирует пару сессионных токенов с ротацией/отзывом,
push-токен живёт своим жизненным циклом независимо от логина/логаута):

```ts
expo_push_tokens: id uuid pk, user_id uuid fk users cascade,
  token text unique, platform text ('ios'|'android'),
  device_id uuid fk devices.id on delete set null (nullable — переживает ротацию devices),
  created_at, last_used_at timestamp
index (user_id)
```

### Бэкенд

- `packages/api-contracts/src/push.ts` — `+expoPushTokenSchema` (`token`, `platform`,
  `deviceId?`), `+expoPushUnregisterSchema` (`token`).
- `packages/db/src/queries/expo-push-tokens.ts` — `upsertExpoPushToken`,
  `deleteExpoPushToken(userId, token)`, `deleteExpoPushTokensByTokens(tokens[])` (пруна
  мёртвых), `listExpoPushTokens(userId)`. 1:1 с `push-subscriptions.ts`.
- `apps/web/app/api/v1/mobile/push-token/route.ts` — `POST`/`DELETE`, паттерн
  `getCaller()` → 401 → zod → query. **Без `can()`/RBAC** — действие пользователя над
  своими данными, не бэкофис (прецедент — `POST /api/v1/push/subscribe`, п.5 ресёрча).
- `apps/worker/src/lib/expo-push.ts` — `sendExpoPush(tokens, payload)`: POST на
  `https://exp.host/--/api/v2/push/send`, чанки по 100 (лимит Expo API), возвращает
  токены с немедленной ошибкой тикета `DeviceNotRegistered`/невалидный формат.
  **Упрощение v1**: без опроса `/getReceipts` — часть протухших токенов Expo сообщает
  только через receipt asynchronously, они переживут до следующего неудачного тикета.
  Осознанный компромисс ради простоты, не круглосуточный cron ради этого.
- `notify-external.worker.ts` — рядом с `listPushSubscriptions`/`sendPush` добавляется
  `listExpoPushTokens`/`sendExpoPush`; `pushSubscriptionCount` в `decideExternalDelivery`
  становится суммой web-push + expo (один и тот же тумблер `notifyPush` решает про оба
  канала — заводить отдельную настройку не нужно, пользователь не различает
  "пуш в браузере" и "пуш на телефоне").

### Мобилка

- `+expo-notifications` (`npx expo install expo-notifications`).
- `apps/mobile/lib/push.ts` — `registerForPushNotifications(deviceId)`: запрос
  разрешения → Android notification channel → `getExpoPushTokenAsync({projectId})` →
  `apiRequest POST /api/v1/mobile/push-token`. Ошибки (нет разрешения, нет projectId)
  — best-effort, не блокируют вход (как и `sendTyping`/`markConversationRead`).
- Вызов — в `sign-in-screen.tsx` сразу после `setAuthTokens` (первый логин) и в
  `root-navigator.tsx` при холодном старте с уже сохранённой сессией (токен Expo может
  обновиться независимо от логина).
- **Deep-link по тапу на уведомление — вне скоупа.** Открывает приложение на последнем
  экране, не конкретный тред (нет диплинка на конверсацию, только на релиз с
  инкремента 8). Тот же уровень упрощения, что и остальные "осознанно не в этом
  инкременте" по проекту.

## Известный блокер (внешняя инфраструктура, не код)

`getExpoPushTokenAsync()` с Expo SDK 57 требует `projectId` — `apps/mobile/app.json`
сейчас без `extra.eas.projectId`, EAS-проект не заведён, аккаунта expo.dev с доступом
у сессии нет. Для реальной доставки на Android дополнительно нужны FCM-креды
(Firebase-проект), загруженные в EAS credentials.

**Решение по итогам обсуждения с Даней (2026-08-23): построить весь код полностью,
привязку `projectId`/EAS/FCM оставить документированным ручным шагом** — тот же класс
пробела, что "нет Mac для iOS". `registerForPushNotifications()` должен деградировать
чисто (ловит ошибку `getExpoPushTokenAsync` без projectId, ничего не шлёт, не роняет
экран) — тестируется explicit-веткой. Живая проверка на эмуляторе (свернуть → прислать
сообщение → увидеть системный пуш) блокирована до этого шага, задокументировать как
остаточный пробел инкремента 17, не как баг.

## Гейты

`packages/db`/`packages/core`/`packages/api-contracts` typecheck+test, `apps/web`
typecheck/lint/check:routes/check:contracts/test, `apps/worker` typecheck/test,
`apps/mobile` typecheck/test. `pnpm --filter @vire/db db:generate` для миграции.
