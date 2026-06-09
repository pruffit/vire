CREATE TABLE "artist_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_profile_id" uuid NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artist_posts" ADD CONSTRAINT "artist_posts_artist_profile_id_artist_profiles_id_fk" FOREIGN KEY ("artist_profile_id") REFERENCES "public"."artist_profiles"("id") ON DELETE cascade ON UPDATE no action;