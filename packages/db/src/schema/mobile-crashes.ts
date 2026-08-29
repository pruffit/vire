import { pgTable, uuid, text, timestamp, jsonb, index, unique } from 'drizzle-orm/pg-core';

/**
 * Падения мобильного приложения. Приёмник — свой (`apps/web/app/api/1/envelope`), а не
 * sentry.io: он отдаёт 403 на любой запрос из России (проверено с машины разработчика,
 * блок на пограничном балансировщике). SDK при этом остаётся стоковым
 * `@sentry/react-native` — меняется только хост в DSN, поэтому переезд на self-hosted
 * GlitchTip позже не потребует правок клиента.
 *
 * `payload` — событие Sentry целиком: разбирать его на колонки заранее нельзя, схема
 * события богаче любого разумного набора полей. Отдельные колонки — только то, по чему
 * реально листают и фильтруют.
 */
export const mobileCrashes = pgTable('mobile_crashes', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Идентификатор события от SDK. Уникален: клиент повторяет отправку при потере сети,
  // и один и тот же краш не должен размножаться строками.
  eventId: text('event_id').notNull(),
  receivedAt: timestamp('received_at').notNull().defaultNow(),
  // Время на устройстве; расходится с receivedAt, когда краш долежал в офлайн-очереди SDK.
  occurredAt: timestamp('occurred_at'),
  level: text('level'),
  platform: text('platform'),
  environment: text('environment'),
  release: text('release'),
  dist: text('dist'),
  exceptionType: text('exception_type'),
  exceptionValue: text('exception_value'),
  appVersion: text('app_version'),
  deviceModel: text('device_model'),
  osVersion: text('os_version'),
  payload: jsonb('payload').notNull(),
}, (t) => [
  unique('mobile_crashes_event_id_key').on(t.eventId),
  index('mobile_crashes_received_idx').on(t.receivedAt),
  index('mobile_crashes_release_idx').on(t.release, t.receivedAt),
]);
