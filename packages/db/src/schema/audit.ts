import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users';

// Аудит платформенных мутаций (RBAC-волна 1). actor_user_id — set null, чтобы удаление
// пользователя не стирало историю его действий.
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  actorRole: text('actor_role').notNull(),
  permission: text('permission').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('audit_log_created_at_idx').on(t.createdAt.desc()),
  index('audit_log_actor_user_id_idx').on(t.actorUserId),
]);
