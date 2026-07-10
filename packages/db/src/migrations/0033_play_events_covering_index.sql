-- Custom SQL migration file, put your code below! --
-- Покрывающий индекс для qualityScore (wave.ts): AVG(duration_played_sec) по
-- track_id + started_at-диапазону без похода в heap. drizzle-orm 0.45.2 не умеет
-- INCLUDE в декларативной схеме (нет поля в IndexConfig) — миграция кастомная,
-- schema.ts не объявляет ни его, ни замененный им обычный композит (см. коммент
-- у индексов play_events в schema/analytics.ts).
-- Замер (10.07.2026, синтетика 1500 треков/220k play_events/60д): Bitmap Heap
-- Scan → Index Only Scan (Heap Fetches: 0), getWaveTracks медиана 5818мс → 302мс
-- (19.3×) — покрывающий индекс заменяет play_events_track_started_idx (0032)
-- целиком, а не добавляется рядом (самая горячая на вставку таблица).
-- Ops: без CONCURRENTLY (Drizzle гоняет миграции в транзакции, CONCURRENTLY там
-- запрещён) — DROP+CREATE держит короткий lock на запись play_events. На текущем
-- объёме окно ничтожно; при большом росте строить индекс вручную CONCURRENTLY вне
-- миграции, а миграцию свести к IF NOT EXISTS.
DROP INDEX "play_events_track_started_idx";
CREATE INDEX "play_events_track_started_covering_idx" ON "play_events" USING btree ("track_id","started_at") INCLUDE ("duration_played_sec");
