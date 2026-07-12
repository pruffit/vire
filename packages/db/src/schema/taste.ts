import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const tasteProfiles = pgTable('taste_profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  topMoods: text('top_moods').array().notNull().default(sql`'{}'::text[]`),
  topGenres: text('top_genres').array().notNull().default(sql`'{}'::text[]`),
  topArtistIds: uuid('top_artist_ids').array().notNull().default(sql`'{}'::uuid[]`),
  computedAt: timestamp('computed_at').notNull().defaultNow(),
});
