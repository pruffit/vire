import { describe, it, expect } from 'vitest';
import { getHeaderCovers } from './header-cover';

describe('getHeaderCovers', () => {
  it('своя обложка первой, обложки треков дозаполняют до 4 (дедуп)', () => {
    const playlist = {
      coverUrl: 'own.jpg',
      tracks: [
        { coverUrl: 'a.jpg' },
        { coverUrl: 'b.jpg' },
        { coverUrl: 'own.jpg' },
        { coverUrl: null },
      ],
    };
    expect(getHeaderCovers(playlist)).toEqual(['own.jpg', 'a.jpg', 'b.jpg']);
  });

  it('без своей обложки — обложки треков, дедуп', () => {
    const playlist = { coverUrl: null, tracks: [{ coverUrl: 'a.jpg' }, { coverUrl: 'a.jpg' }] };
    expect(getHeaderCovers(playlist)).toEqual(['a.jpg']);
  });

  it('без обложек вообще — пусто', () => {
    expect(getHeaderCovers({ coverUrl: null, tracks: [] })).toEqual([]);
  });
});
