CREATE TYPE "public"."jam_participant_role" AS ENUM('HOST', 'GUEST');--> statement-breakpoint
CREATE TYPE "public"."jam_session_status" AS ENUM('LIVE', 'ENDED');--> statement-breakpoint
CREATE TABLE "jam_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jam_id" uuid NOT NULL,
	"user_id" uuid,
	"guest_session_id" text,
	"display_name" text NOT NULL,
	"role" "jam_participant_role" NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "jam_participants_jam_user_unique" UNIQUE("jam_id","user_id"),
	CONSTRAINT "jam_participants_jam_guest_unique" UNIQUE("jam_id","guest_session_id"),
	CONSTRAINT "jam_participants_one_identity" CHECK (("jam_participants"."user_id" IS NOT NULL) <> ("jam_participants"."guest_session_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "jam_queue_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jam_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"added_by_participant_id" uuid,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jam_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"host_user_id" uuid NOT NULL,
	"title" text,
	"status" "jam_session_status" DEFAULT 'LIVE' NOT NULL,
	"queue_version" integer DEFAULT 0 NOT NULL,
	"saved_playlist_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	CONSTRAINT "jam_sessions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "jam_participants" ADD CONSTRAINT "jam_participants_jam_id_jam_sessions_id_fk" FOREIGN KEY ("jam_id") REFERENCES "public"."jam_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jam_participants" ADD CONSTRAINT "jam_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jam_queue_items" ADD CONSTRAINT "jam_queue_items_jam_id_jam_sessions_id_fk" FOREIGN KEY ("jam_id") REFERENCES "public"."jam_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jam_queue_items" ADD CONSTRAINT "jam_queue_items_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jam_queue_items" ADD CONSTRAINT "jam_queue_items_added_by_participant_id_jam_participants_id_fk" FOREIGN KEY ("added_by_participant_id") REFERENCES "public"."jam_participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jam_sessions" ADD CONSTRAINT "jam_sessions_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jam_sessions" ADD CONSTRAINT "jam_sessions_saved_playlist_id_playlists_id_fk" FOREIGN KEY ("saved_playlist_id") REFERENCES "public"."playlists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jam_participants_jam_id_idx" ON "jam_participants" USING btree ("jam_id");--> statement-breakpoint
CREATE INDEX "jam_queue_items_jam_id_position_idx" ON "jam_queue_items" USING btree ("jam_id","position");--> statement-breakpoint
CREATE INDEX "jam_sessions_status_last_activity_idx" ON "jam_sessions" USING btree ("status","last_activity_at");