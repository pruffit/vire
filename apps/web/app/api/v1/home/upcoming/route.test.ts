import { describe, it, expect, vi, beforeEach } from 'vitest';
import { upcomingResponseSchema } from '@vire/api-contracts';

const { upcomingReleases } = vi.hoisted(() => ({ upcomingReleases: vi.fn() }));

vi.mock('@vire/db', () => ({
  db: {},
  DrizzleHomeBlocksRepository: class {
    upcomingReleases = upcomingReleases;
  },
}));

import { GET } from './route';

function makeCard(overrides?: Record<string, unknown>) {
  return {
    id: 'release-1',
    title: 'Title',
    type: 'ALBUM',
    coverUrl: null,
    releaseDate: null,
    artistName: 'Artist',
    artistSlug: 'artist',
    artistAvatarUrl: null,
    hasExplicit: false,
    accentColor: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  upcomingReleases.mockResolvedValue([]);
});

describe('GET /api/v1/home/upcoming', () => {
  it('200, empty response matches the contract', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = upcomingResponseSchema.parse(body);
    expect(parsed.items).toEqual([]);
  });

  it('requests the upcoming limit of 8 from the repository', async () => {
    await GET();
    expect(upcomingReleases).toHaveBeenCalledWith(8);
  });

  it('maps releaseDate to an ISO string in the response', async () => {
    upcomingReleases.mockResolvedValue([makeCard({ releaseDate: new Date('2024-06-01T00:00:00.000Z') })]);
    const res = await GET();
    const body = await res.json();
    const parsed = upcomingResponseSchema.parse(body);
    expect(parsed.items[0]!.releaseDate).toBe('2024-06-01T00:00:00.000Z');
  });

  it('surfaces a 500 when the repository fails — no silent empty-block degradation over HTTP', async () => {
    upcomingReleases.mockRejectedValue(new Error('db down'));
    await expect(GET()).rejects.toThrow('db down');
  });
});
