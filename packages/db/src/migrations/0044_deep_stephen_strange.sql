ALTER TYPE "public"."notification_type" ADD VALUE 'PLAYLIST_COLLAB_JOIN';--> statement-breakpoint
CREATE TABLE "playlist_collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playlist_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"invited_by" uuid,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "playlist_collaborators_playlist_user_unique" UNIQUE("playlist_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "collab_token" text;--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "playlist_collaborators" ADD CONSTRAINT "playlist_collaborators_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_collaborators" ADD CONSTRAINT "playlist_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_collaborators" ADD CONSTRAINT "playlist_collaborators_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "playlist_collaborators_playlist_id_idx" ON "playlist_collaborators" USING btree ("playlist_id");--> statement-breakpoint
CREATE INDEX "playlist_collaborators_user_id_idx" ON "playlist_collaborators" USING btree ("user_id");