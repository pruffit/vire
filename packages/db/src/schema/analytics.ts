import { pgTable, uuid, text, timestamp, integer, index } from 'drizzle-orm/pg-core';

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
}, (t) => [
  // Самая быстрорастущая таблица — без индексов вся аналитика идёт seq-scan'ом.
  // ЕДИНСТВЕННЫЙ композит по (track_id, started_at) — play_events_track_started_covering_idx,
  // с INCLUDE (duration_played_sec). Горячие запросы (популярность, волна) всегда фильтруют
  // "track_id = X AND started_at >= now() - interval" — композит обслуживает это, а INCLUDE
  // вдобавок даёт index-only scan для qualityScore в wave.ts (AVG(duration_played_sec) без
  // похода в heap). Ведущая колонка та же, поэтому равенство по track_id без диапазона
  // (напр. admin.ts playsTotal) тоже покрыто. Заменил обычный play_events_track_started_idx
  // (0032) — держать оба btree на самой горячей на вставку таблице расточительно, покрывающий
  // — надмножество по обслуживаемым чтениям. Добавлен вручную в миграции 0033 (DROP старого +
  // CREATE покрывающего): drizzle-orm 0.45.2 не выражает INCLUDE декларативно (нет поля в
  // IndexConfig), поэтому здесь не объявлен — снапшот 0033 отражает его отсутствие в схеме.
  // Замер (10.07.2026, синтетика 1500 треков/220k play_events/60д): getWaveTracks
  // (режим похожести) медиана 5818мс → 302мс (19.3×), qualityScore-подзапрос по всем
  // кандидатам Bitmap Heap Scan → Index Only Scan (Heap Fetches: 0). См. docs/roadmap/TODO.md.
  index('play_events_started_at_idx').on(t.startedAt),
  index('play_events_user_id_idx').on(t.userId),
]);
