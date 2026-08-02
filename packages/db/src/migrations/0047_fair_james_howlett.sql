CREATE TYPE "public"."resolution_key_kind" AS ENUM('URL', 'QUERY');--> statement-breakpoint
CREATE TABLE "external_resolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_kind" "resolution_key_kind" NOT NULL,
	"key" text NOT NULL,
	"source" "jam_queue_source",
	"external_id" text,
	"external_url" text,
	"title" text,
	"artist_name" text,
	"cover_url" text,
	"duration_sec" integer,
	"not_found" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp DEFAULT now() NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "external_resolutions_key_unique" UNIQUE("key_kind","key")
);
