CREATE TABLE "user_identity_keys" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"ik_pub" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DELETE FROM "messages";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "nonce" text NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "enc_version" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_identity_keys" ADD CONSTRAINT "user_identity_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;