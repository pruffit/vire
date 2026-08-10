import { describe, it, expect } from 'vitest';
import {
  recencyScore,
  popularityScore,
  affinityScore,
  feedReason,
  scoreFeedItem,
  composeFeed,
  RELEASE_HALF_LIFE_DAYS,
} from './feed-ranking';
import type { FeedCandidate, RankedFeedItem } from '../types/feed';
import type { TasteProfile } from '../../playback/types/wave';

const NOW = new Date('2026-07-28T12:00:00Z').getTime();

function candidate(overrides: Partial<FeedCandidate> = {}): FeedCandidate {
  return {
    kind: 'RELEASE',
    id: 'r1',
    artistProfileId: 'artist-1',
    artistSlug: 'artist-1',
    artistName: 'Artist One',
    artistAvatarUrl: null,
    occurredAt: new Date(NOW),
    isFollowed: false,
    genres: [],
    moods: [],
    plays30d: 0,
    title: 'Title',
    coverUrl: null,
    hasExplicit: false,
    releaseType: 'ALBUM',
    body: null,
    ...overrides,
  };
}

function ranked(overrides: Partial<RankedFeedItem> = {}): RankedFeedItem {
  return { ...candidate(), score: 0, reason: 'fresh', ...overrides };
}

const NO_TASTE: TasteProfile | null = null;
const EMPTY_FOLLOWS = new Set<string>();

describe('recencyScore', () => {
  it('decreases monotonically as age grows', () => {
    const scores = [0, 1, 3, 7, 14, 30].map((d) => recencyScore(d, RELEASE_HALF_LIFE_DAYS));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThan(scores[i - 1]!);
    }
  });

  it('is 1 at age 0 and clamps negative age to 0', () => {
    expect(recencyScore(0, 7)).toBe(1);
    expect(recencyScore(-5, 7)).toBe(1);
  });
});

describe('popularityScore', () => {
  it('saturates: 100x more plays is nowhere near 100x the score', () => {
    const low = popularityScore(10);
    const high = popularityScore(1000);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThan(low * 100);
  });

  it('is 0 for no plays and increases monotonically', () => {
    expect(popularityScore(0)).toBe(0);
    expect(popularityScore(10)).toBeGreaterThan(popularityScore(0));
    expect(popularityScore(50)).toBeGreaterThan(popularityScore(10));
  });

  it('never exceeds 1', () => {
    expect(popularityScore(1_000_000)).toBeLessThan(1);
  });
});

describe('affinityScore', () => {
  it('takes the max signal, not the sum: follow + taste match still caps at 1.0', () => {
    const c = candidate({ isFollowed: true, genres: ['ROCK'] });
    const taste: TasteProfile = { topArtistIds: ['artist-1'], topGenres: ['ROCK'], topMoods: [] };
    expect(affinityScore(c, taste, new Set(['artist-1']))).toBe(1.0);
  });

  it('follow beats taste-artist beats genre/mood beats nothing', () => {
    const followed = candidate({ isFollowed: true });
    const tasteArtist = candidate({ artistProfileId: 'artist-2' });
    const genreMatch = candidate({ artistProfileId: 'artist-3', genres: ['ROCK'] });
    const nothing = candidate({ artistProfileId: 'artist-4' });
    const taste: TasteProfile = { topArtistIds: ['artist-2'], topGenres: ['ROCK'], topMoods: [] };

    expect(affinityScore(followed, taste, EMPTY_FOLLOWS)).toBe(1.0);
    expect(affinityScore(tasteArtist, taste, EMPTY_FOLLOWS)).toBe(0.7);
    expect(affinityScore(genreMatch, taste, EMPTY_FOLLOWS)).toBe(0.5);
    expect(affinityScore(nothing, taste, EMPTY_FOLLOWS)).toBe(0.25);
  });

  it('mood match alone scores like genre match', () => {
    const c = candidate({ artistProfileId: 'artist-5', moods: ['CHILL'] });
    const taste: TasteProfile = { topArtistIds: [], topGenres: [], topMoods: ['CHILL'] };
    expect(affinityScore(c, taste, EMPTY_FOLLOWS)).toBe(0.5);
  });

  it('falls back to 0.25 with no taste profile at all', () => {
    expect(affinityScore(candidate(), NO_TASTE, EMPTY_FOLLOWS)).toBe(0.25);
  });
});

describe('feedReason', () => {
  it('mirrors the same priority order as affinityScore', () => {
    const taste: TasteProfile = { topArtistIds: ['artist-2'], topGenres: ['ROCK'], topMoods: [] };
    expect(feedReason(candidate({ isFollowed: true }), taste, EMPTY_FOLLOWS)).toBe('follow');
    expect(feedReason(candidate({ artistProfileId: 'artist-2' }), taste, EMPTY_FOLLOWS)).toBe('taste');
    expect(feedReason(candidate({ artistProfileId: 'artist-3', genres: ['ROCK'] }), taste, EMPTY_FOLLOWS)).toBe('taste');
    expect(feedReason(candidate({ artistProfileId: 'artist-4' }), taste, EMPTY_FOLLOWS)).toBe('fresh');
  });
});

describe('scoreFeedItem', () => {
  it('gives an upcoming release a positive kindBonus and a released one none', () => {
    const upcoming = scoreFeedItem(candidate({ kind: 'UPCOMING', occurredAt: new Date(NOW) }), {
      now: NOW, taste: NO_TASTE, followedArtistIds: EMPTY_FOLLOWS,
    });
    const release = scoreFeedItem(candidate({ kind: 'RELEASE' }), {
      now: NOW, taste: NO_TASTE, followedArtistIds: EMPTY_FOLLOWS,
    });
    expect(upcoming.score).toBeGreaterThan(0);
    // тот же ageDays=0 у обоих, единственная разница — kindBonus у UPCOMING
    expect(upcoming.score).toBeGreaterThan(release.score);
  });

  it('scores an upcoming release higher the closer it gets', () => {
    const ctx = { now: NOW, taste: NO_TASTE, followedArtistIds: EMPTY_FOLLOWS };
    const soon = scoreFeedItem(candidate({ kind: 'UPCOMING', occurredAt: new Date(NOW + 1 * 86_400_000) }), ctx);
    const later = scoreFeedItem(candidate({ kind: 'UPCOMING', occurredAt: new Date(NOW + 20 * 86_400_000) }), ctx);
    expect(soon.score).toBeGreaterThan(later.score);
  });

  it('attaches the reason alongside the score', () => {
    const item = scoreFeedItem(candidate({ isFollowed: true }), { now: NOW, taste: NO_TASTE, followedArtistIds: EMPTY_FOLLOWS });
    expect(item.reason).toBe('follow');
    expect(item.score).toBeGreaterThan(0);
  });
});

describe('composeFeed', () => {
  it('returns empty output for empty input', () => {
    expect(composeFeed([])).toEqual([]);
  });

  it('caps items per artist at maxPerArtist', () => {
    const items: RankedFeedItem[] = Array.from({ length: 5 }, (_, i) =>
      ranked({ id: `r${i}`, artistProfileId: 'artist-1', score: 1 - i * 0.01 }));

    const out = composeFeed(items, { limit: 24, maxPerArtist: 2, smallArtistShare: 0 });

    expect(out).toHaveLength(2);
    expect(out.every((item) => item.artistProfileId === 'artist-1')).toBe(true);
  });

  it('dedupes by kind+id, keeping the higher score', () => {
    const items: RankedFeedItem[] = [
      ranked({ id: 'r1', artistProfileId: 'a', score: 0.3 }),
      ranked({ id: 'r1', artistProfileId: 'a', score: 0.9 }),
    ];
    const out = composeFeed(items, { limit: 24, maxPerArtist: 2, smallArtistShare: 0 });
    expect(out).toHaveLength(1);
    expect(out[0]!.score).toBe(0.9);
  });

  it('reserves at least smallArtistShare of slots for below-median artists when they exist', () => {
    // 8 больших (plays30d=1000, счётом 1 попадание на артиста) забивают score,
    // 4 малых (plays30d=1) — под медианой, каждый должен пробиться квотой.
    const big: RankedFeedItem[] = Array.from({ length: 8 }, (_, i) =>
      ranked({ id: `big${i}`, artistProfileId: `big-artist-${i}`, plays30d: 1000, score: 0.9 - i * 0.01 }));
    const small: RankedFeedItem[] = Array.from({ length: 4 }, (_, i) =>
      ranked({ id: `small${i}`, artistProfileId: `small-artist-${i}`, plays30d: 1, score: 0.1 - i * 0.01 }));

    const out = composeFeed([...big, ...small], { limit: 10, maxPerArtist: 2, smallArtistShare: 0.3 });

    const smallInOut = out.filter((item) => item.plays30d === 1);
    expect(smallInOut.length).toBeGreaterThanOrEqual(3); // ceil(10 * 0.3)
  });

  it('does not break when no candidate is below the median (no small-artist quota applies)', () => {
    const items: RankedFeedItem[] = Array.from({ length: 5 }, (_, i) =>
      ranked({ id: `r${i}`, artistProfileId: `artist-${i}`, plays30d: 500, score: 1 - i * 0.1 }));

    const out = composeFeed(items, { limit: 24, maxPerArtist: 2, smallArtistShare: 0.3 });

    expect(out).toHaveLength(5);
  });

  it('sorts the final output by score descending', () => {
    const items: RankedFeedItem[] = [
      ranked({ id: 'r1', artistProfileId: 'a1', score: 0.2 }),
      ranked({ id: 'r2', artistProfileId: 'a2', score: 0.8 }),
      ranked({ id: 'r3', artistProfileId: 'a3', score: 0.5 }),
    ];
    const out = composeFeed(items, { limit: 24, maxPerArtist: 2, smallArtistShare: 0 });
    expect(out.map((item) => item.id)).toEqual(['r2', 'r3', 'r1']);
  });

  it('truncates to limit', () => {
    const items: RankedFeedItem[] = Array.from({ length: 30 }, (_, i) =>
      ranked({ id: `r${i}`, artistProfileId: `artist-${i}`, score: 1 - i * 0.01 }));
    const out = composeFeed(items, { limit: 12, maxPerArtist: 2, smallArtistShare: 0.3 });
    expect(out).toHaveLength(12);
  });
});
