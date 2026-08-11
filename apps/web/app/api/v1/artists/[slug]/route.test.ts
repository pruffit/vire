import { describe, it, expect, vi, beforeEach } from 'vitest';
import { artistDetailResponseSchema } from '@vire/api-contracts';

const { getBySlug } = vi.hoisted(() => ({ getBySlug: vi.fn() }));

vi.mock('@vire/db', () => ({
  db: {},
  DrizzleArtistRepository: class {},
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

import { NotFoundError } from '@vire/core';
import { GET } from './route';

const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const req = () => new Request('http://localhost/api/v1/artists/danya');

beforeEach(() => vi.clearAllMocks());

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
});
