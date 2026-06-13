ALTER TABLE "releases" ADD COLUMN "published_at" timestamp;
--> statement-breakpoint
-- Бэкфилл уже опубликованных релизов: точного времени выхода в истории нет,
-- updated_at — ближайший прокси (updateStatus штампует его в момент публикации).
-- SCHEDULED, открывшиеся по дате, оставляем с NULL — для них сортировка падает
-- на release_date.
UPDATE "releases" SET "published_at" = "updated_at" WHERE "status" = 'PUBLISHED';