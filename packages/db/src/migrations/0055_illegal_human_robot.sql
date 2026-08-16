CREATE TABLE "storage_orphans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket" text NOT NULL,
	"prefix" text NOT NULL,
	"reason" text NOT NULL,
	"entity_id" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"cleaned_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "storage_orphans_pending_idx" ON "storage_orphans" USING btree ("cleaned_at","created_at");