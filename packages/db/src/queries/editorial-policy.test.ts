import { describe, it, expect } from 'vitest';
import {
  MIN_PERSONAL_PLAYLIST_TRACKS,
  hasEnoughTracksForPersonalPlaylist,
  pickPersonalMoods,
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
