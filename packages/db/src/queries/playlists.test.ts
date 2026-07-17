import { describe, it, expect, vi } from 'vitest';

vi.mock('../client', () => ({ db: {} }));

import { pickCovers } from './playlists';

describe('pickCovers', () => {
  it('puts the playlist own cover first', () => {
    expect(pickCovers('own.jpg', ['a.jpg', 'b.jpg'])).toEqual(['own.jpg', 'a.jpg', 'b.jpg']);
  });

  it('dedups the own cover against track covers', () => {
    expect(pickCovers('a.jpg', ['a.jpg', 'b.jpg'])).toEqual(['a.jpg', 'b.jpg']);
  });

  it('dedups repeated track covers', () => {
    expect(pickCovers(null, ['a.jpg', 'a.jpg', 'b.jpg'])).toEqual(['a.jpg', 'b.jpg']);
  });

  it('drops nulls from track covers', () => {
    expect(pickCovers(null, ['a.jpg', null, 'b.jpg', null])).toEqual(['a.jpg', 'b.jpg']);
  });

  it('caps the result at 4, own cover counted first', () => {
    expect(pickCovers('own.jpg', ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'])).toEqual([
      'own.jpg', 'a.jpg', 'b.jpg', 'c.jpg',
    ]);
  });

  it('caps at 4 without an own cover', () => {
    expect(pickCovers(null, ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg'])).toEqual([
      'a.jpg', 'b.jpg', 'c.jpg', 'd.jpg',
    ]);
  });

  it('returns empty on empty input', () => {
    expect(pickCovers(null, [])).toEqual([]);
  });

  it('returns just the own cover when there are no track covers', () => {
    expect(pickCovers('own.jpg', [])).toEqual(['own.jpg']);
  });

  it('stops scanning once 4 uniques are found — does not walk a full track list', () => {
    const trap = new Proxy(Array.from({ length: 500 }, (_, i) => `${i}.jpg`), {
      get(target, prop, receiver) {
        if (typeof prop === 'string' && /^\d+$/.test(prop) && Number(prop) >= 4) {
          throw new Error(`scanned past index ${prop}`);
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    expect(() => pickCovers(null, trap as unknown as (string | null)[])).not.toThrow();
  });
});
