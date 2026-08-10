ALTER TABLE "playlists" ADD COLUMN "editorial_params" jsonb;
--> statement-breakpoint
-- Бэкфилл: existing MOOD/PERSONAL строки идентифицируются по русскому заголовку
-- (MOOD_LABELS из packages/db/src/queries/track-moods.ts). Идемпотентно — гейтится на IS NULL.
UPDATE "playlists" p SET "editorial_params" = jsonb_build_object('mood', v.mood)
FROM (VALUES
  ('Меланхолия', 'MELANCHOLY'),
  ('Для ночи', 'NIGHT'),
  ('Для дороги', 'DRIVE'),
  ('Фон', 'AMBIENT'),
  ('Энергия', 'HYPE'),
  ('Расслабон', 'CHILL'),
  ('Эпик', 'EPIC'),
  ('Тёмное', 'DARK'),
  ('Романтика', 'ROMANTIC'),
  ('Ностальгия', 'NOSTALGIC'),
  ('Мечтательное', 'DREAMY'),
  ('Агрессивное', 'AGGRESSIVE'),
  ('Воодушевляющее', 'UPLIFTING'),
  ('Грустное', 'SAD'),
  ('Грувовое', 'GROOVY'),
  ('Медитативное', 'MEDITATIVE'),
  ('Напряжённое', 'TENSE'),
  ('Игривое', 'PLAYFUL')
) AS v(label, mood)
WHERE p.kind = 'MOOD' AND p.title = v.label AND p.editorial_params IS NULL;
--> statement-breakpoint
UPDATE "playlists" p SET "editorial_params" = jsonb_build_object('mood', v.mood)
FROM (VALUES
  ('Меланхолия', 'MELANCHOLY'),
  ('Для ночи', 'NIGHT'),
  ('Для дороги', 'DRIVE'),
  ('Фон', 'AMBIENT'),
  ('Энергия', 'HYPE'),
  ('Расслабон', 'CHILL'),
  ('Эпик', 'EPIC'),
  ('Тёмное', 'DARK'),
  ('Романтика', 'ROMANTIC'),
  ('Ностальгия', 'NOSTALGIC'),
  ('Мечтательное', 'DREAMY'),
  ('Агрессивное', 'AGGRESSIVE'),
  ('Воодушевляющее', 'UPLIFTING'),
  ('Грустное', 'SAD'),
  ('Грувовое', 'GROOVY'),
  ('Медитативное', 'MEDITATIVE'),
  ('Напряжённое', 'TENSE'),
  ('Игривое', 'PLAYFUL')
) AS v(label, mood)
WHERE p.kind = 'PERSONAL' AND p.title LIKE (v.label || ' — %') AND p.editorial_params IS NULL;