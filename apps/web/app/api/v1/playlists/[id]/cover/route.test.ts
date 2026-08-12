import { describe, it, expect, vi, beforeEach } from 'vitest';
import { playlistCoverResponseSchema } from '@vire/api-contracts';

const { getWithTracks, setCover } = vi.hoisted(() => ({
  getWithTracks: vi.fn(),
  setCover: vi.fn(),
}));
const { upload } = vi.hoisted(() => ({ upload: vi.fn() }));
const { validateImageUpload } = vi.hoisted(() => ({ validateImageUpload: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzlePlaylistRepository: class {
    getWithTracks = getWithTracks;
    setCover = setCover;
  },
  DrizzleBlockRepository: class {},
  DrizzleNotificationRepository: class {},
}));
vi.mock('@/lib/playlist-cover-storage', () => ({ playlistCoverStorage: { upload } }));
vi.mock('@/lib/image', () => ({
  validateImageUpload,
  PLAYLIST_COVER_POLICY: {
    label: 'Обложка плейлиста',
    maxBytes: 5 * 1024 * 1024,
    minDimension: 300,
    maxDimension: 4000,
    square: false,
    maxAspect: 2,
  },
}));

import { auth } from '@/auth';
import { POST } from './route';
const mockedAuth = vi.mocked(auth);

function makeFormReq(fields: Record<string, string | File>): Request {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new Request('http://localhost/api/v1/playlists/p1/cover', { method: 'POST', body: fd });
}
const ctx = { params: Promise.resolve({ id: 'p1' }) };

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/playlists/[id]/cover', () => {
  it('401 unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await POST(makeFormReq({ removeCover: '1' }), ctx)).status).toBe(401);
  });
  it('404 when playlist not found', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue(null);
    expect((await POST(makeFormReq({ removeCover: '1' }), ctx)).status).toBe(404);
  });
  it('403 when not owner', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'other' });
    expect((await POST(makeFormReq({ removeCover: '1' }), ctx)).status).toBe(403);
  });
  it('200 remove cover calls setCover with null', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'u1' });
    const res = await POST(makeFormReq({ removeCover: '1' }), ctx);
    expect(res.status).toBe(200);
    expect(setCover).toHaveBeenCalledWith('p1', 'u1', null);
    const json = await res.json();
    expect(json).toEqual({ ok: true, coverUrl: null });
    expect(playlistCoverResponseSchema.safeParse(json).success).toBe(true);
  });
  it('400 when no file provided', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'u1' });
    expect((await POST(makeFormReq({}), ctx)).status).toBe(400);
  });
  it('400 when validateImageUpload rejects', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'u1' });
    validateImageUpload.mockReturnValue({ ok: false, status: 400, error: 'Только JPEG, PNG или WebP' });
    const file = new File([new Uint8Array([1, 2, 3])], 'cover.gif', { type: 'image/gif' });
    const res = await POST(makeFormReq({ cover: file }), ctx);
    expect(res.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });
  it('200 uploads file and calls setCover with ?v= URL', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getWithTracks.mockResolvedValue({ ownerUserId: 'u1' });
    validateImageUpload.mockReturnValue({ ok: true, info: { ext: 'png', mime: 'image/png', width: 500, height: 500 } });
    upload.mockResolvedValue('https://cdn.example.com/stream/playlists/p1.png');
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'cover.png', { type: 'image/png' });
    const res = await POST(makeFormReq({ cover: file }), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.coverUrl).toMatch(/\?v=\d+$/);
    expect(setCover).toHaveBeenCalledWith('p1', 'u1', expect.stringMatching(/\?v=\d+$/));
    expect(upload).toHaveBeenCalledWith('playlists/p1.png', expect.any(Buffer), 'image/png');
  });
});
