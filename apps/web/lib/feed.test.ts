import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FeedCandidate } from '@vire/core';

const { getFeedCandidates, getFreshFeedCandidates, getTasteProfile } = vi.hoisted(() => ({
  getFeedCandidates: vi.fn(),
  getFreshFeedCandidates: vi.fn(),
  getTasteProfile: vi.fn(),
}));

vi.mock('@vire/db', () => ({ getFeedCandidates, getFreshFeedCandidates, getTasteProfile }));

import { buildFeed, FEED_COLD_START_THRESHOLD, FEED_LIMIT } from './feed';

const NO_TASTE = { topArtistIds: [], topGenres: [], topMoods: [] };

function candidate(overrides: Partial<FeedCandidate> = {}): FeedCandidate {
  return {
    kind: 'RELEASE',
    id: 'r1',
    artistProfileId: 'artist-1',
    artistSlug: 'artist-1',
    artistName: 'Artist One',
    artistAvatarUrl: null,
    occurredAt: new Date(),
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

beforeEach(() => {
  vi.clearAllMocks();
  getTasteProfile.mockResolvedValue(NO_TASTE);
  getFreshFeedCandidates.mockResolvedValue([]);
});

describe('buildFeed', () => {
  it('returns an empty list without crashing when there are no candidates and no fresh fallback', async () => {
    getFeedCandidates.mockResolvedValue([]);
    const result = await buildFeed('user-1');
    expect(result).toEqual([]);
  });

  it('ranks and composes candidates without touching the fresh fallback when composition already clears the threshold', async () => {
    const candidates = Array.from({ length: FEED_COLD_START_THRESHOLD }, (_, i) =>
      candidate({ id: `r${i}`, artistProfileId: `artist-${i}`, isFollowed: true }));
    getFeedCandidates.mockResolvedValue(candidates);

    const result = await buildFeed('user-1');

    expect(result).toHaveLength(FEED_COLD_START_THRESHOLD);
    expect(getFreshFeedCandidates).not.toHaveBeenCalled();
    expect(result.every((item) => item.reason === 'follow')).toBe(true);
  });

  it('tops off with fresh releases, tagged reason=fresh, when composition lands below the cold-start threshold', async () => {
    getFeedCandidates.mockResolvedValue([candidate({ id: 'r1', isFollowed: true })]);
    getFreshFeedCandidates.mockResolvedValue([
      candidate({ id: 'fresh-1', artistProfileId: 'artist-fresh-1' }),
      candidate({ id: 'fresh-2', artistProfileId: 'artist-fresh-2' }),
    ]);

    const result = await buildFeed('user-1');

    expect(result).toHaveLength(3);
    const fresh = result.filter((item) => item.id.startsWith('fresh-'));
    expect(fresh).toHaveLength(2);
    expect(fresh.every((item) => item.reason === 'fresh')).toBe(true);
    expect(getFreshFeedCandidates).toHaveBeenCalledWith(['r1'], FEED_LIMIT - 1);
  });

  it('does not lose already-composed items when the fresh fallback query itself fails', async () => {
    getFeedCandidates.mockResolvedValue([candidate({ id: 'r1', isFollowed: true })]);
    getFreshFeedCandidates.mockRejectedValue(new Error('db down'));

    const result = await buildFeed('user-1');

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('r1');
  });

  it('does not call the fresh fallback when the requested limit is already met', async () => {
    const candidates = Array.from({ length: 3 }, (_, i) =>
      candidate({ id: `r${i}`, artistProfileId: `artist-${i}`, isFollowed: true }));
    getFeedCandidates.mockResolvedValue(candidates);

    const result = await buildFeed('user-1', 3);

    expect(result).toHaveLength(3);
    expect(getFreshFeedCandidates).not.toHaveBeenCalled();
  });
});
