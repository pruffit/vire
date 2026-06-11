CREATE TYPE "public"."playlist_kind" AS ENUM('USER', 'MOOD', 'TRENDING', 'RELISTEN', 'FRESH');--> statement-breakpoint
CREATE TABLE "playlist_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"playlist_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "playlist_likes_user_playlist_unique" UNIQUE("user_id","playlist_id")
);
--> statement-breakpoint
ALTER TABLE "playlists" ALTER COLUMN "owner_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "kind" "playlist_kind" DEFAULT 'USER' NOT NULL;--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "likes_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "playlist_likes" ADD CONSTRAINT "playlist_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_likes" ADD CONSTRAINT "playlist_likes_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;