import { pgTable, uuid, text, pgEnum, numeric, index } from 'drizzle-orm/pg-core';
import { tracks } from './releases';
import { rightsHolders } from './artists';

export const contributorRoleEnum = pgEnum('contributor_role', [
  'PERFORMER',
  'LYRICIST',
  'COMPOSER',
  'PRODUCER',
]);

// Ключевая таблица: не artist_id прямо в треке, а связь через правообладателей с долями
// numeric(5,2) — точные проценты без ошибок округления (50.00%, не float)
// На этапах 1-3: одна строка, 100.00% у одного человека
// На этапе 4: реальное сплитование без миграции схемы
export const trackContributors = pgTable('track_contributors', {
  id: uuid('id').primaryKey().defaultRandom(),
  trackId: uuid('track_id').notNull().references(() => tracks.id),
  rightsHolderId: uuid('rights_holder_id').notNull().references(() => rightsHolders.id),
  role: contributorRoleEnum('role').notNull().default('PERFORMER'),
  // Сумма долей по треку должна = 100.00 — проверяется в сервисе
  payoutShare: numeric('payout_share', { precision: 5, scale: 2 }).notNull().default('100.00'),
}, (t) => [index('track_contributors_track_id_idx').on(t.trackId)]);

