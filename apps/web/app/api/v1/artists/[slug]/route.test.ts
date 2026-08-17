import { describe, it, expect, vi, beforeEach } from 'vitest';
import { artistDetailResponseSchema } from '@vire/api-contracts';

const { getBySlug, isArtistMember, artistHasPublishedTrack } = vi.hoisted(() => ({
  getBySlug: vi.fn(),
  isArtistMember: vi.fn(),
  artistHasPublishedTrack: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/artist-page', () => ({ artistHasPublishedTrack }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleArtistRepository: class {},
  isArtistMember,
}));
vi.mock('@vire/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vire/core')>();
  return {
    ...actual,
    ArtistService: class {
      getBySlug = getBySlug;
    },
  };
});

import { auth } from '@/auth';
import { NotFoundError } from '@vire/core';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);

const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const req = () => new Request('http://localhost/api/v1/artists/danya');

beforeEach(() => {
  vi.clearAllMocks();
  artistHasPublishedTrack.mockResolvedValue(true);
  mockedAuth.mockResolvedValue(null as never);
});

describe('GET /api/v1/artists/[slug]', () => {
  it('404 when the artist is not found', async () => {
    getBySlug.mockResolvedValue({ ok: false, error: new NotFoundError('ArtistProfile', 'danya', 'artist.notFound') });
    const res = await GET(req(), ctx('danya'));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'ArtistProfile not found: danya', code: 'artist.notFound' });
  });

  it('500 on any other error', async () => {
    getBySlug.mockResolvedValue({ ok: false, error: new Error('db exploded') });
    const res = await GET(req(), ctx('danya'));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Internal server error' });
  });

  it('happy path: returns the artist profile', async () => {
    const artist = {
      id: 'a1',
      userId: 'u1',
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
    getBySlug.mockResolvedValue({ ok: true, value: artist });
    const res = await GET(req(), ctx('danya'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ...artist,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    });
    expect(artistDetailResponseSchema.safeParse(body).success).toBe(true);
    expect(getBySlug).toHaveBeenCalledWith('danya');
  });

  describe('пустой артист (нет опубликованных треков)', () => {
    const artist = {
      id: 'a1',
      userId: 'u1',
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

    beforeEach(() => {
      getBySlug.mockResolvedValue({ ok: true, value: artist });
      artistHasPublishedTrack.mockResolvedValue(false);
    });

    it('404 для анонима — тот же ответ, что «не найден»', async () => {
      const res = await GET(req(), ctx('danya'));
      expect(res.status).toBe(404);
      await expect(res.json()).resolves.toEqual({ error: 'ArtistProfile not found: danya', code: 'artist.notFound' });
    });

    it('404 для обычного слушателя (не участник профиля)', async () => {
      mockedAuth.mockResolvedValue({ user: { id: 'u2', role: 'VIEWER' } } as never);
      isArtistMember.mockResolvedValue(false);
      const res = await GET(req(), ctx('danya'));
      expect(res.status).toBe(404);
    });

    it('200 для участника профиля артиста (artist_members)', async () => {
      mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'VIEWER' } } as never);
      isArtistMember.mockResolvedValue(true);
      const res = await GET(req(), ctx('danya'));
      expect(res.status).toBe(200);
    });

    it('200 для модератора/админа', async () => {
      mockedAuth.mockResolvedValue({ user: { id: 'staff-1', role: 'MODERATOR' } } as never);
      isArtistMember.mockResolvedValue(false);
      const res = await GET(req(), ctx('danya'));
      expect(res.status).toBe(200);
    });
  });
});
