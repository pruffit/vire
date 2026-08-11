import { describe, it, expect, vi } from 'vitest';
import { FeedService, FEED_COLD_START_THRESHOLD, FEED_LIMIT } from './feed';
import type { IFeedRepository } from '../repositories/feed';
import type { FeedCandidate } from '../types/feed';

const NOW = Date.parse('2026-01-01T00:00:00Z');
const NO_TASTE = { topArtistIds: [], topGenres: [], topMoods: [] };

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

function makeRepo(overrides?: Partial<IFeedRepository>): IFeedRepository {
  return {
    candidates: vi.fn().mockResolvedValue([]),
    freshCandidates: vi.fn().mockResolvedValue([]),
    taste: vi.fn().mockResolvedValue(NO_TASTE),
    ...overrides,
  };
}

function service(repo: IFeedRepository) {
  return new FeedService(repo, () => NOW);
}

describe('FeedService.getFeed', () => {
  it('returns an empty list without crashing when there are no candidates and no fresh fallback', async () => {
    const repo = makeRepo();
    const result = await service(repo).getFeed({ userId: 'user-1' });
    expect(result).toEqual([]);
  });

  it('ranks and composes candidates without touching the fresh fallback when composition already clears the threshold', async () => {
    const candidates = Array.from({ length: FEED_COLD_START_THRESHOLD }, (_, i) =>
      candidate({ id: `r${i}`, artistProfileId: `artist-${i}`, isFollowed: true }));
    const repo = makeRepo({ candidates: vi.fn().mockResolvedValue(candidates) });

    const result = await service(repo).getFeed({ userId: 'user-1' });

    expect(result).toHaveLength(FEED_COLD_START_THRESHOLD);
    expect(repo.freshCandidates).not.toHaveBeenCalled();
    expect(result.every((item) => item.reason === 'follow')).toBe(true);
  });

  it('tops off with fresh releases, tagged reason=fresh, when composition lands below the cold-start threshold', async () => {
    const repo = makeRepo({
      candidates: vi.fn().mockResolvedValue([candidate({ id: 'r1', isFollowed: true })]),
      freshCandidates: vi.fn().mockResolvedValue([
        candidate({ id: 'fresh-1', artistProfileId: 'artist-fresh-1' }),
        candidate({ id: 'fresh-2', artistProfileId: 'artist-fresh-2' }),
      ]),
    });

    const result = await service(repo).getFeed({ userId: 'user-1' });

    expect(result).toHaveLength(3);
    const fresh = result.filter((item) => item.id.startsWith('fresh-'));
    expect(fresh).toHaveLength(2);
    expect(fresh.every((item) => item.reason === 'fresh')).toBe(true);
    expect(repo.freshCandidates).toHaveBeenCalledWith(['r1'], FEED_LIMIT - 1);
  });

  it('does not lose already-composed items when the fresh fallback query itself fails', async () => {
    const repo = makeRepo({
      candidates: vi.fn().mockResolvedValue([candidate({ id: 'r1', isFollowed: true })]),
      freshCandidates: vi.fn().mockRejectedValue(new Error('db down')),
    });

    const result = await service(repo).getFeed({ userId: 'user-1' });

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('r1');
  });

  it('does not call the fresh fallback when the requested limit is already met', async () => {
    const candidates = Array.from({ length: 3 }, (_, i) =>
      candidate({ id: `r${i}`, artistProfileId: `artist-${i}`, isFollowed: true }));
    const repo = makeRepo({ candidates: vi.fn().mockResolvedValue(candidates) });

    const result = await service(repo).getFeed({ userId: 'user-1', limit: 3 });

    expect(result).toHaveLength(3);
    expect(repo.freshCandidates).not.toHaveBeenCalled();
  });
});
