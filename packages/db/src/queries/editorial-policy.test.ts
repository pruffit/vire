import { describe, it, expect } from 'vitest';
import {
  MIN_PERSONAL_PLAYLIST_TRACKS,
  PLAYLIST_LIST_LIMIT,
  hasEnoughTracksForPersonalPlaylist,
  pickPersonalMoods,
  fillToLimit,
} from './editorial-policy';
import type { Mood } from './track-moods';

describe('hasEnoughTracksForPersonalPlaylist', () => {
  it('rejects counts below the threshold', () => {
    expect(hasEnoughTracksForPersonalPlaylist(0)).toBe(false);
    expect(hasEnoughTracksForPersonalPlaylist(MIN_PERSONAL_PLAYLIST_TRACKS - 1)).toBe(false);
  });

  it('accepts counts at or above the threshold', () => {
    expect(hasEnoughTracksForPersonalPlaylist(MIN_PERSONAL_PLAYLIST_TRACKS)).toBe(true);
    expect(hasEnoughTracksForPersonalPlaylist(MIN_PERSONAL_PLAYLIST_TRACKS + 10)).toBe(true);
  });
});

describe('pickPersonalMoods', () => {
  it('returns the top taste moods in order when nothing is excluded', () => {
    const taste: Mood[] = ['DRIVE', 'CHILL', 'HYPE'];
    expect(pickPersonalMoods(taste, [], 3)).toEqual(['DRIVE', 'CHILL', 'HYPE']);
  });

  it('skips moods already covered by shared playlists', () => {
    const taste: Mood[] = ['DRIVE', 'CHILL', 'HYPE'];
    expect(pickPersonalMoods(taste, ['DRIVE'], 3)).toEqual(['CHILL', 'HYPE']);
  });

  it('stops once count is reached, preserving taste order', () => {
    const taste: Mood[] = ['DRIVE', 'CHILL', 'HYPE', 'SAD'];
    expect(pickPersonalMoods(taste, [], 2)).toEqual(['DRIVE', 'CHILL']);
  });

  it('combines exclusion and count together', () => {
    const taste: Mood[] = ['DRIVE', 'CHILL', 'HYPE', 'SAD'];
    expect(pickPersonalMoods(taste, ['DRIVE', 'HYPE'], 2)).toEqual(['CHILL', 'SAD']);
  });

  it('returns an empty array when count is zero or negative', () => {
    const taste: Mood[] = ['DRIVE', 'CHILL'];
    expect(pickPersonalMoods(taste, [], 0)).toEqual([]);
    expect(pickPersonalMoods(taste, [], -1)).toEqual([]);
  });

  it('returns an empty array when taste has no moods', () => {
    expect(pickPersonalMoods([], [], 5)).toEqual([]);
  });

  it('returns fewer than count when excluding leaves too few candidates', () => {
    const taste: Mood[] = ['DRIVE', 'CHILL'];
    expect(pickPersonalMoods(taste, ['DRIVE', 'CHILL'], 5)).toEqual([]);
  });
});

describe('fillToLimit', () => {
  const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

  it('keeps genuine matches first and fills the tail from the pool', () => {
    const genuine = ids('g', 3);
    const pool = ids('p', 10);
    const out = fillToLimit(genuine, pool, new Set(), 6);
    expect(out).toEqual(['g0', 'g1', 'g2', 'p0', 'p1', 'p2']);
  });

  it('does not duplicate genuine tracks that are also in the pool', () => {
    const out = fillToLimit(['a', 'b'], ['b', 'a', 'c', 'd'], new Set(), 4);
    expect(out).toEqual(['a', 'b', 'c', 'd']);
  });

  it('prefers tracks outside avoid, reusing avoided ones only when the pool runs dry', () => {
    const out = fillToLimit(['g'], ['u1', 'u2', 'f1', 'f2'], new Set(['u1', 'u2']), 4);
    expect(out).toEqual(['g', 'f1', 'f2', 'u1']);
  });

  it('returns fewer than limit only when the whole pool is smaller than the limit', () => {
    const out = fillToLimit(['g'], ['p0', 'p1'], new Set(['p0', 'p1']), 5);
    expect(out).toEqual(['g', 'p0', 'p1']);
  });

  it('truncates genuine matches above the limit', () => {
    const out = fillToLimit(ids('g', 10), ids('p', 10), new Set(), 4);
    expect(out).toEqual(['g0', 'g1', 'g2', 'g3']);
  });

  it('defaults to the playlist list limit', () => {
    const out = fillToLimit([], ids('p', PLAYLIST_LIST_LIMIT + 10));
    expect(out).toHaveLength(PLAYLIST_LIST_LIMIT);
  });
});
