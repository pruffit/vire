import { describe, it, expect } from 'vitest';
import { ALL_GENRES as CORE_GENRES } from '@vire/core';
import { ALL_GENRES, GENRE_GROUPS, GENRE_LABELS } from '../genres';

describe('genres (web) — зеркало @vire/core', () => {
  it('состав жанров совпадает с ALL_GENRES из core', () => {
    expect(new Set(ALL_GENRES)).toEqual(new Set(CORE_GENRES));
    expect(ALL_GENRES.length).toBe(CORE_GENRES.length);
  });

  it('GENRE_GROUPS — разбиение: каждый жанр ровно в одной группе', () => {
    const flat = GENRE_GROUPS.flatMap((g) => g.genres);
    expect(new Set(flat).size).toBe(flat.length);
    expect(ALL_GENRES).toEqual(flat);
  });

  it('у каждой группы непустой лейбл и непустой список жанров', () => {
    for (const group of GENRE_GROUPS) {
      expect(group.label.trim().length).toBeGreaterThan(0);
      expect(group.genres.length).toBeGreaterThan(0);
    }
  });

  it('GENRE_LABELS покрывает все жанры непустыми подписями', () => {
    for (const genre of CORE_GENRES) {
      expect(GENRE_LABELS[genre]?.trim().length, genre).toBeGreaterThan(0);
    }
  });
});
