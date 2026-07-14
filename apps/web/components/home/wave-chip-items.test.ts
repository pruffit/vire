import { describe, expect, it } from 'vitest';
import { topWaveChips } from './wave-chip-items';
import type { Mood } from '@/lib/moods';
import type { Genre } from '@/lib/genres';

const m = (mood: Mood, count: number) => ({ mood, count });
const g = (genre: Genre, count: number) => ({ genre, count });

describe('topWaveChips', () => {
  it('смешивает mood и genre по убыванию count и режет до cap', () => {
    const chips = topWaveChips(
      [m('DARK', 10), m('HYPE', 3)],
      [g('HIPHOP', 7), g('ROCK', 5), g('ELECTRONIC', 1)],
      3,
    );
    expect(chips.map((c) => c.key)).toEqual(['DARK', 'HIPHOP', 'ROCK']);
  });

  it('дефолтный cap = 8', () => {
    const moods = (['DARK', 'HYPE', 'SAD', 'UPLIFTING', 'NIGHT'] as Mood[]).map((x, i) => m(x, 100 - i));
    const genres = (['HIPHOP', 'ROCK', 'ELECTRONIC', 'POP', 'JAZZ'] as Genre[]).map((x, i) => g(x, 50 - i));
    expect(topWaveChips(moods, genres)).toHaveLength(8);
  });

  it('kind сохраняется для сида волны', () => {
    const chips = topWaveChips([m('DARK', 1)], [g('ROCK', 2)], 8);
    expect(chips.find((c) => c.key === 'ROCK')?.kind).toBe('genre');
    expect(chips.find((c) => c.key === 'DARK')?.kind).toBe('mood');
  });

  it('совпадающие лейблы mood/genre («Эмбиент») не дублируются — выигрывает более популярный', () => {
    const chips = topWaveChips([m('AMBIENT', 3)], [g('AMBIENT', 9), g('ROCK', 1)], 8);
    const ambient = chips.filter((c) => c.label === 'Эмбиент');
    expect(ambient).toHaveLength(1);
    expect(ambient[0].kind).toBe('genre');
  });
});
