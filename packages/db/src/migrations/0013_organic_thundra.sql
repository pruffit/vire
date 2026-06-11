CREATE TABLE "track_genres" (
	"track_id" uuid NOT NULL,
	"genre" "genre" NOT NULL,
	CONSTRAINT "track_genres_track_id_genre_pk" PRIMARY KEY("track_id","genre")
);
--> statement-breakpoint
ALTER TABLE "track_genres" ADD CONSTRAINT "track_genres_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;