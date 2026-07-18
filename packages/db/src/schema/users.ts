import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', [
  'LISTENER',
  'ARTIST',
  'MODERATOR',
  'ADMIN',
  'SUPERADMIN',
  // Read-only бэкофис: доступ в /admin есть, но мутации на сервере молча игнорируются.
  'VIEWER',
]);

export const userSocialVisibilityEnum = pgEnum('user_social_visibility', ['FRIENDS', 'PRIVATE']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  passwordHash: text('password_hash'),
  role: roleEnum('role').notNull().default('LISTENER'),
  socialVisibility: userSocialVisibilityEnum('social_visibility').notNull().default('FRIENDS'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
