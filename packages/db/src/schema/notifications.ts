import { pgTable, uuid, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const notificationTypeEnum = pgEnum('notification_type', ['FRIEND_REQUEST', 'FRIEND_ACCEPT', 'JAM_INVITE', 'PLAYLIST_COLLAB_JOIN']);

// actor_id хватает для ссылки на /u/[actor]; entity_id — задел под будущие типы уведомлений.
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'cascade' }),
  entityId: uuid('entity_id'),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  // выборка непрочитанных/ленты одним индексом
  index('notifications_user_read_created_idx').on(t.userId, t.readAt, t.createdAt),
]);
