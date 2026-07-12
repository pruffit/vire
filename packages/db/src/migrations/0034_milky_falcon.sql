CREATE TABLE "taste_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"top_moods" text[] DEFAULT '{}'::text[] NOT NULL,
	"top_genres" text[] DEFAULT '{}'::text[] NOT NULL,
	"top_artist_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "taste_profiles" ADD CONSTRAINT "taste_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;