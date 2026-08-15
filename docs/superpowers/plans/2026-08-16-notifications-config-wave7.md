# План: волна 7 (уведомления, письма, env, флаги)

**Спека:** `docs/superpowers/specs/2026-08-16-notifications-config-wave7.md`.
Четыре среза, последовательно. После каждого — гейты и коммит.

## Общие правила

- Тексты — только через `packages/i18n/messages/{ru,en}/*.json`, ru и en в одном изменении.
- Комментарии — только неочевидное «почему», 1–2 строки.
- Публичный вход в core — barrel `packages/core/src/index.ts` (подпути не заводим,
  ничего из этого не нужно edge-middleware).
- Поведение писем и уведомлений не меняется: это рефактор + новый механизм рядом.

## Срез 1 — env (7.4)

**1.1** `packages/core/src/platform/config/env.ts`: zod-схемы `webEnvSchema`/`workerEnvSchema`,
чистая `parseEnv(raw: Record<string, string | undefined>, profile: 'web' | 'worker')`
→ `Result<ParsedEnv, EnvError>` со **списком** всех проблем сразу (не первой). Обязательные
и опциональные — по §2.4 спеки. Тесты: полный набор → ok; пустой → перечислены все
обязательные; опциональные отсутствуют → ok + список `degraded`.

**1.2** `apps/web/instrumentation.ts` — добавить `export async function register()`:
под `process.env.NEXT_RUNTIME === 'nodejs'` валидировать профиль `web`; обязательные
отсутствуют → `throw` со списком; `degraded` → один `console.warn`. Существующий
`onRequestError` не трогать.

**1.3** `apps/worker/src/index.ts` — та же валидация профиля `worker` до создания воркеров.

**Не делать:** не менять места чтения `process.env` у потребителей, не вводить
типизированный `env`-объект вместо `process.env` — это отдельный шаг и он не в волне 7.

## Срез 2 — письма (7.3)

**2.1** `emailShell()` в `core/platform/notifications/email-templates.ts` — вынести
существующую `shell()` в экспортируемую функцию, добавив опциональные `imageUrl`
(обложка) и `subheading` (название релиза). Вёрстка сохраняется байт-в-байт для
существующих писем: сравнение — тестом на подстроки (CTA, футер, `lang`, картинка).

**2.2** `transcodeFailedEmail({ trackTitle, dashboardUrl, recipientName, locale })` в том же
файле + ключи `transcodeFailed.{subject,heading,body,hint,cta,footer}` в
`packages/i18n/messages/{ru,en}/email.json`. Тексты ru — дословно те, что сейчас в
`failureEmailHtml`; en — перевод.

**2.3** `getTrackOwnerContact` (`packages/db/src/queries/notifications.ts`) добавляет
`locale: string | null` в выборку и тип.

**2.4** `apps/worker`: `transcode.worker.ts` зовёт `transcodeFailedEmail` (локаль владельца,
фолбэк `DEFAULT_LOCALE`) вместо локального `failureEmailHtml`; `notify-release.worker.ts` и
`fulfill-presave.worker.ts` строят HTML через `emailShell`; `brevoSender()` остаётся в одном
месте (`lib/brevo.ts`), `lib/mailer.ts` и notify-release используют его.

**Проверка среза:** существующие тесты писем и воркеров зелёные без правок ассертов;
где ассерта на письмо нет — добавить (`transcode.worker.test.ts` уже мокает `sendMail`).

## Срез 3 — типы и события уведомлений (7.1 + 7.2)

**3.1 Миграция.** `packages/db/src/schema/notifications.ts`: `notificationTypeEnum` → `text`.
`pnpm --filter @vire/db db:generate`, затем **прочитать SQL**: допустимо только
`ALTER TABLE "notifications" ALTER COLUMN "type" SET DATA TYPE text` (+ `DROP TYPE
"notification_type"`). Если сгенерирован drop/add колонки — переписать файл миграции руками.
Прогнать `db:migrate` на локальной базе с непустой `notifications` и убедиться, что строки целы.

**3.2 Реестр типов.** `core/platform/notifications/registry.ts`: `NotificationTypeId = string`,
`NotificationTarget = 'actor' | 'jam' | 'playlist'`, `NOTIFICATION_TYPES` с четырьмя
текущими типами, `isKnownNotificationType(id)`, `notificationTargetOf(id)`.
`repositories/notification.ts`: `NotificationType` → `NotificationTypeId`.
`NotificationService.notify` отклоняет неизвестный тип. Тесты на реестр и на отказ.

**3.3 Фронт.** `notification-bell.tsx`: локальный union и `switch` в `notificationHref`
заменяются на `notificationTargetOf` из `@vire/core`; маршруты (`/jam/id/…`,
`/playlists/…`, `/u/…`) и фолбэки остаются те же. i18n-ключи не меняются.

**3.4 Реестр внешних событий.** `core/platform/notifications/events.ts`:
`EXTERNAL_NOTIFY_EVENTS` по §2.2 спеки (билдер письма, билдер пуша, `debounce`).
`notify-external.worker.ts` теряет оба тернарника и ветку `kind === 'CHAT_MESSAGE'`
у дебаунса — политика читается из определения. `decideExternalDelivery` не трогать.
`notify-external.worker.test.ts` не ослаблять: сценарии «онлайн → ничего», «дебаунс чата»,
«прунинг мёртвых подписок» остаются ассертами.

## Срез 4 — feature flags (7.5)

**4.1 БД.** `packages/db/src/schema/feature-flags.ts` + миграция; `DrizzleFeatureFlagRepository`
(`list()`, `get(key)`, `upsert(key, enabled, actorId)`), экспорт из barrel `@vire/db`.

**4.2 Core.** `platform/config/feature-flags.ts`: реестр `FEATURE_FLAGS` (ключ, default,
описание) с единственным пока ключом `sdui.home` (default `false`); порт
`IFeatureFlagRepository`; `FeatureFlagService.isEnabled/listWithState/setEnabled` поверх
`createTtlCache` (TTL 30 с). Неизвестный ключ → ошибка. Тесты: default при отсутствии
строки, БД перебивает default, кэш отдаёт без повторного чтения, `setEnabled` инвалидирует.

**4.3 Права.** `platform/access/permissions.ts`: `admin.flags.manage` в `ADMIN_ALL`
(ADMIN/SUPERADMIN), MODERATOR/VIEWER — без него. Обновить тест матрицы `can.test.ts`.

**4.4 Админка.** `apps/web/app/admin/flags/page.tsx` — список из `listWithState()` на
компонентах `components/admin/ui.tsx` (PageHeader/Table/EmptyState, как
`/admin/playlists`), тумблер рендерится только при `canManageFlags`. Server action
`actionSetFeatureFlag` в `app/admin/actions.ts`: `requireAction('admin.flags.manage')`
→ `setEnabled` → `audit('flag.set', { type: 'flag', id: key }, { enabled })`
→ `revalidatePath('/admin/flags')`. Пункт в навигации админки. `getAdminAccess`
дополняется `canManageFlags`.

**4.5 Доки.** `docs/features/feature-flags.md` по шаблону `docs/features/README.md`.

## Гейты после каждого среза

```bash
pnpm turbo run typecheck check:layers
pnpm --filter @vire/web lint
pnpm --filter @vire/core test
pnpm --filter @vire/web test
pnpm --filter @vire/web check:routes && pnpm --filter @vire/web check:i18n && pnpm --filter @vire/web check:contracts
```

Срез 4 дополнительно: `pnpm --filter @vire/web audit:design`.
После среза 4: прод-сборка (с dummy `DATABASE_URL`/`S3_PUBLIC_ENDPOINT`, как в Dockerfile)
и прожарка дифа отдельным агентом.

## Доки после волны

`docs/migration-plan.md` — волна 7 ✅ с фактическим содержанием (и записью, что 7.3
оказался частично сделан i18n-волной); `docs/roadmap/platform-core-brief.md` — журнал фаз;
`docs/features/notifications.md` — реестр типов и событий; `docs/features/feature-flags.md` — новый.
