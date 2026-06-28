import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getPlaylistWithTracks, getPlaylistSuggestions } = vi.hoisted(() => ({
  getPlaylistWithTracks: vi.fn(),
  getPlaylistSuggestions: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({ getPlaylistWithTracks, getPlaylistSuggestions }));

import { auth } from '@/auth';
import { GET } from './route';
const mockedAuth = vi.mocked(auth);

const ctx = { params: Promise.resolve({ id: 'p1' }) };

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/playlists/[id]/suggestions', () => {
  it('401 unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const req = new Request('http://localhost/api/v1/playlists/p1/suggestions');
    expect((await GET(req, ctx)).status).toBe(401);
  });
  it('404 when playlist not found', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getPlaylistWithTracks.mockResolvedValue(null);
    const req = new Request('http://localhost/api/v1/playlists/p1/suggestions');
    expect((await GET(req, ctx)).status).toBe(404);
  });
  it('403 when not owner', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getPlaylistWithTracks.mockResolvedValue({ ownerUserId: 'other' });
    const req = new Request('http://localhost/api/v1/playlists/p1/suggestions');
    expect((await GET(req, ctx)).status).toBe(403);
  });
  it('200 returns suggestions payload', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getPlaylistWithTracks.mockResolvedValue({ ownerUserId: 'u1' });
    const suggestions = { byMood: [], byArtist: [], byGenre: [] };
    getPlaylistSuggestions.mockResolvedValue(suggestions);
    const req = new Request('http://localhost/api/v1/playlists/p1/suggestions');
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(suggestions);
    expect(getPlaylistSuggestions).toHaveBeenCalledWith('p1', 'u1');
  });
});
