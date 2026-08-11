import { describe, it, expect, vi, beforeEach } from 'vitest';
import { releaseDetailResponseSchema } from '@vire/api-contracts';

const { findWithTracks } = vi.hoisted(() => ({ findWithTracks: vi.fn() }));

vi.mock('@vire/db', () => ({
  db: {},
  DrizzleReleaseRepository: class {
    findWithTracks = findWithTracks;
  },
}));

import { GET } from './route';

const RELEASE_ID = '1321eb20-c9e6-4d95-b4e7-7e6a08fc8cf9';
const ctx = { params: Promise.resolve({ releaseId: RELEASE_ID }) };
const req = () => new Request(`http://localhost/api/v1/releases/${RELEASE_ID}`);

const PAST = new Date(Date.now() - 86_400_000);
const FUTURE = new Date(Date.now() + 86_400_000);

function release(status: string, releaseDate: Date | null = null) {
  return {
    release: {
      id: RELEASE_ID,
      artistProfileId: 'a1',
      title: 'Secret',
      type: 'SINGLE',
      genre: null,
      coverUrl: null,
      releaseDate,
      status,
      description: null,
      linerNotes: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    },
    tracks: [{
      id: 't1',
      releaseId: RELEASE_ID,
      title: 'Leak',
      version: null,
      trackNumber: 1,
      durationSec: 180,
      status: 'READY',
      isExclusive: false,
      isWip: false,
      isExplicit: false,
      credits: [],
      lyrics: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    }],
  };
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/releases/[releaseId]', () => {
  it('404 when the release does not exist', async () => {
    findWithTracks.mockResolvedValue(null);
    expect((await GET(req(), ctx)).status).toBe(404);
  });

  it('отдаёт опубликованный релиз с треками', async () => {
    findWithTracks.mockResolvedValue(release('PUBLISHED'));
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ tracks: [{ id: 't1' }] });
    expect(releaseDetailResponseSchema.safeParse(body).success).toBe(true);
  });

  it('отдаёт SCHEDULED-релиз, дата которого уже наступила', async () => {
    findWithTracks.mockResolvedValue(release('SCHEDULED', PAST));
    expect((await GET(req(), ctx)).status).toBe(200);
  });

  // Регрессия: публичный роут утекал черновики/архив/непошедшие релизы вместе с трек-листом.
  it.each([
    ['DRAFT', null],
    ['ARCHIVED', null],
    ['SCHEDULED', FUTURE],
    ['SCHEDULED', null],
  ] as const)('404 для %s (releaseDate=%s), а не утечка трек-листа', async (status, date) => {
    findWithTracks.mockResolvedValue(release(status, date));
    const res = await GET(req(), ctx);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Release not found', code: 'release.notFound' });
  });
});
