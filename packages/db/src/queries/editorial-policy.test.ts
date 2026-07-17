import { describe, it, expect } from 'vitest';
import {
  MIN_PERSONAL_PLAYLIST_TRACKS,
  PLAYLIST_LIST_LIMIT,
  hasEnoughTracksForPersonalPlaylist,
  pickPersonalMoods,
  composePlaylist,
  MAX_PER_ARTIST,
  type PlaylistCandidate,
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

describe('composePlaylist', () => {
  const c = (trackId: string, artistId: string): PlaylistCandidate => ({ trackId, artistId });
  const many = (prefix: string, artistId: string, n: number) =>
    Array.from({ length: n }, (_, i) => c(`${prefix}${i}`, artistId));

  it('caps an artist in the head, deferring overflow after other artists but before filler', () => {
    const genuine = [...many('a', 'A', 5), c('b0', 'B'), c('c0', 'C')];
    const pool = many('p', 'P', 10);
    const out = composePlaylist(genuine, pool, new Set(), 10);
    expect(out).toEqual(['a0', 'a1', 'a2', 'b0', 'c0', 'a3', 'a4', 'p0', 'p1', 'p2']);
  });

  it('never evicts genuine in favour of filler', () => {
    const genuine = many('a', 'A', 6);
    const pool = many('p', 'P', 10);
    const out = composePlaylist(genuine, pool, new Set(), 6);
    expect(out).toEqual(['a0', 'a1', 'a2', 'a3', 'a4', 'a5']);
  });

  it('applies the cap to filler counting tracks already picked from genuine', () => {
    const genuine = [c('g0', 'A'), c('g1', 'A')];
    const pool = [c('p0', 'A'), c('p1', 'A'), c('p2', 'B')];
    const out = composePlaylist(genuine, pool, new Set(), 4);
    expect(out).toEqual(['g0', 'g1', 'p0', 'p2']);
  });

  it('relaxes the filler cap only when diverse pool candidates run out', () => {
    const genuine = [c('g0', 'A')];
    const pool = [c('p0', 'B'), c('p1', 'B'), c('p2', 'B'), c('p3', 'B'), c('p4', 'B')];
    const out = composePlaylist(genuine, pool, new Set(), 5);
    expect(out).toEqual(['g0', 'p0', 'p1', 'p2', 'p3']);
  });

  it('prefers unused pool candidates, reusing avoided ones only when the pool runs dry', () => {
    const genuine = [c('g0', 'G')];
    const pool = [c('u0', 'U'), c('u1', 'U2'), c('f0', 'F'), c('f1', 'F2')];
    const out = composePlaylist(genuine, pool, new Set(['u0', 'u1']), 4);
    expect(out).toEqual(['g0', 'f0', 'f1', 'u0']);
  });

  it('deduplicates genuine tracks that also appear in the pool', () => {
    const out = composePlaylist([c('a', 'A')], [c('a', 'A'), c('b', 'B')], new Set(), 2);
    expect(out).toEqual(['a', 'b']);
  });

  it('returns fewer than limit only when genuine plus pool are smaller than the limit', () => {
    const out = composePlaylist([c('g0', 'A')], [c('p0', 'B')], new Set(), 5);
    expect(out).toEqual(['g0', 'p0']);
  });

  it('defaults to the playlist list limit and the MAX_PER_ARTIST cap', () => {
    const pool = [...many('a', 'A', 10), ...many('b', 'B', 30)];
    const out = composePlaylist([], pool);
    expect(out).toHaveLength(PLAYLIST_LIST_LIMIT);
    expect(out.slice(0, 6)).toEqual(['a0', 'a1', 'a2', 'b0', 'b1', 'b2']);
    expect(MAX_PER_ARTIST).toBe(3);
  });
});
