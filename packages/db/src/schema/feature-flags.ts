import { pgTable, text, boolean, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

// Строка есть только у перекрытых флагов: набор флагов держит реестр в @vire/core,
// БД хранит переключения. updated_by — set null, чтобы удаление админа не стирало флаг.
export const featureFlags = pgTable('feature_flags', {
  key: text('key').primaryKey(),
  enabled: boolean('enabled').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
});
