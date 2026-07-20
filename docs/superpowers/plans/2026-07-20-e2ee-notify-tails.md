# План — хвосты E2EE/уведомлений перед деплоем соцслоя

Дата: 2026-07-20. Основание: отложенные minor из `project-vire-social-merge-gate`.
Ветка: `main` (соцслой смёржен локально, `0d5667c`, не запушен).

## Снято из скоупа

- **`identity.error` не виден в UI треда** — уже закрыто коммитом `b7fd322`
  (`chat-thread.tsx:113`, `notReady` разводит error / needsLink / нет ключа у собеседника).
  Пункт бэклога устарел, правок не требует.
- **Presave GET-unsubscribe** — та же форма (GET мутирует), но это принятое ранее
  решение, задокументированное в `docs/features/presaves.md`. Не трогаем в этой пачке.

## T1 — Явный abort link-сессии при несовпадении SAS

Сейчас: A (существующее устройство) при несовпадении кода только чистит локальный стейт;
B (новое устройство) продолжает поллить `wrapped` 120×1.5с и висит до TTL 5 мин.

- `lib/link-session.ts` → `abortLink(id, userId)`: `DEL` ключа, только для владельца
  (проверка `state.userId === userId`, как в `patch`). Возврат boolean, ошибки → `false`.
- Новый роут `POST /api/v1/keys/link/abort` — auth, zod `{ linkId: uuid }`, 401/400,
  тело в стиле соседних роутов (`runtime = 'nodejs'`, `dynamic = 'force-dynamic'`).
- `components/chat/device-link.tsx`:
  - `confirmApprove` при несовпадении кода → `await post('abort', { linkId })` до сброса стейта.
  - Кнопка «Отмена» в approve-панели → тот же abort.
  - `poll()` — различать «сессии больше нет» (404) и транзиентную ошибку: при 404
    прекращать цикл и сигнализировать вызывающему (напр. вернуть `'gone'`), чтобы
    `startNew` показал «Привязка отклонена на другом устройстве», а не общее «Попробуйте снова».
- Тесты: роут `abort` (401 / 400 / чужой linkId → 404-или-false / успех), unit на
  `abortLink` в существующем стиле тестов link-session, если такой файл есть.

## T2 — `publishPub` на каждый монтаж

Сейчас: `useIdentity` вызывается тремя компонентами (`chat-thread`, `conversation-list`,
`device-link`), у каждого свой `started` ref → до 3 POST `/api/v1/keys` на заход на
`/messages`, и повтор на каждый монтаж.

- `lib/e2ee-client.ts`: вынести бутстрап в **модульный singleton** — `Map<selfId,
  Promise<IdentityState>>`, хук подписывается на общий промис вместо собственного прогона.
  Публикация `ikPub` — не чаще одного раза на (selfId, pubB64) за жизнь вкладки
  (модульный `Set`).
- Публичный контракт хука (`IdentityState`, сигнатура) **не менять** — три вызывающих
  компонента правкам не подлежат.
- Следить за анмаунтом: `setState` после размонтирования не вызывать.
- Тесты: количество `fetch('/api/v1/keys', POST)` при двух параллельных монтажах = 1;
  повторный монтаж после завершения — 0 дополнительных.

## T3 — GET-unsubscribe: убрать prefetch-футган (RFC 8058)

Сейчас: `GET /api/v1/notifications/unsubscribe?uid&token` мутирует (`updateUserNotifyEmail`).
Префетч/сканер почтового клиента отписывает молча.

- `GET` — больше не мутирует: редирект (303) на страницу подтверждения с формой
  (по образцу `presave/unsubscribed` — новая страница в `app/(listener)/`), uid+token
  прокидываются дальше.
- `POST` — выполняет отписку. Принимает и форму со страницы подтверждения, и
  one-click от почтовика (`List-Unsubscribe=One-Click` в теле). Аутентификация —
  подписанный token, поэтому CSRF-токен не нужен; rate limit по IP как в presave-роуте.
- `apps/worker/src/workers/notify-external.worker.ts` — к письмам заголовки
  `List-Unsubscribe: <url>` и `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
  Проверить, что `sendMail` (Brevo HTTP API) умеет кастомные заголовки; если нет —
  ограничиться страницей подтверждения и зафиксировать это в фичедоке.
- Тесты: GET не мутирует (мок `updateUserNotifyEmail` не вызван) и редиректит;
  POST с валидным токеном отписывает; POST с битым токеном — 400; rate limit.
- Обновить `docs/features/notifications.md` (секция отписки).

## T4 — Мёртвый `sign`-враппер

`apps/web/lib/notify-unsubscribe.ts` экспортирует `signNotifyUnsub`, который в прод-коде
web не используется (подписывает воркер через `@vire/core/notifications/unsubscribe`).
Единственные потребители — собственные тесты.

- Удалить `signNotifyUnsub` из web-враппера, оставить `verifyNotifyUnsub`.
- `lib/notify-unsubscribe.test.ts` и `app/api/v1/notifications/unsubscribe/route.test.ts`
  переключить на подпись из `@vire/core/notifications/unsubscribe` напрямую.
  Покрытие подписи остаётся в `packages/core` (`unsubscribe.test.ts`).

## T5 — VAPID: ключи и конфиг (вне репозитория)

`gh variable list` пуст → `NEXT_PUBLIC_VAPID_PUBLIC_KEY` в CI не выставлена, клиент
в проде получит `undefined`. Плюмбинг готов (`deploy.yml:112`, `Dockerfile:23`).

- Сгенерить пару (`npx web-push generate-vapid-keys`).
- Публичный ключ → GitHub Actions **variable** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` → `.env` на VPS (нужны
  воркеру в рантайме, не на сборке). Приватный ключ — только на сервере и в секретах,
  в репозиторий не коммитить.

## T6 — Ручная верификация двух-устройственной привязки

Playwright, два изолированных контекста (= два «устройства», раздельные IndexedDB),
один аккаунт: устройство A с личностью → на B заход в `/messages` → «Привязать это
устройство» → SAS-код с B вводится на A → B перезагружается и читает историю.
Дополнительно — негативный путь T1: неверный код на A → B получает отказ сразу, не ждёт TTL.

## Гейты

typecheck (web/core/db) · lint · check:routes · test (web + worker + core) ·
audit:design (T1/T3 трогают UI) · build. Затем самокритика отдельным сабагентом.

## Ship

Версия в двух местах (`package.json` + `apps/web/package.json`), фичедоки
(`chat.md`, `notifications.md`), коммит. Push и тег — деплой, по авторизации Danya.
