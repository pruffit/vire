import { pgTable, uuid, text, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const artistProfiles = pgTable('artist_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  // Тема профиля — CSS-токены: фон, текст, акцент, зерно, шрифты
  links: jsonb('links').default([]),
  videos: jsonb('videos').default([]),
  themeTokens: jsonb('theme_tokens').default({
    bg: '#121110',
    text: '#f5f2eb',
    accent: '#4a5568',
    grain: true,
    fontSans: 'Inter',
    fontMono: 'JetBrains Mono',
  }),
  isActive: boolean('is_active').notNull().default(true),
  verified: boolean('verified').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [index('artist_profiles_user_id_idx').on(t.userId)]);

// Анонсы и новости артиста — канал коммуникации с аудиторией помимо музыки.
// Не полноценный блог: короткие записи, хронология. title опционален.
export const artistPosts = pgTable('artist_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  artistProfileId: uuid('artist_profile_id')
    .notNull()
    .references(() => artistProfiles.id, { onDelete: 'cascade' }),
  title: text('title'),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [index('artist_posts_artist_profile_id_idx').on(t.artistProfileId)]);

// Правообладатель — отдельно от витрины артиста
// Артист = бренд, правообладатель = кому идут деньги
export const rightsHolders = pgTable('rights_holders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  displayName: text('display_name').notNull(),
  // Реквизиты для выплат: мерчант-id, тип сервиса и т.д.
  payoutDetails: jsonb('payout_details'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
