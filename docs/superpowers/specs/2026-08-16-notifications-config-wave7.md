# Спека: уведомления, письма, env и флаги (волна 7)

**План миграции:** `docs/migration-plan.md` §Волна 7. **Брифы:** `docs/platform-core.md`
(Core даёт механизм, продукт объявляет типы), `docs/features/notifications.md`,
`docs/features/i18n.md`.

## 1. Что уже не так, как записано в плане

Пункт 7.3 сформулирован по состоянию до i18n-волны и частично устарел:
`notify-release.worker.ts` и `fulfill-presave.worker.ts` **уже** локализованы через
`getTranslator(locale, 'email')`, локаль берётся из `users.locale` получателя.

Фактический остаток 7.3:
- захардкоженный русский — только в письме о падении транскодинга
  (`transcode.worker.ts` → `failureEmailHtml` + `subject`, `<html lang="ru">`);
- HTML-оболочка письма скопирована в **четырёх** местах (`core/email-templates.ts`,
  `notify-release.worker.ts`, `fulfill-presave.worker.ts`, `transcode.worker.ts`);
- `brevoSender()` продублирован в `worker/lib/mailer.ts` и `notify-release.worker.ts`.

## 2. Целевое состояние по пунктам

### 7.1 `notification_type`: enum → text + реестр типов

Сегодня тип уведомления зафиксирован в трёх местах: pgEnum в схеме БД, union в
`repositories/notification.ts`, копия union + `switch` по href в `notification-bell.tsx`.
Новый тип уведомления = миграция БД + правка трёх файлов; для Core это доменное знание,
которого он знать не должен.

**Решение.** Колонка `notifications.type` → `text`. В core тип — `NotificationTypeId = string`,
конкретные типы объявляются реестром:

```ts
// core/platform/notifications/registry.ts — механизм
export interface NotificationTypeDef { id: string; target: NotificationTarget }
export type NotificationTarget = 'actor' | 'jam' | 'playlist';

// продуктовые объявления — там же, одним объектом NOTIFICATION_TYPES
```

- `NotificationService.notify` валидирует id по реестру (неизвестный → отказ, не молчаливая
  запись мусора в БД);
- `notification-bell.tsx` строит href из `target`, а не из `switch` по литералам;
- i18n-ключ остаётся выводимым: `social.notifications.types.${id}`.

Ограничение миграции: `ALTER TABLE ... ALTER COLUMN type TYPE text` + `DROP TYPE`.
Drizzle-kit на смену pgEnum→text может сгенерировать drop/add колонки — сгенерированный
SQL проверяется глазами и при необходимости переписывается вручную. Потеря данных
недопустима: в проде уведомления живые.

### 7.2 Реестр событий и каналов

`notify-external.worker.ts` выбирает шаблон письма и payload пуша двумя тернарниками по
`kind`. Третье событие = третья ветка в двух местах.

**Решение.** Декларативный реестр в core:

```ts
EXTERNAL_NOTIFY_EVENTS: Record<ExternalNotifyKind, {
  email(ctx): Promise<{ subject; html }>;
  push(ctx): Promise<{ title; body; url; tag }>;
  debounce?: 'conversation';
}>
```

Воркер становится «взял определение по kind → отправил по разрешённым каналам».
`decideExternalDelivery` переезжает **как есть** — она уже чистая и уже в core;
меняется только то, что дебаунс-политика читается из определения события, а не из
`if (kind === 'CHAT_MESSAGE')` в воркере.

### 7.3 Общая оболочка письма + транскодинг в i18n

- `emailShell()` — единственная реализация вёрстки письма, экспортируется из
  `core/platform/notifications/email-templates.ts`. Параметры покрывают все четыре
  текущих письма: `heading`, `bodyHtml`, `cta`, опциональные `imageUrl` (обложка релиза)
  и `subheading` (название релиза), футер (отписка / настройки).
- `transcodeFailedEmail({ trackTitle, dashboardUrl, recipientName, locale })` — в core,
  тексты в `packages/i18n/messages/{ru,en}/email.json` (`transcodeFailed.*`), ru и en
  заполняются одновременно.
- `getTrackOwnerContact` дополняется `locale` — письмо о падении уходит на языке артиста,
  как остальные письма платформы.
- `brevoSender()` сводится в `worker/lib/brevo.ts`, оба отправителя используют его.

**Вёрстка писем не меняется визуально** — это рефактор дублей, а не редизайн.

### 7.4 Валидация env через zod на старте процесса

Сегодня 28 переменных читаются россыпью `process.env.X ?? fallback`. Опечатка в имени или
забытый секрет на проде проявляется не при старте, а в момент первой отправки письма/пуша.

**Решение.** Чистая часть — в core (`platform/config/env.ts`): zod-схемы и
`parseEnv(raw, profile)` → `Result`, где `profile: 'web' | 'worker'`. Чтение
`process.env` и решение «падать или предупредить» — в приложениях.

- **Обязательные** (отсутствие = падение на старте, со списком всех недостающих сразу):
  `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`, `S3_ENDPOINT`, `S3_ACCESS_KEY`,
  `S3_SECRET_KEY`, `S3_BUCKET_VAULT`, `S3_BUCKET_STREAM`.
- **Опциональные-с-деградацией** (отсутствие = один warn в лог с явным «фича выключена»):
  `BREVO_API_KEY` (письма), `VAPID_*` (пуши), `YOOKASSA_*` (покупки), `ALERT_WEBHOOK_URL`/
  `TELEGRAM_ALERT_CHAT_ID` (алерты), `LASTFM_API_KEY`, `YOUTUBE_API_KEY`, `AUTO_GENRE*`,
  `LINK_SIGNING_SECRET` (фолбэк на `AUTH_SECRET` — существующее поведение).

**Критично — не сломать сборку.** Docker собирает образ с dummy `DATABASE_URL`
(`apps/web/Dockerfile`), а `NEXT_PUBLIC_*`/CSP пекутся на build-time. Валидация вешается на
`register()` в `apps/web/instrumentation.ts` под `process.env.NEXT_RUNTIME === 'nodejs'` и
на старт `apps/worker/src/index.ts` — то есть в рантайме, не при компиляции. Значения env
модуль не переписывает и не кэширует: существующие потребители продолжают читать
`process.env` как читали.

### 7.5 Feature flags из БД

Сегодня флагов нет вообще. Это предусловие волны 8: SDUI раскатывается за флагом с
откатом «выключить», а не «откатить деплой».

- Таблица `feature_flags`: `key text PK`, `enabled boolean`, `description text`,
  `updated_at`, `updated_by` (→ `users.id`, `set null`).
- Реестр объявлений в core (`FEATURE_FLAGS`: key, default, описание) — источник правды
  о том, какие флаги существуют. Строки в БД может не быть: тогда действует default,
  а админка всё равно показывает флаг. Неизвестный ключ → ошибка, а не «выключено».
- `FeatureFlagService` за портом `IFeatureFlagRepository`; `isEnabled(key)` поверх
  существующего `createTtlCache` (TTL 30 с — переключение доезжает до всех инстансов
  без рестарта, БД не долбится на каждый рендер). `setEnabled` чистит кэш процесса.
- Экран `/admin/flags`: список флагов + тумблер; server action под новым правом
  `admin.flags.manage` (ADMIN/SUPERADMIN; MODERATOR и VIEWER — нет), мутация пишется
  в `audit_log`, как остальные мутации бэкофиса.
- Первый флаг — `sdui.home` (default `false`), потребителя пока нет: он существует, чтобы
  волна 8 начиналась с готового рубильника, и чтобы механизм был проверен на реальном ключе.

## 3. Что НЕ делаем

- Не заводим таргетинг флагов (по проценту, по пользователю, A/B) — нет ни одного
  потребителя; булев флаг с дефолтом закрывает волну 8.
- Не переносим `sendMail`/`sendBrevoEmail` в core — это I/O-адаптер, ему место в приложении;
  в core едут только чистые билдеры письма.
- Не трогаем существующие тексты писем и вёрстку — только дедупликация оболочки.
- Не переводим `/admin` на i18n (backoffice не локализуется — статус-кво).

## 4. Риски

| Риск | Снятие |
|---|---|
| Миграция enum→text уронит данные (drop/add колонки от drizzle-kit) | Сгенерированный SQL читается вручную; в миграции только `ALTER COLUMN ... TYPE text`; проверка на локальной БД до коммита |
| Валидация env уронит прод-старт из-за переменной, которой там законно нет | Обязательный список — только то, без чего процесс всё равно нежизнеспособен; остальное деградирует с warn |
| Валидация env уронит `next build` в Docker | Валидация только в рантайме (`register()`/старт воркера), не на импорте модуля |
| Дедупликация оболочки письма молча испортит вёрстку рассылки | Билдеры писем покрываются тестами (`email-templates.test.ts` уже существует); визуальные признаки — обложка, CTA, футер-отписка — ассертятся |
| Кэш флага «залипнет» на инстансе | TTL 30 с + явная инвалидация в `setEnabled`; в админке состояние читается мимо кэша |

## 5. Проверка

Гейты после каждого среза: `typecheck` (все пакеты), `check:layers`, `lint`,
`test` (web + core), `check:routes`, `check:i18n`, `check:contracts`; на срезе с админкой
дополнительно `audit:design`; прод-сборка перед завершением волны. Миграция БД проверяется
прогоном `db:migrate` на локальной базе с непустой таблицей `notifications`.
