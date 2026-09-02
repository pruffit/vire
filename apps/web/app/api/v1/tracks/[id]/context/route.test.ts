import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackContextResponseSchema } from '@vire/api-contracts';

const { getTrackArtistProfileId, getArtistContext, artistHasPublishedTrackById, isArtistMember, buildSimilarArtists } = vi.hoisted(() => ({
  getTrackArtistProfileId: vi.fn(),
  getArtistContext: vi.fn(),
  artistHasPublishedTrackById: vi.fn(),
  isArtistMember: vi.fn(),
  buildSimilarArtists: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/discovery', () => ({ buildSimilarArtists }));
vi.mock('@vire/db', () => ({
  getTrackArtistProfileId,
  getArtistContext,
  artistHasPublishedTrackById,
  isArtistMember,
}));

import { auth } from '@/auth';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const ctx = (id: string = TRACK_ID) => ({ params: Promise.resolve({ id }) });
const req = () => new Request(`http://localhost/api/v1/tracks/${TRACK_ID}/context`);

const ARTIST = { slug: 'danya', name: 'Danya', avatarUrl: 'https://cdn.example/a.jpg', bio: 'Bio text' };

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuth.mockResolvedValue(null as never);
  artistHasPublishedTrackById.mockResolvedValue(true);
  buildSimilarArtists.mockResolvedValue([]);
});

describe('GET /api/v1/tracks/[id]/context', () => {
  it('400 when the track id is not a uuid', async () => {
    const res = await GET(req(), ctx('nope'));
    expect(res.status).toBe(400);
    expect(getTrackArtistProfileId).not.toHaveBeenCalled();
  });

  it('404 for a non-existent track', async () => {
    getTrackArtistProfileId.mockResolvedValue(null);
    const res = await GET(req(), ctx());
    expect(res.status).toBe(404);
    expect(getArtistContext).not.toHaveBeenCalled();
  });

  it('404 when the track resolves to an artist that no longer exists/is inactive', async () => {
    getTrackArtistProfileId.mockResolvedValue('artist-1');
    getArtistContext.mockResolvedValue(null);
    const res = await GET(req(), ctx());
    expect(res.status).toBe(404);
  });

  it('200: response shape matches the contract', async () => {
    getTrackArtistProfileId.mockResolvedValue('artist-1');
    getArtistContext.mockResolvedValue(ARTIST);
    buildSimilarArtists.mockResolvedValue([
      { artistSlug: 'other', artistName: 'Other', artistAvatarUrl: null },
    ]);

    const res = await GET(req(), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      artist: ARTIST,
      similar: [{ slug: 'other', name: 'Other', avatarUrl: null }],
    });
    expect(trackContextResponseSchema.safeParse(body).success).toBe(true);
  });

  it('200 with an empty similar list when there are no similar artists', async () => {
    getTrackArtistProfileId.mockResolvedValue('artist-1');
    getArtistContext.mockResolvedValue(ARTIST);
    buildSimilarArtists.mockResolvedValue([]);

    const res = await GET(req(), ctx());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ artist: ARTIST, similar: [] });
  });

  describe('пустой артист (нет опубликованных треков)', () => {
    beforeEach(() => {
      getTrackArtistProfileId.mockResolvedValue('artist-1');
      getArtistContext.mockResolvedValue(ARTIST);
      artistHasPublishedTrackById.mockResolvedValue(false);
    });

    it('404 для анонима', async () => {
      const res = await GET(req(), ctx());
      expect(res.status).toBe(404);
      expect(buildSimilarArtists).not.toHaveBeenCalled();
    });

    it('404 для обычного слушателя (не участник профиля)', async () => {
      mockedAuth.mockResolvedValue({ user: { id: 'u2', role: 'VIEWER' } } as never);
      isArtistMember.mockResolvedValue(false);
      const res = await GET(req(), ctx());
      expect(res.status).toBe(404);
    });

    it('200 для участника профиля артиста (artist_members)', async () => {
      mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'VIEWER' } } as never);
      isArtistMember.mockResolvedValue(true);
      const res = await GET(req(), ctx());
      expect(res.status).toBe(200);
    });

    it('200 для модератора/админа', async () => {
      mockedAuth.mockResolvedValue({ user: { id: 'staff-1', role: 'MODERATOR' } } as never);
      isArtistMember.mockResolvedValue(false);
      const res = await GET(req(), ctx());
      expect(res.status).toBe(200);
    });
  });
});
