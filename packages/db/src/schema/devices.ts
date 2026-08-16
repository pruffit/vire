import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

// Устройство = одна выданная пара токенов. Refresh хранится только хэшем: утечка
// таблицы не даёт войти. Отзыв — revoked_at, строка остаётся ради истории входов.
export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  platform: text('platform').notNull(),
  refreshTokenHash: text('refresh_token_hash').notNull(),
  refreshExpiresAt: timestamp('refresh_expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at').notNull().defaultNow(),
  revokedAt: timestamp('revoked_at'),
}, (t) => [
  index('devices_user_idx').on(t.userId, t.revokedAt),
  index('devices_refresh_hash_idx').on(t.refreshTokenHash),
]);
