import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../client';
import { trackMoods, type moodEnum } from '../schema';

export type Mood = typeof moodEnum.enumValues[number];

export const ALL_MOODS: Mood[] = [
  'MELANCHOLY', 'NIGHT', 'DRIVE', 'AMBIENT',
  'HYPE', 'CHILL', 'EPIC', 'DARK', 'ROMANTIC', 'NOSTALGIC',
];

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
