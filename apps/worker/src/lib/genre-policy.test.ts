import { describe, it, expect } from 'vitest';
import { decideAutoApplyGenres } from './genre-policy.js';
import type { GenreSuggestion } from './discogs-genre-map.js';

const suggestions: GenreSuggestion[] = [
  { genre: 'TECHNO', confidence: 0.5 },
  { genre: 'HOUSE', confidence: 0.3 },
  { genre: 'TRANCE', confidence: 0.04 }, // ниже порога 0.05
];

describe('decideAutoApplyGenres', () => {
  it('берёт топ-2 предложения с confidence >= 0.05', () => {
    expect(decideAutoApplyGenres(suggestions)).toEqual(['TECHNO', 'HOUSE']);
  });

  it('отфильтровывает предложения ниже порога confidence', () => {
    const lowConfidence: GenreSuggestion[] = [
      { genre: 'TECHNO', confidence: 0.04 },
      { genre: 'HOUSE', confidence: 0.02 },
    ];
    expect(decideAutoApplyGenres(lowConfidence)).toEqual([]);
  });

  it('никогда не берёт больше 2 жанров, даже если прошло больше порог', () => {
    const many: GenreSuggestion[] = [
      { genre: 'TECHNO', confidence: 0.4 },
      { genre: 'HOUSE', confidence: 0.3 },
      { genre: 'TRANCE', confidence: 0.2 },
    ];
    expect(decideAutoApplyGenres(many)).toEqual(['TECHNO', 'HOUSE']);
  });

  it('пустые предложения — пустой результат', () => {
    expect(decideAutoApplyGenres([])).toEqual([]);
  });
});
