ALTER TABLE "playlists" ADD COLUMN "cover_url" text;--> statement-breakpoint
DELETE FROM "playlist_tracks" a
USING "playlist_tracks" b
WHERE a."playlist_id" = b."playlist_id"
  AND a."track_id" = b."track_id"
  AND a."ctid" > b."ctid";--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_playlist_track_unique" UNIQUE("playlist_id","track_id");