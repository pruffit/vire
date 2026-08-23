import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userProfileResponseSchema } from '@vire/api-contracts';

const { loadFriendProfile } = vi.hoisted(() => ({ loadFriendProfile: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/friend-profile', () => ({ loadFriendProfile }));

import { auth } from '@/auth';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);

const SELF_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_ID = '11111111-1111-1111-1111-111111111111';

const ctx = (id: string) => ({ params: Promise.resolve({ userId: id }) });
const req = () => new Request(`http://localhost/api/v1/users/${OTHER_ID}/profile`);

const baseProfile = {
  id: OTHER_ID,
  name: 'Sam',
  image: null,
  status: 'FRIENDS' as const,
  likesVisible: true,
  likes: [
    {
      id: 't1',
      title: 'Track',
      durationSec: 180,
      releaseId: 'r1',
      releaseCoverUrl: null,
      artistName: 'Artist',
      artistSlug: 'artist',
      accentColor: null,
      isExplicit: false,
      likedAt: new Date('2026-08-20T10:00:00.000Z'),
      version: null,
      feat: [],
    },
  ],
  playlists: [
    {
      id: 'p1',
      title: 'Playlist',
      visibility: 'PUBLIC' as const,
      trackCount: 3,
      coverUrl: null,
      covers: [],
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-10T00:00:00.000Z'),
    },
  ],
  canChat: true,
  blocked: false,
  iBlockedThem: false,
};

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/users/[userId]/profile', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);

    const res = await GET(req(), ctx(OTHER_ID));

    expect(res.status).toBe(401);
    expect(loadFriendProfile).not.toHaveBeenCalled();
  });

  it('400 on invalid userId', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);

    const res = await GET(req(), ctx('nope'));

    expect(res.status).toBe(400);
  });

  it('404 when the user does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    loadFriendProfile.mockResolvedValue(null);

    const res = await GET(req(), ctx(OTHER_ID));

    expect(res.status).toBe(404);
  });

  it('returns the profile shape and passes viewer/target ids through', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    loadFriendProfile.mockResolvedValue(baseProfile);

    const res = await GET(req(), ctx(OTHER_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(loadFriendProfile).toHaveBeenCalledWith(SELF_ID, OTHER_ID);
    expect(userProfileResponseSchema.safeParse(body).success).toBe(true);
    expect(body.likes[0].likedAt).toBe(baseProfile.likes[0].likedAt.toISOString());
    expect(body.playlists[0].createdAt).toBe(baseProfile.playlists[0].createdAt.toISOString());
    expect(body.playlists[0].updatedAt).toBe(baseProfile.playlists[0].updatedAt.toISOString());
    // canChat — не часть DTO (чат на мобилке не строится); iBlockedThem — часть DTO с инкремента 11.
    expect(body.canChat).toBeUndefined();
    expect(body.iBlockedThem).toBe(false);
  });

  it('hides likes when the viewer cannot see them', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    loadFriendProfile.mockResolvedValue({ ...baseProfile, likesVisible: false, likes: [] });

    const res = await GET(req(), ctx(OTHER_ID));
    const body = await res.json();

    expect(body.likesVisible).toBe(false);
    expect(body.likes).toEqual([]);
  });

  it('surfaces blocked and iBlockedThem when I blocked them, without leaking canChat', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    loadFriendProfile.mockResolvedValue({
      ...baseProfile,
      blocked: true,
      iBlockedThem: true,
      likesVisible: false,
      likes: [],
    });

    const res = await GET(req(), ctx(OTHER_ID));
    const body = await res.json();

    expect(body.blocked).toBe(true);
    expect(body.iBlockedThem).toBe(true);
    expect(body.canChat).toBeUndefined();
  });

  it('surfaces blocked with iBlockedThem=false when they blocked me', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    loadFriendProfile.mockResolvedValue({
      ...baseProfile,
      blocked: true,
      iBlockedThem: false,
      likesVisible: false,
      likes: [],
    });

    const res = await GET(req(), ctx(OTHER_ID));
    const body = await res.json();

    expect(body.blocked).toBe(true);
    expect(body.iBlockedThem).toBe(false);
  });
});
