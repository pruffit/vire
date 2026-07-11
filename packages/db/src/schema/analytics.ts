import { pgTable, uuid, text, timestamp, integer, index } from 'drizzle-orm/pg-core';

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
  // Есть ещё покрывающий индекс play_events(track_id, started_at) INCLUDE (duration_played_sec)
  // для волны/популярности: добавлен вручную SQL-миграцией, drizzle-orm не умеет объявлять
  // INCLUDE в схеме, поэтому здесь он не отражён.
  index('play_events_started_at_idx').on(t.startedAt),
  index('play_events_user_id_idx').on(t.userId),
]);
