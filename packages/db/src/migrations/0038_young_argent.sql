ALTER TABLE "users" ADD COLUMN "friend_requests_seen_at" timestamp;--> statement-breakpoint
CREATE INDEX "users_name_trgm_idx" ON "users" USING gin ("name" gin_trgm_ops);