import { describe, it, expect } from 'vitest';
import { ALL_GENRES } from '@vire/core';
import { genreEnum } from './schema/releases';
import { GENRE_FAMILY, expandGenresToFamilies } from './genre-families';

// Импортируем схему и семейства напрямую (не через корень пакета), чтобы тест
// не тянул client.ts и не требовал DATABASE_URL.

describe('зеркало genreEnum (db) == ALL_GENRES (core)', () => {
  it('совпадает по составу и порядку', () => {
    expect([...genreEnum.enumValues]).toEqual([...ALL_GENRES]);
  });

  it('не содержит дублей', () => {
    expect(new Set(genreEnum.enumValues).size).toBe(genreEnum.enumValues.length);
  });
});

describe('GENRE_FAMILY', () => {
  it('каждому жанру enum назначено семейство', () => {
    for (const genre of genreEnum.enumValues) {
      expect(GENRE_FAMILY[genre], genre).toBeTruthy();
    }
  });
});

describe('expandGenresToFamilies', () => {
  it('расширяет жанр до всех жанров его семейства', () => {
    const expanded = expandGenresToFamilies(['DEEP_HOUSE']);
    expect(expanded).toContain('HOUSE');
    expect(expanded).toContain('TECH_HOUSE');
    expect(expanded).not.toContain('TECHNO');
  });

  it('объединяет семейства нескольких жанров без дублей, порядок — как в enum', () => {
    const expanded = expandGenresToFamilies(['TECHNO', 'MINIMAL_TECHNO', 'REGGAE']);
    expect(new Set(expanded).size).toBe(expanded.length);
    const inEnumOrder = genreEnum.enumValues.filter((g) => expanded.includes(g));
    expect(expanded).toEqual(inEnumOrder);
    expect(expanded).toContain('DUB');
    expect(expanded).toContain('SCHRANZ');
    expect(expanded).not.toContain('HOUSE');
  });

  it('пустой вход — пустой результат', () => {
    expect(expandGenresToFamilies([])).toEqual([]);
  });
});
