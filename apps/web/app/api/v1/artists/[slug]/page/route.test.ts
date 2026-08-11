import { describe, it, expect, vi, beforeEach } from 'vitest';
import { artistPageResponseSchema } from '@vire/api-contracts';

const { getPage } = vi.hoisted(() => ({ getPage: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleArtistReadRepository: class {},
}));
vi.mock('@vire/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vire/core')>();
  return {
    ...actual,
    ArtistPageService: class {
      getPage = getPage;
    },
  };
});

import { auth } from '@/auth';
import { NotFoundError } from '@vire/core';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);
const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const req = () => new Request('http://localhost/api/v1/artists/danya/page');

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

const mockView = {
  artist: mockArtist,
  releases: [],
  upcoming: [],
  posts: [],
  smartLinks: [],
  playableTracks: [],
  explicitReleaseIds: new Set<string>(),
  following: false,
  followerCount: 3,
  presavedReleaseIds: new Set<string>(),
};

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/artists/[slug]/page', () => {
  it('404 when the artist is hidden', async () => {
    mockedAuth.mockResolvedValue(null as never);
    getPage.mockResolvedValue({ ok: false, error: new NotFoundError('ArtistProfile', 'danya', 'artist.notFound') });
    const res = await GET(req(), ctx('danya'));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'ArtistProfile not found: danya', code: 'artist.notFound' });
  });

  it('500 on any other error', async () => {
    mockedAuth.mockResolvedValue(null as never);
    getPage.mockResolvedValue({ ok: false, error: new Error('db exploded') });
    const res = await GET(req(), ctx('danya'));
    expect(res.status).toBe(500);
  });

  it('200 for a visible artist, guest gets following=false and empty presaved', async () => {
    mockedAuth.mockResolvedValue(null as never);
    getPage.mockResolvedValue({ ok: true, value: mockView });
    const res = await GET(req(), ctx('danya'));
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = artistPageResponseSchema.parse(body);
    expect(parsed.following).toBe(false);
    expect(parsed.presavedReleaseIds).toEqual([]);
    expect(parsed.followerCount).toBe(3);
    expect(parsed.artist.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(getPage).toHaveBeenCalledWith({ slug: 'danya', viewerId: null, viewerRole: null });
  });

  it('200 for a signed-in viewer, values come from the service', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-2', role: 'LISTENER' } } as never);
    getPage.mockResolvedValue({
      ok: true,
      value: {
        ...mockView,
        following: true,
        presavedReleaseIds: new Set(['release-1']),
        explicitReleaseIds: new Set(['release-1']),
      },
    });
    const res = await GET(req(), ctx('danya'));
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = artistPageResponseSchema.parse(body);
    expect(parsed.following).toBe(true);
    expect(parsed.presavedReleaseIds).toEqual(['release-1']);
    expect(parsed.explicitReleaseIds).toEqual(['release-1']);
    expect(getPage).toHaveBeenCalledWith({ slug: 'danya', viewerId: 'user-2', viewerRole: 'LISTENER' });
  });
});
