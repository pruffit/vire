import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getCollabState, isCollaborator } = vi.hoisted(() => ({
  getCollabState: vi.fn(),
  isCollaborator: vi.fn(),
}));
const { subscribeChannel, unsubscribe } = vi.hoisted(() => {
  const unsubscribe = vi.fn();
  return { subscribeChannel: vi.fn(() => unsubscribe), unsubscribe };
});

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/playlist-cover-storage', () => ({ playlistCoverStorage: { upload: vi.fn() } }));
vi.mock('@/lib/realtime', () => ({ subscribeChannel, playlistChannel: (id: string) => `rt:playlist:${id}` }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzlePlaylistRepository: class {
    getCollabState = getCollabState;
    isCollaborator = isCollaborator;
  },
  DrizzleBlockRepository: class {},
  DrizzleNotificationRepository: class {},
}));

import { auth } from '@/auth';
import { GET } from './route';
const mockedAuth = vi.mocked(auth);

const ctx = { params: Promise.resolve({ id: 'p1' }) };
const req = () => new Request('http://localhost/api/v1/playlists/p1/stream');

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/playlists/[id]/stream', () => {
  it('401 unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await GET(req(), ctx);
    expect(res.status).toBe(401);
    expect(getCollabState).not.toHaveBeenCalled();
  });

  it('404 when playlist not found', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getCollabState.mockResolvedValue(null);
    expect((await GET(req(), ctx)).status).toBe(404);
  });

  it('403 when the playlist is not collaborative', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getCollabState.mockResolvedValue({ isCollaborative: false, collabToken: null, version: 0, ownerUserId: 'owner-1' });
    expect((await GET(req(), ctx)).status).toBe(403);
  });

  it('403 when the caller is not a member', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'random' } } as never);
    getCollabState.mockResolvedValue({ isCollaborative: true, collabToken: 'x', version: 0, ownerUserId: 'owner-1' });
    isCollaborator.mockResolvedValue(false);
    expect((await GET(req(), ctx)).status).toBe(403);
  });

  it('opens an SSE stream for a member and sends a snapshot', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'owner-1' } } as never);
    getCollabState.mockResolvedValue({ isCollaborative: true, collabToken: 'x', version: 4, ownerUserId: 'owner-1' });

    const res = await GET(req(), ctx);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(subscribeChannel).toHaveBeenCalledWith('rt:playlist:p1', expect.any(Function));

    await res.body?.cancel();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
