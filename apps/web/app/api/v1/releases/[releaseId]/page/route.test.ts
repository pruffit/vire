import { describe, it, expect, vi, beforeEach } from 'vitest';
import { releasePageResponseSchema } from '@vire/api-contracts';

const { getPage } = vi.hoisted(() => ({ getPage: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleReleaseReadRepository: class {},
}));
vi.mock('@vire/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vire/core')>();
  return {
    ...actual,
    ReleasePageService: class {
      getPage = getPage;
    },
  };
});

import { auth } from '@/auth';
import { NotFoundError } from '@vire/core';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);
const ctx = (releaseId: string) => ({ params: Promise.resolve({ releaseId }) });
const req = () => new Request('http://localhost/api/v1/releases/release-1/page');

const mockArtist = {
  id: 'artist-1',
  userId: 'user-1',
  slug: 'danya',
  name: 'Danya',
  bio: null,
  avatarUrl: null,
  headerUrl: null,
  themeTokens: { bg: '#000', text: '#fff', accent: '#123', grain: true, fontSans: 'Inter', fontMono: 'Mono' },
  links: [],
  videos: [],
  verified: false,
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
};

const mockRelease = {
  id: 'release-1',
  artistProfileId: 'artist-1',
  title: 'Test Release',
  type: 'ALBUM' as const,
  genre: null,
  coverUrl: null,
  releaseDate: null,
  status: 'PUBLISHED' as const,
  description: null,
  linerNotes: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

const mockTrack = {
  id: 'track-1',
  releaseId: 'release-1',
  title: 'Track One',
  version: null,
  trackNumber: 1,
  durationSec: 180,
  status: 'READY' as const,
  isExclusive: false,
  isWip: false,
  isExplicit: false,
  credits: [],
  lyrics: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

const mockView = {
  artist: mockArtist,
  release: mockRelease,
  tracks: [mockTrack],
  isReleased: true,
  showCountdown: false,
  presaved: false,
};

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/releases/[releaseId]/page', () => {
  it('404 when the release is hidden (DRAFT/ARCHIVED/SCHEDULED without a date, or missing)', async () => {
    mockedAuth.mockResolvedValue(null as never);
    getPage.mockResolvedValue({ ok: false, error: new NotFoundError('Release', 'release-1', 'release.notFound') });
    const res = await GET(req(), ctx('release-1'));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Release not found: release-1', code: 'release.notFound' });
  });

  it('500 on any other error', async () => {
    mockedAuth.mockResolvedValue(null as never);
    getPage.mockResolvedValue({ ok: false, error: new Error('db exploded') });
    const res = await GET(req(), ctx('release-1'));
    expect(res.status).toBe(500);
  });

  it('200 for a published release, response parses against the contract', async () => {
    mockedAuth.mockResolvedValue(null as never);
    getPage.mockResolvedValue({ ok: true, value: mockView });
    const res = await GET(req(), ctx('release-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = releasePageResponseSchema.parse(body);
    expect(parsed.isReleased).toBe(true);
    expect(parsed.tracks).toHaveLength(1);
    expect(parsed.artist.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(getPage).toHaveBeenCalledWith({ releaseId: 'release-1', artistSlug: null, viewerId: null, viewerRole: null });
  });

  it('404 when the artist has no published tracks (hidden from the storefront) for a guest', async () => {
    mockedAuth.mockResolvedValue(null as never);
    getPage.mockResolvedValue({ ok: false, error: new NotFoundError('Release', 'release-1', 'release.notFound') });
    const res = await GET(req(), ctx('release-1'));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Release not found: release-1', code: 'release.notFound' });
    expect(getPage).toHaveBeenCalledWith({ releaseId: 'release-1', artistSlug: null, viewerId: null, viewerRole: null });
  });

  it('200 for a scheduled release in countdown: tracks empty, showCountdown true', async () => {
    mockedAuth.mockResolvedValue(null as never);
    getPage.mockResolvedValue({
      ok: true,
      value: {
        ...mockView,
        release: { ...mockRelease, status: 'SCHEDULED', releaseDate: new Date('2099-01-01T00:00:00.000Z') },
        tracks: [],
        isReleased: false,
        showCountdown: true,
      },
    });
    const res = await GET(req(), ctx('release-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = releasePageResponseSchema.parse(body);
    expect(parsed.tracks).toEqual([]);
    expect(parsed.showCountdown).toBe(true);
    expect(parsed.presaved).toBe(false);
  });

  it('presaved=true for a signed-in viewer with a presave', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-2', role: 'LISTENER' } } as never);
    getPage.mockResolvedValue({
      ok: true,
      value: {
        ...mockView,
        release: { ...mockRelease, status: 'SCHEDULED', releaseDate: new Date('2099-01-01T00:00:00.000Z') },
        tracks: [],
        isReleased: false,
        showCountdown: true,
        presaved: true,
      },
    });
    const res = await GET(req(), ctx('release-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = releasePageResponseSchema.parse(body);
    expect(parsed.presaved).toBe(true);
    expect(getPage).toHaveBeenCalledWith({
      releaseId: 'release-1',
      artistSlug: null,
      viewerId: 'user-2',
      viewerRole: 'LISTENER',
    });
  });
});
