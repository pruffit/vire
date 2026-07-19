import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

// Публичный X25519 identity-ключ пользователя (по одному на юзера, общий для его устройств).
// Приватный ключ на сервер не попадает — живёт на устройствах (IndexedDB).
export const userIdentityKeys = pgTable('user_identity_keys', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  ikPub: text('ik_pub').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
