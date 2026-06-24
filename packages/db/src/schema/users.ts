import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', [
  'LISTENER',
  'ARTIST',
  'MODERATOR',
  'ADMIN',
  'SUPERADMIN',
  // Read-only бэкофис: пускает в /admin, листает все табы, но любые мутации
  // на сервере молча игнорируются (для дизайнера/наблюдателя).
  'VIEWER',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  passwordHash: text('password_hash'),
  role: roleEnum('role').notNull().default('LISTENER'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
