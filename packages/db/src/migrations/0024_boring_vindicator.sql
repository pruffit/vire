CREATE TABLE "artist_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_profile_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'MEMBER' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "artist_members_artist_user_unique" UNIQUE("artist_profile_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "artist_members" ADD CONSTRAINT "artist_members_artist_profile_id_artist_profiles_id_fk" FOREIGN KEY ("artist_profile_id") REFERENCES "public"."artist_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_members" ADD CONSTRAINT "artist_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artist_members_user_id_idx" ON "artist_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "artist_members_artist_profile_id_idx" ON "artist_members" USING btree ("artist_profile_id");--> statement-breakpoint
-- Бэкфил: текущий владелец каждого профиля становится OWNER-участником, иначе после
-- перехода контроля доступа на artist_members существующие артисты потеряют дашборд.
INSERT INTO "artist_members" ("artist_profile_id", "user_id", "role")
SELECT "id", "user_id", 'OWNER' FROM "artist_profiles"
ON CONFLICT ("artist_profile_id", "user_id") DO NOTHING;