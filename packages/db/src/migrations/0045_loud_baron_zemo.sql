CREATE TYPE "public"."jam_mode" AS ENUM('SYNCED', 'SPEAKER');--> statement-breakpoint
ALTER TABLE "jam_sessions" ADD COLUMN "mode" "jam_mode" DEFAULT 'SYNCED' NOT NULL;--> statement-breakpoint
ALTER TABLE "jam_sessions" ADD COLUMN "speaker_participant_id" uuid;--> statement-breakpoint
ALTER TABLE "jam_sessions" ADD CONSTRAINT "jam_sessions_speaker_participant_id_jam_participants_id_fk" FOREIGN KEY ("speaker_participant_id") REFERENCES "public"."jam_participants"("id") ON DELETE set null ON UPDATE no action;