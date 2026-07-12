import { and, eq, inArray, isNotNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../client';
import { trackMoods, tracks, releases, artistProfiles, moodEnum } from '../schema';

export type Mood = typeof moodEnum.enumValues[number];

// Источник правды: сам enum, чтобы список не расходился со схемой. Без spread — copy
// теряет tuple-тип enumValues, а он нужен z.enum() без каста в потребителях.
export const ALL_MOODS = moodEnum.enumValues;

export const MOOD_LABELS: Record<Mood, string> = {
  MELANCHOLY: 'Меланхолия',
  NIGHT:      'Для ночи',
  DRIVE:      'Для дороги',
  AMBIENT:    'Фон',
  HYPE:       'Энергия',
  CHILL:      'Расслабон',
  EPIC:       'Эпик',
  DARK:       'Тёмное',
  ROMANTIC:   'Романтика',
  NOSTALGIC:  'Ностальгия',
  DREAMY:     'Мечтательное',
  AGGRESSIVE: 'Агрессивное',
  UPLIFTING:  'Воодушевляющее',
  SAD:        'Грустное',
  GROOVY:     'Грувовое',
  MEDITATIVE: 'Медитативное',
  TENSE:      'Напряжённое',
  PLAYFUL:    'Игривое',
};

export async function getTrackMoods(trackId: string): Promise<Mood[]> {
  const rows = await db
    .select({ mood: trackMoods.mood })
    .from(trackMoods)
    .where(eq(trackMoods.trackId, trackId));
  return rows.map((r) => r.mood);
}

export async function setTrackMoods(trackId: string, moods: Mood[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(trackMoods).where(eq(trackMoods.trackId, trackId));
    if (moods.length > 0) {
      await tx.insert(trackMoods).values(moods.map((mood) => ({ trackId, mood })));
    }
  });
}

export interface MoodCount {
  mood: Mood;
  count: number;
}

/** Счётчик публично слышимых треков по каждому тегу настроения (для секции на главной). */
export async function getMoodCounts(): Promise<MoodCount[]> {
  return db
    .select({ mood: trackMoods.mood, count: sql<number>`count(*)::int` })
    .from(trackMoods)
    .innerJoin(tracks, eq(tracks.id, trackMoods.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(
      and(
        eq(tracks.status, 'READY'),
        eq(artistProfiles.isActive, true),
        or(
          eq(releases.status, 'PUBLISHED'),
          and(eq(releases.status, 'SCHEDULED'), isNotNull(releases.releaseDate), lte(releases.releaseDate, sql`now()`)),
        ),
      ),
    )
    .groupBy(trackMoods.mood)
    .orderBy(sql`count(*) DESC`);
}

export async function getMoodsForTracks(trackIds: string[]): Promise<Record<string, Mood[]>> {
  if (trackIds.length === 0) return {};
  const rows = await db
    .select()
    .from(trackMoods)
    .where(inArray(trackMoods.trackId, trackIds));
  const result: Record<string, Mood[]> = {};
  for (const row of rows) {
    if (!result[row.trackId]) result[row.trackId] = [];
    result[row.trackId].push(row.mood);
  }
  return result;
}
