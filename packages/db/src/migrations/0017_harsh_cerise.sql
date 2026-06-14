ALTER TYPE "public"."playlist_kind" ADD VALUE 'PERSONAL';--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "target_user_id" uuid;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "playlists_target_user_id_idx" ON "playlists" USING btree ("target_user_id");