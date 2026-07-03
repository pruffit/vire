import { MOOD_LABELS, type Mood } from '@/lib/moods';
import type { WaveChipItem } from '@/components/home/wave-chips';

export interface MoodChip {
  mood: Mood;
  count: number;
}

/** Настроения → элементы общего чип-рейла волны (см. WaveChips). */
export function moodChipItems(moods: MoodChip[]): WaveChipItem[] {
  return moods.map(({ mood, count }) => ({ key: mood, label: MOOD_LABELS[mood], count, kind: 'mood' }));
}
