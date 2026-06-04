import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';

// Лог прослушиваний — ОТДЕЛЬНО от основной транзакционной базы
// Не пишем прямым инсертом на каждый тик — только через буфер/очередь
// Поля: минимум для аналитики + волны ступени 2 + будущих выплат
// Исторические данные невозможно восстановить — пишем с первого дня
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
});
