import { describe, it, expect, vi, beforeEach } from 'vitest';

const { trackExists, analyzeGenreAdd } = vi.hoisted(() => ({
  trackExists: vi.fn(),
  analyzeGenreAdd: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({ trackExists }));
vi.mock('@/lib/queue', () => ({ analyzeGenreQueue: { add: analyzeGenreAdd } }));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);
const TRACK_ID = '1321eb20-c9e6-4d95-b4e7-7e6a08fc8cf9';
const ctx = { params: Promise.resolve({ id: TRACK_ID }) };

function makeReq(): Request {
  return new Request(`http://localhost/api/v1/admin/tracks/${TRACK_ID}/analyze-genre`, { method: 'POST' });
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/admin/tracks/[id]/analyze-genre', () => {
  it('403 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(403);
    expect(analyzeGenreAdd).not.toHaveBeenCalled();
  });

  it('403 for a VIEWER (read-only role)', async () => {
    mockedAuth.mockResolvedValue({ user: { role: 'VIEWER' } } as never);
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(403);
    expect(analyzeGenreAdd).not.toHaveBeenCalled();
  });

  it('403 for a plain listener', async () => {
    mockedAuth.mockResolvedValue({ user: { role: 'LISTENER' } } as never);
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(403);
    expect(analyzeGenreAdd).not.toHaveBeenCalled();
  });

  it('400 on a malformed track id', async () => {
    mockedAuth.mockResolvedValue({ user: { role: 'MODERATOR' } } as never);
    const res = await POST(makeReq(), { params: Promise.resolve({ id: 'nope' }) });
    expect(res.status).toBe(400);
    expect(analyzeGenreAdd).not.toHaveBeenCalled();
  });

  it('404 when the track does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { role: 'MODERATOR' } } as never);
    trackExists.mockResolvedValue(false);
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(404);
    expect(analyzeGenreAdd).not.toHaveBeenCalled();
  });

  it('202 + enqueues for MODERATOR', async () => {
    mockedAuth.mockResolvedValue({ user: { role: 'MODERATOR' } } as never);
    trackExists.mockResolvedValue(true);
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(202);
    expect(analyzeGenreAdd).toHaveBeenCalledWith({ trackId: TRACK_ID });
  });

  it('202 + enqueues for SUPERADMIN', async () => {
    mockedAuth.mockResolvedValue({ user: { role: 'SUPERADMIN' } } as never);
    trackExists.mockResolvedValue(true);
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(202);
    expect(analyzeGenreAdd).toHaveBeenCalledWith({ trackId: TRACK_ID });
  });
});
