import { pgTable, uuid, text, timestamp, index, unique, check, smallint } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

// Диалог 1:1, канонизирован в сервисе (low/high = least/greatest uuid пары) — одна строка на пару.
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userLowId: uuid('user_low_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userHighId: uuid('user_high_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lastMessageAt: timestamp('last_message_at'),
  lowLastReadAt: timestamp('low_last_read_at'),
  highLastReadAt: timestamp('high_last_read_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  unique('conversations_pair_unique').on(t.userLowId, t.userHighId),
  index('conversations_user_low_id_idx').on(t.userLowId),
  index('conversations_user_high_id_idx').on(t.userHighId),
  check('conversations_ordered_pair', sql`${t.userLowId} < ${t.userHighId}`),
]);

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // body — шифротекст (base64), nonce — к нему; сервер расшифровать не может (E2EE).
  body: text('body').notNull(),
  nonce: text('nonce').notNull(),
  encVersion: smallint('enc_version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  // пагинация треда по created_at
  index('messages_conversation_id_created_at_idx').on(t.conversationId, t.createdAt),
]);
