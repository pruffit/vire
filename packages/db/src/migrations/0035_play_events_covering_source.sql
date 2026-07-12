-- Custom SQL migration file, put your code below! --
-- qualityScore стал взвешенным по source (wave-scoring) — колонка нужна в INCLUDE,
-- иначе Index Only Scan из 0033 деградирует в heap fetches. Без CONCURRENTLY: см. 0033.
DROP INDEX "play_events_track_started_covering_idx";
CREATE INDEX "play_events_track_started_covering_idx" ON "play_events" USING btree ("track_id","started_at") INCLUDE ("duration_played_sec","source");