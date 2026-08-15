import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

// actor_id хватает для ссылки на /u/[actor]; entity_id — задел под будущие типы уведомлений.
// type — text, а не enum: набор типов держит реестр в @vire/core, новый тип не требует миграции.
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'cascade' }),
  entityId: uuid('entity_id'),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  // выборка непрочитанных/ленты одним индексом
  index('notifications_user_read_created_idx').on(t.userId, t.readAt, t.createdAt),
]);
