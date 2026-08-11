import { describe, it, expect, vi, beforeEach } from 'vitest';
import { homePlaylistsResponseSchema } from '@vire/api-contracts';

const { editorialPlaylists, personalPlaylists, popularPlaylists, publicUserPlaylists, likedPlaylistIds } = vi.hoisted(() => ({
  editorialPlaylists: vi.fn(),
  personalPlaylists: vi.fn(),
  popularPlaylists: vi.fn(),
  publicUserPlaylists: vi.fn(),
  likedPlaylistIds: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleHomeBlocksRepository: class {
    editorialPlaylists = editorialPlaylists;
    personalPlaylists = personalPlaylists;
    popularPlaylists = popularPlaylists;
    publicUserPlaylists = publicUserPlaylists;
    likedPlaylistIds = likedPlaylistIds;
  },
}));

import { auth } from '@/auth';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);

function makePlaylist(overrides?: Record<string, unknown>) {
  return {
    id: 'playlist-1',
    title: 'Title',
    description: null,
    kind: 'TRENDING',
    editorialParams: null,
    trackCount: 5,
    likesCount: 0,
    covers: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  editorialPlaylists.mockResolvedValue([]);
  personalPlaylists.mockResolvedValue([]);
  popularPlaylists.mockResolvedValue([]);
  publicUserPlaylists.mockResolvedValue([]);
  likedPlaylistIds.mockResolvedValue([]);
});

describe('GET /api/v1/home/playlists — гость', () => {
  it('200 without a session; response matches the contract', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = homePlaylistsResponseSchema.parse(body);
    expect(parsed.playlists).toEqual([]);
    expect(parsed.likedPlaylistIds).toEqual([]);
  });

  it('does not call personalPlaylists or likedPlaylistIds for a guest', async () => {
    mockedAuth.mockResolvedValue(null as never);
    await GET();
    expect(personalPlaylists).not.toHaveBeenCalled();
    expect(likedPlaylistIds).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/home/playlists — вошедший пользователь', () => {
  it('200 with a session; passes viewerId from the session to personal/liked reads', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    personalPlaylists.mockResolvedValue([makePlaylist({ id: 'p1' }), makePlaylist({ id: 'p2' }), makePlaylist({ id: 'p3' }), makePlaylist({ id: 'p4' })]);
    likedPlaylistIds.mockResolvedValue(['p1']);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = homePlaylistsResponseSchema.parse(body);

    expect(personalPlaylists).toHaveBeenCalledWith('user-1', 4);
    expect(likedPlaylistIds).toHaveBeenCalledWith('user-1');
    expect(parsed.likedPlaylistIds).toEqual(['p1']);
    expect(parsed.playlists.map((p) => p.id)).toEqual(expect.arrayContaining(['p1', 'p2', 'p3', 'p4']));
  });

  it('surfaces a 500 when the repository fails — no silent empty-block degradation over HTTP', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    editorialPlaylists.mockRejectedValue(new Error('db down'));
    await expect(GET()).rejects.toThrow('db down');
  });
});
