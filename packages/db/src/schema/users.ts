import { pgTable, uuid, text, varchar, timestamp, pgEnum, index, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

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
  friendRequestsSeenAt: timestamp('friend_requests_seen_at'),
  notifyEmail: boolean('notify_email').notNull().default(true),
  notifyPush: boolean('notify_push').notNull().default(true),
  discoverable: boolean('discoverable').notNull().default(true),
  // Только вкус для предложки на вечеринке (user.getTopTracks) — не OAuth, без скробблинга.
  lastfmUsername: varchar('lastfm_username', { length: 64 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  // Триграммный GIN: ILIKE '%q%' по имени (поиск людей) без seq-scan — зеркало artist_profiles
  index('users_name_trgm_idx').using('gin', sql`${t.name} gin_trgm_ops`),
]);
