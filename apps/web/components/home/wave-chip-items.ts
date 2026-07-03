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
  count: number;
  kind: 'mood' | 'genre';
}

/** Настроения → элементы общего чип-рейла волны (см. WaveChips). */
export function moodChipItems(moods: MoodChip[]): WaveChipItem[] {
  return moods.map(({ mood, count }) => ({ key: mood, label: MOOD_LABELS[mood], count, kind: 'mood' }));
}

/** Жанры → элементы общего чип-рейла волны (см. WaveChips). */
export function genreChipItems(genres: GenreCount[]): WaveChipItem[] {
  return genres.map(({ genre, count }) => ({ key: genre, label: GENRE_LABELS[genre], count, kind: 'genre' }));
}
