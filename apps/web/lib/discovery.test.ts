import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DiscoveryCandidate } from '@vire/core';

const { getDiscoveryCandidates, getSimilarArtists } = vi.hoisted(() => ({
  getDiscoveryCandidates: vi.fn(),
  getSimilarArtists: vi.fn(),
}));

vi.mock('@vire/db', () => ({ getDiscoveryCandidates, getSimilarArtists }));

import { buildDiscovery, buildSimilarArtists, DISCOVERY_LIMIT, SIMILAR_ARTISTS_LIMIT } from './discovery';

function candidate(overrides: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate {
  return {
    artistProfileId: 'artist-1',
    artistSlug: 'artist-1',
    artistName: 'Artist One',
    artistAvatarUrl: null,
    verified: false,
    coListen: 0,
    tasteOverlap: 0,
    friendListeners: 0,
    sourceArtistId: 'artist-1',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildDiscovery', () => {
  it('returns an empty list without crashing when there are no candidates', async () => {
    getDiscoveryCandidates.mockResolvedValue([]);
    const result = await buildDiscovery('user-1');
    expect(result).toEqual([]);
  });

  it('ranks candidates by weighted score and respects the default limit', async () => {
    const candidates = [
      candidate({ artistProfileId: 'a1', sourceArtistId: 's1', coListen: 0.9 }),
      candidate({ artistProfileId: 'a2', sourceArtistId: 's2', friendListeners: 3 }),
      candidate({ artistProfileId: 'a3', sourceArtistId: 's3', tasteOverlap: 0.5 }),
    ];
    getDiscoveryCandidates.mockResolvedValue(candidates);

    const result = await buildDiscovery('user-1');

    expect(getDiscoveryCandidates).toHaveBeenCalledWith('user-1', expect.any(Number));
    expect(result).toHaveLength(3);
    // friendListeners=3 saturates friendSignal at weight 0.20, beats a bare coListen*0.45=0.405? no:
    // a1 coListen 0.9*0.45=0.405, a2 friendSignal 1*0.20=0.20 -> a1 first
    expect(result[0]!.artistProfileId).toBe('a1');
    expect(result.every((item) => typeof item.score === 'number')).toBe(true);
  });

  it('truncates to the requested limit', async () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      candidate({ artistProfileId: `a${i}`, sourceArtistId: `s${i}`, coListen: 1 - i * 0.01 }));
    getDiscoveryCandidates.mockResolvedValue(candidates);

    const result = await buildDiscovery('user-1', 5);

    expect(result).toHaveLength(5);
  });

  it('defaults to DISCOVERY_LIMIT', async () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      candidate({ artistProfileId: `a${i}`, sourceArtistId: `s${i}`, coListen: 1 - i * 0.01 }));
    getDiscoveryCandidates.mockResolvedValue(candidates);

    const result = await buildDiscovery('user-1');

    expect(result).toHaveLength(DISCOVERY_LIMIT);
  });
});

describe('buildSimilarArtists', () => {
  it('returns an empty list without crashing when there are no candidates', async () => {
    getSimilarArtists.mockResolvedValue([]);
    const result = await buildSimilarArtists('artist-1');
    expect(result).toEqual([]);
  });

  it('does not collapse to a single card even though every candidate shares one sourceArtistId', async () => {
    const candidates = Array.from({ length: 6 }, (_, i) =>
      candidate({ artistProfileId: `a${i}`, sourceArtistId: 'artist-1', coListen: 1 - i * 0.1 }));
    getSimilarArtists.mockResolvedValue(candidates);

    const result = await buildSimilarArtists('artist-1');

    expect(result).toHaveLength(6);
  });

  it('defaults to SIMILAR_ARTISTS_LIMIT', async () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      candidate({ artistProfileId: `a${i}`, sourceArtistId: 'artist-1', coListen: 1 - i * 0.01 }));
    getSimilarArtists.mockResolvedValue(candidates);

    const result = await buildSimilarArtists('artist-1');

    expect(result).toHaveLength(SIMILAR_ARTISTS_LIMIT);
  });
});
