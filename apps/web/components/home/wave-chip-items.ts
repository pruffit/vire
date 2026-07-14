import type { GenreCount } from '@vire/db';
import { MOOD_LABELS, type Mood } from '@/lib/moods';
import { GENRE_LABELS } from '@/lib/genres';

export interface MoodChip {
  mood: Mood;
  count: number;
}

export interface WaveChipItem {
  key: string;
  label: string;
  kind: 'mood' | 'genre';
}

/** Топ-N чипов волны: mood и genre вперемешку по популярности — один ряд вместо двух. */
export function topWaveChips(moods: MoodChip[], genres: GenreCount[], cap = 8): WaveChipItem[] {
  const all: { item: WaveChipItem; count: number }[] = [
    ...moods.map(({ mood, count }) => ({ item: { key: mood, label: MOOD_LABELS[mood], kind: 'mood' as const }, count })),
    ...genres.map(({ genre, count }) => ({ item: { key: genre, label: GENRE_LABELS[genre], kind: 'genre' as const }, count })),
  ];
  all.sort((a, b) => b.count - a.count || a.item.label.localeCompare(b.item.label, 'ru'));
  return all.slice(0, cap).map((e) => e.item);
}
