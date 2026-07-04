import { describe, it, expect } from 'vitest';
import { labelsMatchModel } from './genre-classifier.js';

// Регрессия: смещение порядка меток в сайдкар-JSON модели относительно
// захардкоженного DISCOGS_400_LABELS тихо даёт неверные жанры — сверка должна
// это ловить, а не только проверять длину.
describe('labelsMatchModel', () => {
  const expected = ['A', 'B', 'C'] as const;

  it('совпадает поэлементно и по длине — true', () => {
    expect(labelsMatchModel(['A', 'B', 'C'], expected)).toBe(true);
  });

  it('метки переставлены местами — false', () => {
    expect(labelsMatchModel(['B', 'A', 'C'], expected)).toBe(false);
  });

  it('другая длина (короче) — false', () => {
    expect(labelsMatchModel(['A', 'B'], expected)).toBe(false);
  });

  it('другая длина (длиннее) — false', () => {
    expect(labelsMatchModel(['A', 'B', 'C', 'D'], expected)).toBe(false);
  });

  it('не массив — false', () => {
    expect(labelsMatchModel({ classes: ['A', 'B', 'C'] }, expected)).toBe(false);
    expect(labelsMatchModel(undefined, expected)).toBe(false);
    expect(labelsMatchModel(null, expected)).toBe(false);
  });

  it('пустой ожидаемый список и пустой фактический — true', () => {
    expect(labelsMatchModel([], [])).toBe(true);
  });
});
