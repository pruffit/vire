import { describe, expect, it } from 'vitest';
import { swapAdjacent } from '../reorder';

interface Item {
  id: string;
}

const list: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('swapAdjacent', () => {
  it('swaps with the next element', () => {
    const next = swapAdjacent(list, 'a', 1);
    expect(next.map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('swaps with the previous element', () => {
    const next = swapAdjacent(list, 'c', -1);
    expect(next.map((i) => i.id)).toEqual(['a', 'c', 'b']);
  });

  it('first element cannot move up — returns the same reference', () => {
    const next = swapAdjacent(list, 'a', -1);
    expect(next).toBe(list);
  });

  it('last element cannot move down — returns the same reference', () => {
    const next = swapAdjacent(list, 'c', 1);
    expect(next).toBe(list);
  });

  it('unknown id — returns the same reference', () => {
    const next = swapAdjacent(list, 'zzz', 1);
    expect(next).toBe(list);
  });

  it('empty list — returns the same reference', () => {
    const empty: Item[] = [];
    expect(swapAdjacent(empty, 'a', 1)).toBe(empty);
  });

  it('keeps untouched elements referentially stable', () => {
    const four: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const next = swapAdjacent(four, 'b', 1);
    expect(next[0]).toBe(four[0]);
    expect(next[1]).toBe(four[2]);
    expect(next[2]).toBe(four[1]);
    expect(next[3]).toBe(four[3]);
  });
});
