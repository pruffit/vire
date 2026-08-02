CREATE TYPE "public"."jam_queue_source" AS ENUM('VIRE', 'YOUTUBE', 'SOUNDCLOUD', 'LOCAL');--> statement-breakpoint
CREATE TYPE "public"."jam_session_kind" AS ENUM('JAM', 'PARTY');--> statement-breakpoint
ALTER TABLE "jam_queue_items" ALTER COLUMN "track_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "jam_queue_items" ADD COLUMN "source" "jam_queue_source" DEFAULT 'VIRE' NOT NULL;--> statement-breakpoint
ALTER TABLE "jam_queue_items" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "jam_queue_items" ADD COLUMN "external_url" text;--> statement-breakpoint
ALTER TABLE "jam_queue_items" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "jam_queue_items" ADD COLUMN "artist_name" text;--> statement-breakpoint
ALTER TABLE "jam_queue_items" ADD COLUMN "cover_url" text;--> statement-breakpoint
ALTER TABLE "jam_queue_items" ADD COLUMN "duration_sec" integer;--> statement-breakpoint
ALTER TABLE "jam_sessions" ADD COLUMN "kind" "jam_session_kind" DEFAULT 'JAM' NOT NULL;--> statement-breakpoint
ALTER TABLE "jam_queue_items" ADD CONSTRAINT "jam_queue_items_source_consistency" CHECK ((
      ("jam_queue_items"."source" = 'VIRE' AND "jam_queue_items"."track_id" IS NOT NULL AND "jam_queue_items"."external_id" IS NULL)
      OR ("jam_queue_items"."source" IN ('YOUTUBE', 'SOUNDCLOUD') AND "jam_queue_items"."track_id" IS NULL AND "jam_queue_items"."external_id" IS NOT NULL AND "jam_queue_items"."title" IS NOT NULL)
      OR ("jam_queue_items"."source" = 'LOCAL' AND "jam_queue_items"."track_id" IS NULL AND "jam_queue_items"."title" IS NOT NULL)
    ));