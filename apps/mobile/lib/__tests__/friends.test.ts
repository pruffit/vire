import { describe, it, expect, vi, beforeEach } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../api-client', () => ({ apiRequest: request }));

import {
  fetchFriends,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriendEdge,
  fetchUserProfile,
  likedTracksToQueue,
} from '../friends';
import type { LikedTrackDTO } from '@vire/api-contracts';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchFriends', () => {
  it('GET /api/v1/friends с нужной схемой', async () => {
    request.mockResolvedValue({ ok: true, data: { friends: [], incoming: [] } });

    await fetchFriends();

    expect(request).toHaveBeenCalledWith('/api/v1/friends', expect.objectContaining({ schema: expect.anything() }));
  });
});

describe('searchUsers', () => {
  it('GET /api/v1/friends/search?q=... с нужной схемой', async () => {
    request.mockResolvedValue({ ok: true, data: { results: [] } });

    await searchUsers('sam');

    expect(request).toHaveBeenCalledWith(
      '/api/v1/friends/search?q=sam',
      expect.objectContaining({ schema: expect.anything() }),
    );
  });

  it('экранирует query', async () => {
    request.mockResolvedValue({ ok: true, data: { results: [] } });

    await searchUsers('a b/c');

    expect(request).toHaveBeenCalledWith(
      `/api/v1/friends/search?q=${encodeURIComponent('a b/c')}`,
      expect.anything(),
    );
  });
});

describe('sendFriendRequest', () => {
  it('POST /api/v1/friends/request с телом {userId}', async () => {
    request.mockResolvedValue({ ok: true, data: { status: 'OUTGOING' } });

    await sendFriendRequest('u1');

    expect(request).toHaveBeenCalledWith(
      '/api/v1/friends/request',
      expect.objectContaining({ method: 'POST', body: { userId: 'u1' } }),
    );
  });
});

describe('acceptFriendRequest', () => {
  it('POST /api/v1/friends/{userId}/accept', async () => {
    request.mockResolvedValue({ ok: true, data: { ok: true } });

    await acceptFriendRequest('u1');

    expect(request).toHaveBeenCalledWith(
      '/api/v1/friends/u1/accept',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('removeFriendEdge', () => {
  it('DELETE /api/v1/friends/{userId}', async () => {
    request.mockResolvedValue({ ok: true, data: { ok: true } });

    await removeFriendEdge('u1');

    expect(request).toHaveBeenCalledWith(
      '/api/v1/friends/u1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

describe('fetchUserProfile', () => {
  it('GET /api/v1/users/{userId}/profile с нужной схемой', async () => {
    request.mockResolvedValue({ ok: true, data: { id: 'u1' } });

    await fetchUserProfile('u1');

    expect(request).toHaveBeenCalledWith(
      '/api/v1/users/u1/profile',
      expect.objectContaining({ schema: expect.anything() }),
    );
  });

  it('экранирует userId', async () => {
    request.mockResolvedValue({ ok: true, data: {} });

    await fetchUserProfile('a b/c');

    expect(request).toHaveBeenCalledWith(
      `/api/v1/users/${encodeURIComponent('a b/c')}/profile`,
      expect.anything(),
    );
  });
});

describe('likedTracksToQueue', () => {
  const track: LikedTrackDTO = {
    id: 't1',
    title: 'Track',
    version: null,
    durationSec: 180,
    releaseId: 'r1',
    releaseCoverUrl: 'https://cdn.viremusic.ru/cover.jpg',
    artistName: 'Artist',
    artistSlug: 'artist',
    isExplicit: false,
    likedAt: '2026-08-20T10:00:00.000Z',
    feat: [],
  };

  it('маппит id/title/artistName/durationSec напрямую, coverUrl — из releaseCoverUrl', () => {
    expect(likedTracksToQueue([track])).toEqual([
      { id: 't1', title: 'Track', artistName: 'Artist', coverUrl: 'https://cdn.viremusic.ru/cover.jpg', durationSec: 180 },
    ]);
  });

  it('releaseCoverUrl=null — coverUrl тоже null', () => {
    expect(likedTracksToQueue([{ ...track, releaseCoverUrl: null }])[0].coverUrl).toBeNull();
  });

  it('пустой список — пустая очередь', () => {
    expect(likedTracksToQueue([])).toEqual([]);
  });
});
