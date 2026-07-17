import { pgTable, uuid, text, timestamp, integer, index, date } from 'drizzle-orm/pg-core';

// Отдельно от транзакционной базы: минимальные поля для аналитики, волны и будущих выплат
// Исторические данные не восстановить задним числом: пишем с первого дня
export const playEvents = pgTable('play_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull(),
  trackId: uuid('track_id').notNull(),
  // nullable — аноним тоже считается
  userId: uuid('user_id'),
  // откуда запустили: direct, playlist, wave, search
  source: text('source').notNull().default('direct'),
  durationPlayedSec: integer('duration_played_sec').notNull().default(0),
  startedAt: timestamp('started_at').notNull().defaultNow(),
}, (t) => [
  // Есть ещё покрывающий индекс play_events(track_id, started_at) INCLUDE (duration_played_sec, source)
  // для волны/популярности: добавлен вручную SQL-миграцией, drizzle-orm не умеет объявлять
  // INCLUDE в схеме, поэтому здесь он не отражён.
  index('play_events_started_at_idx').on(t.startedAt),
  index('play_events_user_id_idx').on(t.userId),
]);

// Ежедневный снапшот платформы (тоталы невосстановимы задним числом) —
// см. docs/features/platform-metrics.md.
export const platformMetricsDaily = pgTable('platform_metrics_daily', {
  day: date('day').primaryKey(),
  users: integer('users').notNull().default(0),
  artists: integer('artists').notNull().default(0),
  releasesPublished: integer('releases_published').notNull().default(0),
  tracksReady: integer('tracks_ready').notNull().default(0),
  plays: integer('plays').notNull().default(0),
  listeners: integer('listeners').notNull().default(0),
  likesTotal: integer('likes_total').notNull().default(0),
  followsTotal: integer('follows_total').notNull().default(0),
  playlistsTotal: integer('playlists_total').notNull().default(0),
  postsTotal: integer('posts_total').notNull().default(0),
});
