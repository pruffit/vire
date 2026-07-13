# 1-J: платёжка → core + тесты — дизайн

Последний кусок нарезки §1 (`2026-07-12-stage2-refactor-slicing-design.md`),
разморожен командой. Рефакторинг **поведение 1:1** + route-тесты. **Скоуп НЕ
включает**: боевую настройку YooKassa (env/кабинет), возврат purchase-UI на
витрину — Этап 2 остаётся выключенным, роуты как лежали неподключёнными, так и лежат.

## Скоуп

- `app/api/v1/tracks/[id]/purchase/route.ts` (70 стр.) — оркестрация покупки в core.
- `app/api/v1/webhooks/yookassa/route.ts` (40 стр.) — обработка события в core.
- `lib/yookassa.ts` — не меняется; оборачивается адаптером порта.
- `download/route.ts` — вне скоупа (тонкий, покрыт тестами).

## Порты

```ts
// repositories/purchase.ts
export interface IPurchaseRepository {
  hasPurchased(userId: string, trackId: string): Promise<boolean>;
  getPending(userId: string, trackId: string): Promise<{ id: string; externalPaymentId: string } | null>;
  createPending(input: { id: string; userId: string; trackId: string; price: string;
    externalPaymentId: string; paymentProvider: string }): Promise<void>;
  confirmByExternalId(externalPaymentId: string): Promise<void>;
  failByExternalId(externalPaymentId: string): Promise<void>;
  trackExists(trackId: string): Promise<boolean>;
  getTrackTitle(trackId: string): Promise<string | null>;
}

// services/purchase.ts (порт при сервисе, паттерн ITranscodeQueue)
export interface IPaymentGateway {
  createPayment(params: { idempotencyKey: string; amount: string; description: string;
    returnUrl: string; metadata: Record<string, string> }): Promise<{ id: string; confirmationUrl: string | null }>;
  getPayment(paymentId: string): Promise<{ status: string; confirmationUrl: string | null } | null>;
}
```

- db-делегат `DrizzlePurchaseRepository` → существующие query-функции
  (`hasPurchasedTrack`, `getPendingPurchase`, `createPendingPurchase`,
  `confirmPurchaseByExternalId`, `failPurchaseByExternalId`, `trackExists`,
  `getTrackTitle`). Сигнатуры запросов не менять; `getPending` возвращает только
  нужные поля (id, externalPaymentId).
- Web-адаптер `lib/payment-gateway.ts` — обёртка над `lib/yookassa`:
  `createPayment` пробрасывает throw (1:1 — сейчас необработанный отказ = 500);
  `getPayment` ловит ошибку → `null` (1:1 с `.catch(() => null)` на краю);
  маппит `confirmation?.confirmation_url ?? null` → `confirmationUrl`.

## PurchaseService (services/purchase.ts)

`constructor(repo: IPurchaseRepository, gateway: IPaymentGateway, deps?: { idGen?: () => string })`
— случайность (`crypto.randomUUID`) за инъекцией (`idGen`, DI-паттерн 1-D:
метод без нужной зависимости бросает Error).

- `TRACK_PRICE = '99.00'` — бизнес-константа, живёт в сервисе.
- `purchase(userId, trackId, returnUrl)` →
  `Result<{ alreadyOwned: true } | { confirmationUrl: string }, NotFoundError>`:
  1. `trackExists` → нет → `err(NotFoundError)`;
  2. `hasPurchased` → да → `ok({ alreadyOwned: true })`;
  3. `getPending` → есть → `gateway.getPayment(externalPaymentId)`; если
     `confirmationUrl` непустой → `ok({ confirmationUrl })` (переиспользуем
     незакрытый платёж); иначе проваливаемся дальше (1:1);
  4. `getTrackTitle` (`?? trackId`), `id = idGen()`,
     `gateway.createPayment({ idempotencyKey: id, amount: TRACK_PRICE,
     description: 'Трек: ' + title, returnUrl, metadata: { purchaseId: id } })`,
     `repo.createPending(...)` (порядок 1:1: платёж → запись),
     → `ok({ confirmationUrl: payment.confirmationUrl! })` (как сейчас — поле
     читается без проверки; при null это отдаст null в JSON, поведение 1:1).
- `handleWebhookEvent(event, paymentId)` → `Promise<void>`:
  `payment.succeeded` → `gateway.getPayment`; статус `succeeded` →
  `repo.confirmByExternalId`. `payment.canceled` → re-fetch; статус `canceled` →
  `repo.failByExternalId`. Прочие события/не совпавший статус/недоступный
  API — no-op. (Re-fetch обязателен — защита от подделанных вебхуков,
  комментарий-«почему» сохранить.)

## Край (роуты)

- **purchase**: auth → 401; `isConfigured()` из `lib/yookassa` — остаётся на краю
  **на своём месте в порядке проверок** (после hasPurchased, до создания платежа;
  чтение env = конфиг края) → 503 `{ error: 'Платёжный сервис не настроен' }`;
  парсинг body `returnUrl` (`?? APP_URL + '/'`, env — край); сборка DI; маппинг:
  `NotFoundError` → 404 `{ error: 'Not found' }`; `alreadyOwned` →
  `{ ok: true, alreadyOwned: true }`; иначе `{ confirmationUrl }`.
- **webhook**: rate-limit (120/60) → 429; парсинг/валидация формы тела
  (`type === 'notification'`, event, paymentId — 400) — край; вызов
  `handleWebhookEvent`; всегда 200 `{ ok: true }` (чтобы ЮKassa не ретраила).

## Тесты

- Core `purchase.test.ts`: NotFound; alreadyOwned; переиспользование pending
  (getPayment с url / без url / null); happy-цепочка с порядком
  createPayment→createPending и проверкой аргументов (idempotencyKey=id,
  metadata.purchaseId=id, price '99.00', description с названием);
  idGen отсутствует → throw; webhook: succeeded+succeeded → confirm,
  succeeded+canceled-статус → no-op, canceled+canceled → fail, canceled+иной →
  no-op, unknown event → no-op, getPayment null → no-op.
- Web route-тесты (паттерн 1-H): purchase — 401 аноним; 404 несуществующий трек;
  alreadyOwned; 503 не настроен (mock `isConfigured` → false); reuse pending;
  happy (создание платежа, тело ответа). Webhook — 429; 400 кривой JSON /
  не-notification / без event/paymentId; succeeded с подтверждённым re-fetch →
  confirm вызван; подделка (re-fetch вернул другой статус) → confirm НЕ вызван,
  всё равно 200; canceled аналогично; unknown event → 200 без вызовов.

## Исполнение

- **J1** — код целиком (core сервис+порт+тесты, db-делегат, web адаптер+роуты+тесты)
  одним Sonnet-агентом. Гейты: typecheck×3, lint, check:routes, тесты core/db/web, build.
- Самокритика (Sonnet, свежий контекст) — сверка 1:1 по диффу, чистота core
  (без env/fetch/crypto), порядок проверок.
- **J2** — доки: stage-2 §1.1 (1-J ✅), CLAUDE.md (счётчики тестов, строка
  «Route handlers Этап 2 — не покрыты» → покрыты), TECHNICAL_DEBT (пункт про
  непокрытую платёжку закрыть, если есть), сюда — «Итоги реализации».

## Итоги реализации

_(заполняется после J1/J2)_
