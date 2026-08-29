CREATE TABLE "mobile_crashes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"occurred_at" timestamp,
	"level" text,
	"platform" text,
	"environment" text,
	"release" text,
	"dist" text,
	"exception_type" text,
	"exception_value" text,
	"app_version" text,
	"device_model" text,
	"os_version" text,
	"payload" jsonb NOT NULL,
	CONSTRAINT "mobile_crashes_event_id_key" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE INDEX "mobile_crashes_received_idx" ON "mobile_crashes" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "mobile_crashes_release_idx" ON "mobile_crashes" USING btree ("release","received_at");