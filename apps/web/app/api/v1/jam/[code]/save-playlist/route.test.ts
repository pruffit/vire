import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError, ValidationError } from '@vire/core';

const { resolveCode, getQueueForSave, recordSavedPlaylist } = vi.hoisted(() => ({
  resolveCode: vi.fn(),
  getQueueForSave: vi.fn(),
  recordSavedPlaylist: vi.fn(),
}));
const { create, addTrack, getWithTracks, trackExists } = vi.hoisted(() => ({
  create: vi.fn(),
  addTrack: vi.fn().mockResolvedValue(1),
  getWithTracks: vi.fn().mockResolvedValue({ ownerUserId: 'u1', isCollaborative: false }),
  trackExists: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/jam', () => ({ jamService: () => ({ resolveCode, getQueueForSave, recordSavedPlaylist }) }));
vi.mock('@/lib/playlist-cover-storage', () => ({ playlistCoverStorage: { upload: vi.fn() } }));
vi.mock('@/lib/realtime', () => ({ publishChannel: vi.fn(), playlistChannel: (id: string) => `rt:playlist:${id}` }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzlePlaylistRepository: class {
    create = create;
    addTrack = addTrack;
    getWithTracks = getWithTracks;
    trackExists = trackExists;
  },
  DrizzleBlockRepository: class {},
  DrizzleNotificationRepository: class {},
}));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const req = (body: unknown = {}) =>
  new Request('http://localhost/api/v1/jam/A2B3C4/save-playlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const TRACK_A = '11111111-1111-1111-1111-111111111111';
const TRACK_B = '22222222-2222-2222-2222-222222222222';
const queueItem = (trackId: string) => ({ id: `q-${trackId}`, trackId } as never);

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/jam/[code]/save-playlist', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);

    const res = await POST(req(), ctx('A2B3C4'));

    expect(res.status).toBe(401);
    expect(resolveCode).not.toHaveBeenCalled();
  });

  it('400 on an invalid title', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);

    const res = await POST(req({ title: 'x'.repeat(101) }), ctx('A2B3C4'));

    expect(res.status).toBe(400);
    expect(resolveCode).not.toHaveBeenCalled();
  });

  it('404 when the code does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    resolveCode.mockResolvedValue({ ok: false, error: new NotFoundError('Jam', 'A2B3C4') });

    const res = await POST(req(), ctx('A2B3C4'));

    expect(res.status).toBe(404);
    expect(getQueueForSave).not.toHaveBeenCalled();
  });

  it('400 on a malformed code', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    resolveCode.mockResolvedValue({ ok: false, error: new ValidationError('Неверный код джема') });

    const res = await POST(req(), ctx('bad'));

    expect(res.status).toBe(400);
  });

  it('403 when the caller is not a participant', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    getQueueForSave.mockResolvedValue({ ok: false, error: new ForbiddenError('Вы не участник этого джема') });

    const res = await POST(req(), ctx('A2B3C4'));

    expect(res.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('400 when the queue is empty', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    getQueueForSave.mockResolvedValue({
      ok: true,
      value: { session: { id: 'jam-1', title: 'Party' }, isHost: true, queue: [] },
    });

    const res = await POST(req(), ctx('A2B3C4'));

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a playlist from the queue and records it as saved when the caller is host', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    getQueueForSave.mockResolvedValue({
      ok: true,
      value: { session: { id: 'jam-1', title: 'Party' }, isHost: true, queue: [queueItem(TRACK_A), queueItem(TRACK_B)] },
    });
    create.mockResolvedValue({ id: 'playlist-1' });

    const res = await POST(req(), ctx('A2B3C4'));

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ playlistId: 'playlist-1' });
    expect(create).toHaveBeenCalledWith('u1', 'Party');
    expect(addTrack).toHaveBeenNthCalledWith(1, 'playlist-1', TRACK_A, 'u1');
    expect(addTrack).toHaveBeenNthCalledWith(2, 'playlist-1', TRACK_B, 'u1');
    expect(recordSavedPlaylist).toHaveBeenCalledWith('jam-1', 'playlist-1');
  });

  it('uses a custom title when provided', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    getQueueForSave.mockResolvedValue({
      ok: true,
      value: { session: { id: 'jam-1', title: 'Party' }, isHost: false, queue: [queueItem(TRACK_A)] },
    });
    create.mockResolvedValue({ id: 'playlist-1' });

    const res = await POST(req({ title: 'My mix' }), ctx('A2B3C4'));

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith('u1', 'My mix');
    expect(recordSavedPlaylist).not.toHaveBeenCalled();
  });
});
