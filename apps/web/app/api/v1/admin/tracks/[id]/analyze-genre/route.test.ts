import { describe, it, expect, vi, beforeEach } from 'vitest';

const { trackExists, analyzeGenreAdd, insertAuditEntry } = vi.hoisted(() => ({
  trackExists: vi.fn(),
  analyzeGenreAdd: vi.fn(),
  insertAuditEntry: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({ trackExists, insertAuditEntry }));
vi.mock('@/lib/queue', () => ({ analyzeGenreQueue: { add: analyzeGenreAdd } }));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);
const TRACK_ID = '1321eb20-c9e6-4d95-b4e7-7e6a08fc8cf9';
const ctx = { params: Promise.resolve({ id: TRACK_ID }) };

function makeReq(): Request {
  return new Request(`http://localhost/api/v1/admin/tracks/${TRACK_ID}/analyze-genre`, { method: 'POST' });
}

beforeEach(() => {
  vi.clearAllMocks();
  insertAuditEntry.mockResolvedValue(undefined);
});

describe('POST /api/v1/admin/tracks/[id]/analyze-genre', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(401);
    expect(analyzeGenreAdd).not.toHaveBeenCalled();
  });

  it('403 for a VIEWER (read-only role, no admin.content.moderate)', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'VIEWER' } } as never);
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(403);
    expect(analyzeGenreAdd).not.toHaveBeenCalled();
    expect(insertAuditEntry).not.toHaveBeenCalled();
  });

  it('403 for a plain listener', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'LISTENER' } } as never);
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(403);
    expect(analyzeGenreAdd).not.toHaveBeenCalled();
  });

  it('400 on a malformed track id', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'MODERATOR' } } as never);
    const res = await POST(makeReq(), { params: Promise.resolve({ id: 'nope' }) });
    expect(res.status).toBe(400);
    expect(analyzeGenreAdd).not.toHaveBeenCalled();
  });

  it('404 when the track does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'MODERATOR' } } as never);
    trackExists.mockResolvedValue(false);
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(404);
    expect(analyzeGenreAdd).not.toHaveBeenCalled();
  });

  it('202 + enqueues for MODERATOR and writes an audit entry', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'MODERATOR' } } as never);
    trackExists.mockResolvedValue(true);
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(202);
    expect(analyzeGenreAdd).toHaveBeenCalledWith({ trackId: TRACK_ID });
    expect(insertAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 'u1', actorRole: 'MODERATOR', permission: 'admin.content.moderate',
      action: 'track.analyze_genre', targetType: 'track', targetId: TRACK_ID,
    }));
  });

  it('202 + enqueues for SUPERADMIN', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'SUPERADMIN' } } as never);
    trackExists.mockResolvedValue(true);
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(202);
    expect(analyzeGenreAdd).toHaveBeenCalledWith({ trackId: TRACK_ID });
  });

  it('a failed audit write does not change the response', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'MODERATOR' } } as never);
    trackExists.mockResolvedValue(true);
    insertAuditEntry.mockRejectedValue(new Error('db down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await POST(makeReq(), ctx);

    expect(res.status).toBe(202);
    errorSpy.mockRestore();
  });
});
