import { describe, it, expect, vi, beforeEach } from 'vitest';
import { playlistSuggestionsResponseSchema } from '@vire/api-contracts';

const { getWithTracks, suggestions } = vi.hoisted(() => ({
  getWithTracks: vi.fn(),
  suggestions: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/playlist-cover-storage', () => ({ playlistCoverStorage: { upload: vi.fn() } }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzlePlaylistRepository: class {
    getWithTracks = getWithTracks;
    suggestions = suggestions;
  },
  DrizzleBlockRepository: class {},
  DrizzleNotificationRepository: class {},
}));

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
    getWithTracks.mockResolvedValue(null);
    const req = new Request('http://localhost/api/v1/playlists/p1/suggestions');
    expect((await GET(req, ctx)).status).toBe(404);
  });
  it('403 when not owner', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'other' });
    const req = new Request('http://localhost/api/v1/playlists/p1/suggestions');
    expect((await GET(req, ctx)).status).toBe(403);
  });
  it('200 returns suggestions payload', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'u1' });
    const payload = { liked: [], recent: [], similar: [] };
    suggestions.mockResolvedValue(payload);
    const req = new Request('http://localhost/api/v1/playlists/p1/suggestions');
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(payload);
    expect(suggestions).toHaveBeenCalledWith('p1', 'u1');
    expect(playlistSuggestionsResponseSchema.safeParse(json).success).toBe(true);
  });
});
