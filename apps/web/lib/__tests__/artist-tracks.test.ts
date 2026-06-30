import { describe, it, expect } from 'vitest';
import { topByPlays } from '../artist-tracks';

const t = (id: string, plays: number) => ({ id, plays });

describe('topByPlays', () => {
  it('сортирует по числу прослушиваний убыванию', () => {
    const out = topByPlays([t('a', 1), t('b', 9), t('c', 4)]);
    expect(out.map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('при равных plays сохраняет исходный порядок (стабильна)', () => {
    const out = topByPlays([t('a', 5), t('b', 5), t('c', 5)]);
    expect(out.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('limit ограничивает длину', () => {
    const out = topByPlays([t('a', 1), t('b', 2), t('c', 3)], 2);
    expect(out.map((x) => x.id)).toEqual(['c', 'b']);
  });

  it('не мутирует вход', () => {
    const input = [t('a', 1), t('b', 2)];
    topByPlays(input);
    expect(input.map((x) => x.id)).toEqual(['a', 'b']);
  });
});
