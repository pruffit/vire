CREATE TABLE "release_presaves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"user_id" uuid,
	"email" text,
	"fulfilled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "release_presaves_release_user_uq" UNIQUE("release_id","user_id"),
	CONSTRAINT "release_presaves_release_email_uq" UNIQUE("release_id","email")
);
--> statement-breakpoint
ALTER TABLE "release_presaves" ADD CONSTRAINT "release_presaves_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_presaves" ADD CONSTRAINT "release_presaves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "release_presaves_release_id_idx" ON "release_presaves" USING btree ("release_id");