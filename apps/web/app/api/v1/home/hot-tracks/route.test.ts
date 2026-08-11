import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hotTracksResponseSchema } from '@vire/api-contracts';

const { popularTracks } = vi.hoisted(() => ({ popularTracks: vi.fn() }));

vi.mock('@vire/db', () => ({
  db: {},
  DrizzleHomeBlocksRepository: class {
    popularTracks = popularTracks;
  },
}));

import { GET } from './route';

function makeTrack(overrides?: Record<string, unknown>) {
  return {
    id: 'track-1',
    title: 'Title',
    artistName: 'Artist',
    artistSlug: 'artist',
    releaseId: 'release-1',
    coverUrl: null,
    accentColor: null,
    isExplicit: false,
    plays: 10,
    version: null,
    feat: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  popularTracks.mockResolvedValue([]);
});

describe('GET /api/v1/home/hot-tracks', () => {
  it('200, empty response matches the contract', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = hotTracksResponseSchema.parse(body);
    expect(parsed.items).toEqual([]);
  });

  it('requests the 30-day/20-item chart window from the repository', async () => {
    await GET();
    expect(popularTracks).toHaveBeenCalledWith(30, 20);
  });

  it('response matches the contract with tracks present', async () => {
    popularTracks.mockResolvedValue([makeTrack()]);
    const res = await GET();
    const body = await res.json();
    const parsed = hotTracksResponseSchema.parse(body);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]!.id).toBe('track-1');
  });

  it('surfaces a 500 when the repository fails — no silent empty-block degradation over HTTP', async () => {
    popularTracks.mockRejectedValue(new Error('db down'));
    await expect(GET()).rejects.toThrow('db down');
  });
});
