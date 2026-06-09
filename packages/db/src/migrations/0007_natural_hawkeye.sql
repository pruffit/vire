-- Переводим track_moods с uuid-PK на composite PK (track_id, mood)
-- Порядок важен: сначала снимаем старый PK, потом удаляем id, потом ставим новый PK
ALTER TABLE "track_moods" DROP CONSTRAINT "track_moods_pkey";
--> statement-breakpoint
ALTER TABLE "track_moods" DROP CONSTRAINT "track_moods_track_id_tracks_id_fk";
--> statement-breakpoint
ALTER TABLE "track_moods" DROP COLUMN "id";
--> statement-breakpoint
ALTER TABLE "track_moods" ADD CONSTRAINT "track_moods_track_id_mood_pk" PRIMARY KEY("track_id","mood");
--> statement-breakpoint
ALTER TABLE "track_moods" ADD CONSTRAINT "track_moods_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Расширяем enum mood: добавляем HYPE, EPIC, ROMANTIC, NOSTALGIC; заменяем FOCUS/ENERGY
ALTER TABLE "public"."track_moods" ALTER COLUMN "mood" SET DATA TYPE text;
--> statement-breakpoint
DROP TYPE "public"."mood";
--> statement-breakpoint
CREATE TYPE "public"."mood" AS ENUM('MELANCHOLY', 'NIGHT', 'DRIVE', 'AMBIENT', 'HYPE', 'CHILL', 'EPIC', 'DARK', 'ROMANTIC', 'NOSTALGIC');
--> statement-breakpoint
ALTER TABLE "public"."track_moods" ALTER COLUMN "mood" SET DATA TYPE "public"."mood" USING "mood"::"public"."mood";
