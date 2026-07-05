import type { Mood } from './track-moods';

/** Ниже этого числа треков личная подборка не создаётся — короче выглядит как мусор. */
export const MIN_PERSONAL_PLAYLIST_TRACKS = 5;

export function hasEnoughTracksForPersonalPlaylist(trackCount: number): boolean {
  return trackCount >= MIN_PERSONAL_PLAYLIST_TRACKS;
}

/**
 * Настроения для личных mood-подборок: следующие по значимости из профиля
 * вкуса, пропуская уже занятые общими MOOD-подборками текущего прогона —
 * иначе на главной дублируется одно и то же настроение общей и личной карточкой.
 */
export function pickPersonalMoods(
  tasteMoods: Mood[],
  excludedMoods: Mood[],
  count: number,
): Mood[] {
  if (count <= 0) return [];
  const excluded = new Set(excludedMoods);
  const picked: Mood[] = [];
  for (const mood of tasteMoods) {
    if (excluded.has(mood)) continue;
    picked.push(mood);
    if (picked.length >= count) break;
  }
  return picked;
}
