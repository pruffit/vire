import { pgTable, uuid, text, timestamp, boolean, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { users } from './users';
import { releases } from './releases';

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

// Smart-link лендинги (bandlink): красивая страница релиза со ссылками на
// стриминги и соцсети. Самостоятельный маркетинг-инструмент — НЕ требует
// загрузки музыки в Vire, живёт отдельно от releases/tracks.
// Публичный URL: /smartlink/{artistSlug}/{slug}. links — массив { url, label? },
// площадка распознаётся из URL при рендере (lib/platforms).
export const smartLinks = pgTable('smart_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  artistProfileId: uuid('artist_profile_id')
    .notNull()
    .references(() => artistProfiles.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  coverUrl: text('cover_url'),
  releaseDate: timestamp('release_date'),
  // Фаза B: привязка к релизу Vire. Когда задан — лендинг авто-подхватывает
  // обложку/название/дату релиза, а первой кнопкой идёт «Слушать/Пресейв на Vire».
  // onDelete: set null — удаление релиза не сносит маркетинговый лендинг.
  releaseId: uuid('release_id').references(() => releases.id, { onDelete: 'set null' }),
  links: jsonb('links').default([]),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  // slug уникален в пределах артиста — URL /smartlink/{artist}/{slug}
  unique('smart_links_artist_slug_unique').on(t.artistProfileId, t.slug),
  index('smart_links_artist_profile_id_idx').on(t.artistProfileId),
]);

// Участники артист-профиля: несколько аккаунтов могут управлять одной карточкой.
// role: OWNER (создатель, неудаляем) | MEMBER (равный доступ к дашборду в v1 — права
// не разводим). artist_profiles.user_id остаётся указателем на владельца; членство —
// список ВСЕХ аккаунтов с доступом (включая владельца, заведён бэкфилом). Контроль
// доступа к /dashboard скоупится через эту таблицу. Добавляет участников админ.
export const artistMembers = pgTable('artist_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  artistProfileId: uuid('artist_profile_id')
    .notNull()
    .references(() => artistProfiles.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('MEMBER'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  unique('artist_members_artist_user_unique').on(t.artistProfileId, t.userId),
  index('artist_members_user_id_idx').on(t.userId),
  index('artist_members_artist_profile_id_idx').on(t.artistProfileId),
]);

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
