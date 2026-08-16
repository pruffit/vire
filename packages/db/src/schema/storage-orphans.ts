import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

// Журнал файлов, оставшихся без владельца после удаления сущности. Удаляет их
// фоновый уборщик — не запрос пользователя: падение между БД и S3 иначе теряет ключи.
export const storageOrphans = pgTable('storage_orphans', {
  id: uuid('id').primaryKey().defaultRandom(),
  bucket: text('bucket').notNull(),
  prefix: text('prefix').notNull(),
  reason: text('reason').notNull(),
  entityId: text('entity_id').notNull(),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  cleanedAt: timestamp('cleaned_at'),
}, (t) => [
  index('storage_orphans_pending_idx').on(t.cleanedAt, t.createdAt),
]);
