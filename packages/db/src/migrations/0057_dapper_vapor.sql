CREATE TABLE "expo_push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" text NOT NULL,
	"device_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "expo_push_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "expo_push_tokens" ADD CONSTRAINT "expo_push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expo_push_tokens" ADD CONSTRAINT "expo_push_tokens_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expo_push_tokens_user_id_idx" ON "expo_push_tokens" USING btree ("user_id");