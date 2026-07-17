CREATE TABLE "platform_metrics_daily" (
	"day" date PRIMARY KEY NOT NULL,
	"users" integer DEFAULT 0 NOT NULL,
	"artists" integer DEFAULT 0 NOT NULL,
	"releases_published" integer DEFAULT 0 NOT NULL,
	"tracks_ready" integer DEFAULT 0 NOT NULL,
	"plays" integer DEFAULT 0 NOT NULL,
	"listeners" integer DEFAULT 0 NOT NULL,
	"likes_total" integer DEFAULT 0 NOT NULL,
	"follows_total" integer DEFAULT 0 NOT NULL,
	"playlists_total" integer DEFAULT 0 NOT NULL,
	"posts_total" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
-- Бэкфил истории до первого прогона снапшот-джобы: кумулятивные тоталы на конец дня
-- по created_at (releases — по published_at, tracks_ready — по текущему статусу+updated_at,
-- точной истории статусов нет), plays/listeners за день из play_events. Удалённые
-- лайки/подписки/плейлисты не восстановить — принятая погрешность (см. docs/features/platform-metrics.md).
INSERT INTO "platform_metrics_daily" (
  "day", "users", "artists", "releases_published", "tracks_ready",
  "plays", "listeners", "likes_total", "follows_total", "playlists_total", "posts_total"
)
SELECT
  d.day::date,
  (SELECT count(*) FROM "users" u WHERE u.created_at < d.day + interval '1 day')::int,
  (SELECT count(*) FROM "artist_profiles" a WHERE a.created_at < d.day + interval '1 day')::int,
  (SELECT count(*) FROM "releases" r WHERE r.published_at IS NOT NULL AND r.published_at < d.day + interval '1 day')::int,
  (SELECT count(*) FROM "tracks" t WHERE t.status = 'READY' AND t.updated_at < d.day + interval '1 day')::int,
  (SELECT count(*) FROM "play_events" pe WHERE pe.started_at >= d.day AND pe.started_at < d.day + interval '1 day')::int,
  (SELECT count(DISTINCT pe.session_id) FROM "play_events" pe WHERE pe.started_at >= d.day AND pe.started_at < d.day + interval '1 day')::int,
  (SELECT count(*) FROM "likes" l WHERE l.created_at < d.day + interval '1 day')::int,
  (SELECT count(*) FROM "follows" f WHERE f.created_at < d.day + interval '1 day')::int,
  (SELECT count(*) FROM "playlists" p WHERE p.created_at < d.day + interval '1 day')::int,
  (SELECT count(*) FROM "artist_posts" ap WHERE ap.created_at < d.day + interval '1 day')::int
FROM generate_series(
  (SELECT date_trunc('day', min(created_at)) FROM "users"),
  date_trunc('day', now()) - interval '1 day',
  interval '1 day'
) AS d(day)
ON CONFLICT ("day") DO NOTHING;
