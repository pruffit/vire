CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
DROP INDEX "play_events_track_id_idx";--> statement-breakpoint
CREATE INDEX "artist_profiles_name_trgm_idx" ON "artist_profiles" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "releases_title_trgm_idx" ON "releases" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "tracks_title_trgm_idx" ON "tracks" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "play_events_track_started_idx" ON "play_events" USING btree ("track_id","started_at");