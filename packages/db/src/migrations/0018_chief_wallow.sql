CREATE TABLE "smart_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_profile_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"cover_url" text,
	"release_date" timestamp,
	"links" jsonb DEFAULT '[]'::jsonb,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "smart_links_artist_slug_unique" UNIQUE("artist_profile_id","slug")
);
--> statement-breakpoint
ALTER TABLE "smart_links" ADD CONSTRAINT "smart_links_artist_profile_id_artist_profiles_id_fk" FOREIGN KEY ("artist_profile_id") REFERENCES "public"."artist_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "smart_links_artist_profile_id_idx" ON "smart_links" USING btree ("artist_profile_id");