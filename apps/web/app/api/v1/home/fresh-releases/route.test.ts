import { describe, it, expect, vi, beforeEach } from 'vitest';
import { freshReleasesResponseSchema } from '@vire/api-contracts';

const { latestReleases, freshReleases } = vi.hoisted(() => ({
  latestReleases: vi.fn(),
  freshReleases: vi.fn(),
}));

vi.mock('@vire/db', () => ({
  db: {},
  DrizzleHomeBlocksRepository: class {
    latestReleases = latestReleases;
    freshReleases = freshReleases;
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
  latestReleases.mockResolvedValue([]);
  freshReleases.mockResolvedValue([]);
});

describe('GET /api/v1/home/fresh-releases', () => {
  it('200, empty response matches the contract', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = freshReleasesResponseSchema.parse(body);
    expect(parsed.items).toEqual([]);
  });

  it('excludes the featured release (first of latest) from the result, per the block composition rule', async () => {
    const featured = makeCard({ id: 'featured' });
    const rest = makeCard({ id: 'rest-1' });
    latestReleases.mockResolvedValue([featured, rest]);
    // week пуста (< 4) — состав добирается хвостом latest, featured остаётся исключённым
    freshReleases.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();
    const parsed = freshReleasesResponseSchema.parse(body);

    expect(parsed.items.map((r) => r.id)).toEqual(['rest-1']);
  });

  it('maps releaseDate to an ISO string in the response', async () => {
    const featured = makeCard({ id: 'featured' });
    latestReleases.mockResolvedValue([featured, makeCard({ id: 'dated', releaseDate: new Date('2024-01-01T00:00:00.000Z') })]);
    freshReleases.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();
    const parsed = freshReleasesResponseSchema.parse(body);
    expect(parsed.items[0]!.releaseDate).toBe('2024-01-01T00:00:00.000Z');
  });

  it('surfaces a 500 when the repository fails — no silent empty-block degradation over HTTP', async () => {
    freshReleases.mockRejectedValue(new Error('db down'));
    await expect(GET()).rejects.toThrow('db down');
  });
});
